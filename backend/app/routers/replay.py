import json
from fastapi import APIRouter, Depends, HTTPException, Header, Response
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import (
    TrainingSession,
    SensorEvent,
    HazardEvent,
    TraineeDecision,
    AssessmentResult,
    MissionScenario,
    VisionObservation,
    CameraEvidenceFrame,
    VoiceAnnouncement,
)
from app.services.report_generator import report_generator
from app.config import settings

router = APIRouter(prefix="/api/replay", tags=["Session Replay & Audit Export"])

@router.get("/{session_id}")
def get_session_replay_data(
    session_id: str, 
    db: Session = Depends(get_db),
    x_trainer_token: Optional[str] = Header(None)
):
    """
    Returns full timeline of flight trajectory, sensor traces,
    hazard alerts, trainee decisions, and ground-truth comparison.
    Ground-truth is withheld during in-progress sessions unless valid trainer token is supplied.
    """
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    sensor_events = db.query(SensorEvent).filter(SensorEvent.session_id == session_id).order_by(SensorEvent.sequence_number.asc()).all()
    hazard_events = db.query(HazardEvent).filter(HazardEvent.session_id == session_id).order_by(HazardEvent.timestamp.asc()).all()
    decisions = db.query(TraineeDecision).filter(TraineeDecision.session_id == session_id).order_by(TraineeDecision.timestamp.asc()).all()
    assessment = db.query(AssessmentResult).filter(AssessmentResult.session_id == session_id).first()
    vision_obs = db.query(VisionObservation).filter(VisionObservation.session_id == session_id).order_by(VisionObservation.timestamp.asc()).all()
    evidence_frames = db.query(CameraEvidenceFrame).filter(CameraEvidenceFrame.session_id == session_id).order_by(CameraEvidenceFrame.timestamp.asc()).all()
    voice_announcements = db.query(VoiceAnnouncement).filter(VoiceAnnouncement.session_id == session_id).order_by(VoiceAnnouncement.timestamp.asc()).all()

    # Ground truth (revealed only for completed sessions or verified trainers)
    scenario = session.mission.scenario if session.mission else None
    ground_truth = []
    can_reveal_ground_truth = (session.status == "completed") or (x_trainer_token == settings.DEMO_AUTH_TOKEN)
    if can_reveal_ground_truth and scenario and scenario.hidden_faults_json:
        try:
            ground_truth = json.loads(scenario.hidden_faults_json)
        except Exception:
            ground_truth = []

    # Map trajectory points
    trajectory = []
    sensor_timeline = []
    for e in sensor_events:
        trajectory.append({
            "seq": e.sequence_number,
            "x": e.position_x,
            "y": e.position_y,
            "z": e.position_z,
            "heading": e.drone_heading,
            "speed": e.drone_speed,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None
        })
        sensor_timeline.append({
            "seq": e.sequence_number,
            "type": e.sensor_type,
            "raw": e.raw_value,
            "calibrated": e.calibrated_value,
            "unit": e.measurement_unit,
            "health": e.sensor_health,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None
        })

    return {
        "session": {
            "id": session.id,
            "session_code": session.session_code,
            "status": session.status,
            "data_source": session.data_source,
            "duration_seconds": session.duration_seconds,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "trainee_name": session.trainee.name if session.trainee else "Unknown",
            "mission_title": session.mission.title if session.mission else "Diagnostic Mission",
            "battery_final": session.drone_battery_final,
            "distance_meters": session.total_distance_meters,
        },
        "trajectory": trajectory,
        "sensor_timeline": sensor_timeline,
        "hazard_events": [
            {
                "id": h.id,
                "timestamp": h.timestamp.isoformat() if h.timestamp else None,
                "sensor_type": h.sensor_type,
                "raw_value": h.raw_value,
                "calibrated_value": h.calibrated_value,
                "unit": h.measurement_unit,
                "position": {"x": h.position_x, "y": h.position_y, "z": h.position_z},
                "rule_name": h.rule_name,
                "severity": h.severity,
                "confidence": h.confidence,
                "review_status": h.review_status,
                "details": h.details
            }
            for h in hazard_events
        ],
        "decisions": [
            {
                "id": d.id,
                "timestamp": d.timestamp.isoformat() if d.timestamp else None,
                "action_type": d.action_type,
                "target": {"x": d.target_x, "y": d.target_y, "z": d.target_z},
                "suspected_hazard": d.suspected_hazard_type,
                "severity": d.severity_report,
                "notes": d.evidence_notes,
                "recommended_action": d.recommended_action
            }
            for d in decisions
        ],
        "ground_truth_faults": ground_truth,
        "vision_observations": [
            {
                "id": vo.id,
                "timestamp": vo.timestamp.isoformat() if vo.timestamp else None,
                "object_class": vo.object_class,
                "object_id": vo.object_id,
                "confidence": vo.confidence,
                "bbox": [vo.bbox_x_min, vo.bbox_y_min, vo.bbox_x_max, vo.bbox_y_max],
                "workshop_coords": {"x": vo.workshop_x, "y": vo.workshop_y, "z": vo.workshop_z},
                "distance_m": vo.drone_distance_m,
                "provider": vo.vision_provider,
                "notes": vo.notes
            }
            for vo in vision_obs
        ],
        "evidence_frames": [
            {
                "id": ef.id,
                "timestamp": ef.timestamp.isoformat() if ef.timestamp else None,
                "trigger_event": ef.trigger_event_type,
                "hazard_event_id": ef.hazard_event_id,
                "drone_position": {"x": ef.drone_pos_x, "y": ef.drone_pos_y, "z": ef.drone_pos_z},
                "drone_heading": ef.drone_heading_deg,
                "associated_object_id": ef.associated_object_id,
                "annotations": json.loads(ef.annotations_json) if ef.annotations_json else [],
                "fused_sensors": json.loads(ef.fused_sensor_summary) if ef.fused_sensor_summary else {},
                "image_data_url": ef.image_data_url
            }
            for ef in evidence_frames
        ],
        "voice_announcements": [
            {
                "id": va.id,
                "timestamp": va.timestamp.isoformat() if va.timestamp else None,
                "message": va.message_text,
                "priority": va.priority,
                "category": va.category,
                "associated_object_id": va.associated_object_id
            }
            for va in voice_announcements
        ],
        "assessment": {
            "total_score": assessment.total_score if assessment else 0.0,
            "passed": assessment.passed if assessment else False,
            "safety_critical_failed": assessment.safety_critical_failed if assessment else False,
            "scoring_breakdown": json.loads(assessment.scoring_breakdown_json) if assessment and assessment.scoring_breakdown_json else {},
            "instructor_feedback": assessment.instructor_feedback if assessment else ""
        }
    }

@router.get("/{session_id}/export.csv")
def export_sensor_logs_csv(session_id: str, db: Session = Depends(get_db)):
    """Exports raw CSV telemetry dataset for scientific audit and trainee post-flight review"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events = db.query(SensorEvent).filter(SensorEvent.session_id == session_id).order_by(SensorEvent.sequence_number.asc()).all()
    csv_content = report_generator.generate_sensor_events_csv(events)

    filename = f"skilldrone_telemetry_{session.session_code.replace('-', '_')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{session_id}/report")
def export_session_report(session_id: str, db: Session = Depends(get_db)):
    """Exports structured diagnostic training competency report"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    assessment = db.query(AssessmentResult).filter(AssessmentResult.session_id == session_id).first()
    hazards = db.query(HazardEvent).filter(HazardEvent.session_id == session_id).all()
    decisions = db.query(TraineeDecision).filter(TraineeDecision.session_id == session_id).all()
    evidence = db.query(CameraEvidenceFrame).filter(CameraEvidenceFrame.session_id == session_id).all()
    voices = db.query(VoiceAnnouncement).filter(VoiceAnnouncement.session_id == session_id).all()

    report = report_generator.generate_session_summary_dict(
        session=session,
        assessment=assessment,
        trainee=session.trainee,
        mission=session.mission,
        hazard_events=hazards,
        decisions=decisions,
        evidence_frames=evidence,
        voice_announcements=voices
    )
    return report

@router.get("/{session_id}/report.html")
def export_printable_html_report(session_id: str, db: Session = Depends(get_db)):
    """Exports printable executive HTML inspection report with visual evidence thumbnails"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    assessment = db.query(AssessmentResult).filter(AssessmentResult.session_id == session_id).first()
    hazards = db.query(HazardEvent).filter(HazardEvent.session_id == session_id).order_by(HazardEvent.timestamp.asc()).all()
    decisions = db.query(TraineeDecision).filter(TraineeDecision.session_id == session_id).order_by(TraineeDecision.timestamp.asc()).all()
    evidence = db.query(CameraEvidenceFrame).filter(CameraEvidenceFrame.session_id == session_id).order_by(CameraEvidenceFrame.timestamp.asc()).all()
    voices = db.query(VoiceAnnouncement).filter(VoiceAnnouncement.session_id == session_id).order_by(VoiceAnnouncement.timestamp.asc()).all()

    html_content = report_generator.generate_printable_html_report(
        session=session,
        assessment=assessment,
        trainee=session.trainee,
        mission=session.mission,
        hazard_events=hazards,
        decisions=decisions,
        evidence_frames=evidence,
        voice_announcements=voices
    )
    return Response(content=html_content, media_type="text/html")
