from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import TrainingSession, Trainee, HazardEvent, AssessmentResult, Mission
from app.schemas.schemas import DashboardStatsResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Overview"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_statistics(db: Session = Depends(get_db)):
    total_sessions = db.query(TrainingSession).count()
    active_missions = db.query(TrainingSession).filter(TrainingSession.status == "in_progress").count()
    total_trainees = db.query(Trainee).count()
    hazards_detected = db.query(HazardEvent).filter(HazardEvent.severity.in_(["suspected", "critical"])).count()
    
    completed_sessions = db.query(TrainingSession).filter(TrainingSession.status == "completed").count()
    completion_rate = round((completed_sessions / total_sessions * 100.0), 1) if total_sessions > 0 else 0.0

    avg_score_res = db.query(func.avg(AssessmentResult.total_score)).scalar()
    average_score = round(float(avg_score_res), 1) if avg_score_res is not None else 0.0

    # Recent activity
    recent_sessions = db.query(TrainingSession).order_by(TrainingSession.created_at.desc()).limit(5).all()
    recent_activity = []
    for s in recent_sessions:
        trainee = db.query(Trainee).filter(Trainee.id == s.trainee_id).first()
        mission = db.query(Mission).filter(Mission.id == s.mission_id).first()
        recent_activity.append({
            "id": s.id,
            "session_code": s.session_code,
            "trainee_name": trainee.name if trainee else "Unknown Trainee",
            "mission_title": mission.title if mission else "Diagnostic Mission",
            "trade": trainee.trade_specialization if trainee else "general",
            "status": s.status,
            "timestamp": s.created_at.isoformat() if s.created_at else None
        })

    # Latest mission results
    latest_assessments = db.query(AssessmentResult).order_by(AssessmentResult.created_at.desc()).limit(5).all()
    latest_results = []
    for a in latest_assessments:
        session = db.query(TrainingSession).filter(TrainingSession.id == a.session_id).first()
        trainee = db.query(Trainee).filter(Trainee.id == a.trainee_id).first()
        mission = db.query(Mission).filter(Mission.id == session.mission_id).first() if session else None
        latest_results.append({
            "assessment_id": a.id,
            "session_code": session.session_code if session else "N/A",
            "trainee_name": trainee.name if trainee else "Unknown Trainee",
            "mission_title": mission.title if mission else "Diagnostic Mission",
            "total_score": a.total_score,
            "passed": a.passed,
            "safety_critical_failed": a.safety_critical_failed,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    return DashboardStatsResponse(
        total_training_sessions=total_sessions,
        active_missions_count=active_missions,
        total_trainees_count=total_trainees,
        hazards_detected_count=hazards_detected,
        mission_completion_rate=completion_rate,
        average_competency_score=average_score,
        recent_activity=recent_activity,
        latest_mission_results=latest_results,
        system_connection_status={
            "database": "online",
            "simulation_service": "active",
            "hardware_bridge": "standby_ready",
            "telemetry_broker": "ready"
        },
        is_simulated_mode=True
    )
