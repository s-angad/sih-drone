from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import HazardEvent
from app.schemas.schemas import HazardEventResponse

router = APIRouter(prefix="/api/hazards", tags=["Hazard Events"])

@router.get("/session/{session_id}", response_model=List[HazardEventResponse])
def get_session_hazard_events(session_id: str, db: Session = Depends(get_db)):
    events = db.query(HazardEvent).filter(HazardEvent.session_id == session_id).order_by(HazardEvent.timestamp.asc()).all()
    return events

@router.patch("/{hazard_id}/review")
def update_hazard_review_status(hazard_id: str, payload: dict, db: Session = Depends(get_db)):
    """Allows trainer or trainee to mark hazard event as confirmed or false positive"""
    event = db.query(HazardEvent).filter(HazardEvent.id == hazard_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Hazard event not found")

    new_status = payload.get("review_status")
    if new_status in ("unreviewed", "confirmed", "false_positive", "ignored"):
        event.review_status = new_status
        db.commit()
        db.refresh(event)
        return {"message": "Review status updated", "hazard_id": event.id, "review_status": event.review_status}

    raise HTTPException(status_code=400, detail="Invalid review status")
