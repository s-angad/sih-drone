import json
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db, SessionLocal
from app.models.models import TrainingSession, Mission, MissionScenario, Trainee, SensorEvent, HazardEvent, TraineeDecision, AssessmentResult
from app.schemas.schemas import SessionCreate, SessionResponse, TraineeDiagnosisSubmission, AssessmentResponse
from app.services.simulation_engine import DeterministicSimulationEngine
from app.services.assessment_engine import assessment_engine
from app.services.hazard_detector import hazard_detector

router = APIRouter(prefix="/api/sessions", tags=["Training Sessions"])

# In-memory active simulation engine registry
_active_simulators: Dict[str, DeterministicSimulationEngine] = {}

def get_active_simulator(session_id: str) -> Optional[DeterministicSimulationEngine]:
    return _active_simulators.get(session_id)

def register_simulator(session_id: str, sim: DeterministicSimulationEngine):
    _active_simulators[session_id] = sim

def unregister_simulator(session_id: str):
    if session_id in _active_simulators:
        del _active_simulators[session_id]

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == payload.mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    trainee = db.query(Trainee).filter(Trainee.id == payload.trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    session_count = db.query(TrainingSession).count() + 1
    session_code = f"SES-{datetime.datetime.utcnow().strftime('%y%m%d')}-{session_count:04d}"

    session = TrainingSession(
        session_code=session_code,
        mission_id=payload.mission_id,
        trainee_id=payload.trainee_id,
        status="idle",
        data_source=payload.data_source,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SessionResponse(
        id=session.id,
        session_code=session.session_code,
        mission_id=session.mission_id,
        trainee_id=session.trainee_id,
        status=session.status,
        data_source=session.data_source,
        start_time=session.start_time,
        end_time=session.end_time,
        duration_seconds=session.duration_seconds,
        drone_battery_final=session.drone_battery_final,
        total_distance_meters=session.total_distance_meters,
        created_at=session.created_at,
        trainee_name=trainee.name,
        mission_title=mission.title
    )

@router.post("/{session_id}/start")
def start_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot restart a completed session")

    session.status = "in_progress"
    session.start_time = datetime.datetime.utcnow()
    db.commit()

    # If simulation mode, initialize deterministic simulation engine with mission's hidden scenario
    if session.data_source == "simulation":
        scenario = db.query(MissionScenario).filter(MissionScenario.mission_id == session.mission_id).first()
        scenario_config = {}
        if scenario:
            scenario_config = {
                "simulation_seed": scenario.simulation_seed,
                "noise_factor": scenario.noise_factor,
                "sensor_drift_rate": scenario.sensor_drift_rate,
                "comm_drop_probability": scenario.comm_drop_probability,
                "hidden_faults": json.loads(scenario.hidden_faults_json) if scenario.hidden_faults_json else [],
                "environment_layout": json.loads(scenario.environment_layout_json) if scenario.environment_layout_json else {}
            }
        sim = DeterministicSimulationEngine(session_id, scenario_config)
        register_simulator(session_id, sim)

    return {"message": "Session started", "session_id": session.id, "status": session.status}

@router.post("/{session_id}/pause")
def pause_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "paused"
    db.commit()
    sim = get_active_simulator(session_id)
    if sim:
        sim.pause()
    return {"message": "Session paused", "status": session.status}

@router.post("/{session_id}/resume")
def resume_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "in_progress"
    db.commit()
    sim = get_active_simulator(session_id)
    if sim:
        sim.resume()
    return {"message": "Session resumed", "status": session.status}

@router.post("/{session_id}/waypoint")
def set_inspection_target(session_id: str, payload: Dict[str, float], db: Session = Depends(get_db)):
    """Allows trainee to steer drone or command a stationary hover / reinspection at target coords"""
    sim = get_active_simulator(session_id)
    if sim:
        sim.set_target_waypoint(payload.get("x", 0.0), payload.get("y", 0.0), payload.get("z", 1.8))
        return {"message": "Target waypoint updated", "target": payload}
    return {"message": "No active simulator", "target": payload}

@router.post("/{session_id}/decision")
def record_trainee_decision(session_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Logs trainee investigative action (e.g., stationary_hover, sensor_calibration_check)"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    decision = TraineeDecision(
        session_id=session_id,
        action_type=payload.get("action_type", "reinspect"),
        target_x=payload.get("target_x"),
        target_y=payload.get("target_y"),
        target_z=payload.get("target_z", 1.8),
        suspected_hazard_type=payload.get("suspected_hazard_type"),
        severity_report=payload.get("severity_report"),
        evidence_notes=payload.get("evidence_notes"),
        recommended_action=payload.get("recommended_action")
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return {"message": "Decision recorded", "id": decision.id}

@router.post("/{session_id}/submit_diagnosis", response_model=AssessmentResponse)
def submit_trainee_diagnosis(session_id: str, submission: TraineeDiagnosisSubmission, db: Session = Depends(get_db)):
    """
    Submits trainee's diagnostic conclusions, compares with hidden ground truth,
    evaluates using the 100-point rubric, and locks the session.
    """
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    mission = session.mission
    scenario = mission.scenario
    if not scenario:
        raise HTTPException(status_code=500, detail="Mission scenario not configured")

    ground_truth_faults = json.loads(scenario.hidden_faults_json) if scenario.hidden_faults_json else []
    inspection_bounds = json.loads(mission.inspection_bounds_json) if mission.inspection_bounds_json else {}
    weights = json.loads(mission.assessment_weights_json) if mission.assessment_weights_json else {}
    safety_rules = json.loads(mission.safety_critical_rules_json) if mission.safety_critical_rules_json else {}

    # Extract flight path from logged sensor events
    events = db.query(SensorEvent).filter(SensorEvent.session_id == session_id).order_by(SensorEvent.sequence_number.asc()).all()
    flight_path = [{"x": e.position_x, "y": e.position_y, "z": e.position_z} for e in events]
    
    # Extract trainee decisions
    decisions = [
        {"action_type": d.action_type, "target_x": d.target_x, "target_y": d.target_y}
        for d in session.decisions
    ]

    # Evaluate
    eval_result = assessment_engine.evaluate(
        submission=submission,
        ground_truth_faults=ground_truth_faults,
        inspection_bounds=inspection_bounds,
        flight_path=flight_path,
        decisions=decisions,
        weights=weights,
        safety_rules=safety_rules
    )

    # Finalize Session
    session.status = "completed"
    session.end_time = datetime.datetime.utcnow()
    if session.start_time:
        session.duration_seconds = max(1.0, round((session.end_time - session.start_time).total_seconds(), 1))

    sim = get_active_simulator(session_id)
    if sim:
        session.drone_battery_final = round(sim.battery_pct, 1)
        session.total_distance_meters = round(sim.total_distance_meters, 1)
        unregister_simulator(session_id)

    # Persist Assessment Result
    assessment = db.query(AssessmentResult).filter(AssessmentResult.session_id == session_id).first()
    if not assessment:
        assessment = AssessmentResult(session_id=session_id, trainee_id=session.trainee_id)
        db.add(assessment)

    assessment.hazard_identification_score = eval_result["hazard_identification_score"]
    assessment.location_accuracy_score = eval_result["location_accuracy_score"]
    assessment.inspection_coverage_score = eval_result["inspection_coverage_score"]
    assessment.evidence_interpretation_score = eval_result["evidence_interpretation_score"]
    assessment.safety_decision_score = eval_result["safety_decision_score"]
    assessment.total_score = eval_result["total_score"]
    assessment.passed = eval_result["passed"]
    assessment.safety_critical_failed = eval_result["safety_critical_failed"]
    assessment.missed_hazards_count = eval_result["missed_hazards_count"]
    assessment.false_positives_count = eval_result["false_positives_count"]
    assessment.mean_location_error_meters = eval_result["mean_location_error_meters"]
    assessment.inspection_coverage_pct = eval_result["inspection_coverage_pct"]
    assessment.scoring_breakdown_json = json.dumps(eval_result["scoring_breakdown"].model_dump())
    assessment.instructor_feedback = f"Automated vocational assessment completed. {'Passed with competency certification.' if eval_result['passed'] else 'Competency requirements not satisfied; reinspection recommended.'}"

    db.commit()
    db.refresh(assessment)

    # Clean up detector cache
    hazard_detector.clear_session(session_id)

    return AssessmentResponse(
        id=assessment.id,
        session_id=assessment.session_id,
        trainee_id=assessment.trainee_id,
        hazard_identification_score=assessment.hazard_identification_score,
        location_accuracy_score=assessment.location_accuracy_score,
        inspection_coverage_score=assessment.inspection_coverage_score,
        evidence_interpretation_score=assessment.evidence_interpretation_score,
        safety_decision_score=assessment.safety_decision_score,
        total_score=assessment.total_score,
        passed=assessment.passed,
        safety_critical_failed=assessment.safety_critical_failed,
        missed_hazards_count=assessment.missed_hazards_count,
        false_positives_count=assessment.false_positives_count,
        mean_location_error_meters=assessment.mean_location_error_meters,
        inspection_coverage_pct=assessment.inspection_coverage_pct,
        scoring_breakdown=eval_result["scoring_breakdown"],
        instructor_feedback=assessment.instructor_feedback,
        created_at=assessment.created_at
    )

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    trainee = session.trainee
    mission = session.mission
    return SessionResponse(
        id=session.id,
        session_code=session.session_code,
        mission_id=session.mission_id,
        trainee_id=session.trainee_id,
        status=session.status,
        data_source=session.data_source,
        start_time=session.start_time,
        end_time=session.end_time,
        duration_seconds=session.duration_seconds,
        drone_battery_final=session.drone_battery_final,
        total_distance_meters=session.total_distance_meters,
        created_at=session.created_at,
        trainee_name=trainee.name if trainee else None,
        mission_title=mission.title if mission else None
    )

@router.get("", response_model=List[SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(TrainingSession).order_by(TrainingSession.created_at.desc()).all()
    res = []
    for s in sessions:
        trainee = s.trainee
        mission = s.mission
        res.append(SessionResponse(
            id=s.id,
            session_code=s.session_code,
            mission_id=s.mission_id,
            trainee_id=s.trainee_id,
            status=s.status,
            data_source=s.data_source,
            start_time=s.start_time,
            end_time=s.end_time,
            duration_seconds=s.duration_seconds,
            drone_battery_final=s.drone_battery_final,
            total_distance_meters=s.total_distance_meters,
            created_at=s.created_at,
            trainee_name=trainee.name if trainee else None,
            mission_title=mission.title if mission else None
        ))
    return res
