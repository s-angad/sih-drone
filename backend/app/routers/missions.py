import json
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.models import Mission, MissionScenario
from app.schemas.schemas import MissionCreate, MissionResponse, MissionScenarioResponse
from app.config import settings

router = APIRouter(prefix="/api/missions", tags=["Diagnostic Missions"])

def mission_to_response(m: Mission) -> MissionResponse:
    scenario = m.scenario
    layout = {}
    if scenario and scenario.environment_layout_json:
        try:
            layout = json.loads(scenario.environment_layout_json)
        except Exception:
            layout = {}

    return MissionResponse(
        id=m.id,
        mission_code=m.mission_code,
        title=m.title,
        trade=m.trade,
        difficulty=m.difficulty,
        description=m.description,
        inspection_bounds=json.loads(m.inspection_bounds_json) if m.inspection_bounds_json else {},
        required_sensors=json.loads(m.required_sensors_json) if m.required_sensors_json else [],
        assessment_weights=json.loads(m.assessment_weights_json) if m.assessment_weights_json else {},
        safety_critical_rules=json.loads(m.safety_critical_rules_json) if m.safety_critical_rules_json else {},
        environment_layout=layout,
        created_at=m.created_at
    )

@router.get("", response_model=List[MissionResponse])
def list_missions(db: Session = Depends(get_db)):
    missions = db.query(Mission).all()
    return [mission_to_response(m) for m in missions]

@router.get("/{mission_id}", response_model=MissionResponse)
def get_mission_by_id(mission_id: str, db: Session = Depends(get_db)):
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission_to_response(m)

@router.get("/{mission_id}/scenario", response_model=MissionScenarioResponse)
def get_mission_scenario_ground_truth(
    mission_id: str,
    db: Session = Depends(get_db),
    x_trainer_token: Optional[str] = Header(None)
):
    """
    TRAINER ONLY: Retrieves hidden ground-truth scenario details.
    Restricted to prevent trainee client from leaking fault coordinates before diagnosis.
    """
    if x_trainer_token != settings.DEMO_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid trainer token required to access hidden scenario ground truth."
        )

    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mission not found")
    if not m.scenario:
        raise HTTPException(status_code=404, detail="Scenario not configured for this mission")

    s = m.scenario
    return MissionScenarioResponse(
        id=s.id,
        mission_id=s.mission_id,
        hidden_faults=json.loads(s.hidden_faults_json) if s.hidden_faults_json else [],
        environment_layout=json.loads(s.environment_layout_json) if s.environment_layout_json else {},
        simulation_seed=s.simulation_seed,
        noise_factor=s.noise_factor,
        sensor_drift_rate=s.sensor_drift_rate,
        comm_drop_probability=s.comm_drop_probability
    )

@router.post("", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
def create_mission(payload: MissionCreate, db: Session = Depends(get_db)):
    existing = db.query(Mission).filter(Mission.mission_code == payload.mission_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Mission code '{payload.mission_code}' already exists")

    mission = Mission(
        mission_code=payload.mission_code,
        title=payload.title,
        trade=payload.trade,
        difficulty=payload.difficulty,
        description=payload.description,
        inspection_bounds_json=json.dumps(payload.inspection_bounds.model_dump()),
        required_sensors_json=json.dumps(payload.required_sensors),
        assessment_weights_json=json.dumps(payload.assessment_weights.model_dump()),
        safety_critical_rules_json=json.dumps(payload.safety_critical_rules.model_dump())
    )
    db.add(mission)
    db.flush()

    scenario = MissionScenario(
        mission_id=mission.id,
        hidden_faults_json=json.dumps([f.model_dump() for f in payload.hidden_faults]),
        environment_layout_json=json.dumps(payload.environment_layout.model_dump()),
        simulation_seed=payload.simulation_seed,
        noise_factor=payload.noise_factor,
        sensor_drift_rate=payload.sensor_drift_rate
    )
    db.add(scenario)
    db.commit()
    db.refresh(mission)

    return mission_to_response(mission)

@router.delete("/{mission_id}")
def delete_mission(mission_id: str, db: Session = Depends(get_db)):
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mission not found")
    db.delete(m)
    db.commit()
    return {"message": "Mission deleted successfully"}
