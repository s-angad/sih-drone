import json
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from app.database import get_db
from app.models.models import TrainingSession, VisionObservation, CameraEvidenceFrame, VoiceAnnouncement
from app.schemas.schemas import (
    VisionObservationResponse,
    CameraEvidenceFrameCreate,
    CameraEvidenceFrameResponse,
    VoiceAnnouncementResponse,
)
from app.services.vision_providers import vision_manager

router = APIRouter(prefix="/api/vision", tags=["Computer Vision & Voice Audio"])

@router.get("/status")
def get_vision_system_status():
    """Returns active vision provider status and provider catalog"""
    return vision_manager.get_all_statuses()

@router.post("/provider")
def set_active_vision_provider(payload: Dict[str, str] = Body(...)):
    """Switches active vision provider (simulation_vision_provider, opencv_vision_provider, model_vision_provider)"""
    provider_name = payload.get("provider")
    if not provider_name:
        raise HTTPException(status_code=400, detail="Missing 'provider' in request body")
    success = vision_manager.set_active_provider(provider_name)
    if not success:
        raise HTTPException(status_code=400, detail=f"Invalid provider name: {provider_name}")
    return {"status": "ok", "active_provider": provider_name}

@router.get("/sessions/{session_id}/observations", response_model=List[VisionObservationResponse])
def get_session_vision_observations(session_id: str, db: Session = Depends(get_db)):
    """Retrieves all logged computer vision detections for a session"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    obs = db.query(VisionObservation).filter(VisionObservation.session_id == session_id).order_by(VisionObservation.timestamp.asc()).all()
    return obs

@router.get("/sessions/{session_id}/evidence", response_model=List[CameraEvidenceFrameResponse])
def get_session_camera_evidence(session_id: str, db: Session = Depends(get_db)):
    """Retrieves captured annotated camera evidence frames for inspection report"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    frames = db.query(CameraEvidenceFrame).filter(CameraEvidenceFrame.session_id == session_id).order_by(CameraEvidenceFrame.timestamp.asc()).all()
    return frames

@router.post("/sessions/{session_id}/evidence", response_model=CameraEvidenceFrameResponse, status_code=status.HTTP_201_CREATED)
def save_camera_evidence_frame(session_id: str, payload: CameraEvidenceFrameCreate, db: Session = Depends(get_db)):
    """Saves an annotated camera evidence frame snapshot with sensor summary"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    frame = CameraEvidenceFrame(
        session_id=session_id,
        trigger_event_type=payload.trigger_event_type,
        hazard_event_id=payload.hazard_event_id,
        drone_pos_x=payload.drone_pos_x,
        drone_pos_y=payload.drone_pos_y,
        drone_pos_z=payload.drone_pos_z,
        drone_heading_deg=payload.drone_heading_deg,
        drone_pitch_deg=payload.drone_pitch_deg,
        associated_object_id=payload.associated_object_id,
        fused_sensor_summary=json.dumps(payload.fused_sensor_summary) if payload.fused_sensor_summary else None,
        annotations_json=json.dumps(payload.annotations) if payload.annotations else None,
        image_data_url=payload.image_data_url
    )
    db.add(frame)
    db.commit()
    db.refresh(frame)
    return frame

@router.get("/sessions/{session_id}/announcements", response_model=List[VoiceAnnouncementResponse])
def get_session_voice_announcements(session_id: str, db: Session = Depends(get_db)):
    """Retrieves transcript of spoken voice announcements for replay and audit"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    announcements = db.query(VoiceAnnouncement).filter(VoiceAnnouncement.session_id == session_id).order_by(VoiceAnnouncement.timestamp.asc()).all()
    return announcements
