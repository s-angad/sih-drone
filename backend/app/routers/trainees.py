from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models.models import Trainee, TrainingSession, AssessmentResult
from app.schemas.schemas import TraineeCreate, TraineeUpdate, TraineeResponse

router = APIRouter(prefix="/api/trainees", tags=["Trainee Management"])

@router.get("", response_model=List[TraineeResponse])
def list_trainees(db: Session = Depends(get_db)):
    trainees = db.query(Trainee).all()
    results = []
    for t in trainees:
        completed = db.query(TrainingSession).filter(
            TrainingSession.trainee_id == t.id,
            TrainingSession.status == "completed"
        ).count()
        avg_score = db.query(func.avg(AssessmentResult.total_score)).filter(
            AssessmentResult.trainee_id == t.id
        ).scalar()

        results.append(TraineeResponse(
            id=t.id,
            trainee_code=t.trainee_code,
            name=t.name,
            email=t.email,
            trade_specialization=t.trade_specialization,
            notes=t.notes,
            created_at=t.created_at,
            completed_sessions_count=completed,
            average_score=round(float(avg_score), 1) if avg_score is not None else 0.0
        ))
    return results

@router.post("", response_model=TraineeResponse, status_code=status.HTTP_201_CREATED)
def create_trainee(payload: TraineeCreate, db: Session = Depends(get_db)):
    existing = db.query(Trainee).filter(Trainee.trainee_code == payload.trainee_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Trainee code '{payload.trainee_code}' already exists")

    trainee = Trainee(
        trainee_code=payload.trainee_code,
        name=payload.name,
        email=payload.email,
        trade_specialization=payload.trade_specialization,
        notes=payload.notes
    )
    db.add(trainee)
    db.commit()
    db.refresh(trainee)

    return TraineeResponse(
        id=trainee.id,
        trainee_code=trainee.trainee_code,
        name=trainee.name,
        email=trainee.email,
        trade_specialization=trainee.trade_specialization,
        notes=trainee.notes,
        created_at=trainee.created_at,
        completed_sessions_count=0,
        average_score=0.0
    )

@router.get("/{trainee_id}")
def get_trainee_detail(trainee_id: str, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    sessions = db.query(TrainingSession).filter(TrainingSession.trainee_id == trainee_id).order_by(TrainingSession.created_at.desc()).all()
    session_history = []
    for s in sessions:
        assessment = db.query(AssessmentResult).filter(AssessmentResult.session_id == s.id).first()
        session_history.append({
            "session_id": s.id,
            "session_code": s.session_code,
            "status": s.status,
            "data_source": s.data_source,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "score": assessment.total_score if assessment else None,
            "passed": assessment.passed if assessment else None,
            "safety_critical_failed": assessment.safety_critical_failed if assessment else None
        })

    avg_score = db.query(func.avg(AssessmentResult.total_score)).filter(AssessmentResult.trainee_id == trainee_id).scalar()

    return {
        "id": trainee.id,
        "trainee_code": trainee.trainee_code,
        "name": trainee.name,
        "email": trainee.email,
        "trade_specialization": trainee.trade_specialization,
        "notes": trainee.notes,
        "created_at": trainee.created_at.isoformat() if trainee.created_at else None,
        "total_sessions": len(sessions),
        "average_score": round(float(avg_score), 1) if avg_score is not None else 0.0,
        "history": session_history
    }

@router.put("/{trainee_id}", response_model=TraineeResponse)
def update_trainee(trainee_id: str, payload: TraineeUpdate, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    if payload.name is not None:
        trainee.name = payload.name
    if payload.email is not None:
        trainee.email = payload.email
    if payload.trade_specialization is not None:
        trainee.trade_specialization = payload.trade_specialization
    if payload.notes is not None:
        trainee.notes = payload.notes

    db.commit()
    db.refresh(trainee)

    return TraineeResponse(
        id=trainee.id,
        trainee_code=trainee.trainee_code,
        name=trainee.name,
        email=trainee.email,
        trade_specialization=trainee.trade_specialization,
        notes=trainee.notes,
        created_at=trainee.created_at
    )

@router.delete("/{trainee_id}")
def delete_trainee(trainee_id: str, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")
    db.delete(trainee)
    db.commit()
    return {"message": "Trainee deleted successfully"}
