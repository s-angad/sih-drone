import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.models import AssessmentResult, TrainingSession, Trainee
from app.schemas.schemas import AssessmentResponse, AssessmentRubricBreakdown

router = APIRouter(prefix="/api/assessments", tags=["Competency Assessments"])

def assessment_to_response(a: AssessmentResult) -> AssessmentResponse:
    breakdown_data = {}
    if a.scoring_breakdown_json:
        try:
            breakdown_data = json.loads(a.scoring_breakdown_json)
        except Exception:
            pass

    breakdown = AssessmentRubricBreakdown(
        hazard_identification=breakdown_data.get("hazard_identification", {}),
        location_accuracy=breakdown_data.get("location_accuracy", {}),
        inspection_coverage=breakdown_data.get("inspection_coverage", {}),
        evidence_interpretation=breakdown_data.get("evidence_interpretation", {}),
        safety_decision=breakdown_data.get("safety_decision", {}),
        critical_safety_notes=breakdown_data.get("critical_safety_notes", [])
    )

    return AssessmentResponse(
        id=a.id,
        session_id=a.session_id,
        trainee_id=a.trainee_id,
        hazard_identification_score=a.hazard_identification_score,
        location_accuracy_score=a.location_accuracy_score,
        inspection_coverage_score=a.inspection_coverage_score,
        evidence_interpretation_score=a.evidence_interpretation_score,
        safety_decision_score=a.safety_decision_score,
        total_score=a.total_score,
        passed=a.passed,
        safety_critical_failed=a.safety_critical_failed,
        missed_hazards_count=a.missed_hazards_count,
        false_positives_count=a.false_positives_count,
        mean_location_error_meters=a.mean_location_error_meters,
        inspection_coverage_pct=a.inspection_coverage_pct,
        scoring_breakdown=breakdown,
        instructor_feedback=a.instructor_feedback,
        instructor_override_score=a.instructor_override_score,
        created_at=a.created_at
    )

@router.get("/session/{session_id}", response_model=AssessmentResponse)
def get_assessment_for_session(session_id: str, db: Session = Depends(get_db)):
    a = db.query(AssessmentResult).filter(AssessmentResult.session_id == session_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found for this session")
    return assessment_to_response(a)

@router.get("", response_model=List[AssessmentResponse])
def list_assessments(db: Session = Depends(get_db)):
    assessments = db.query(AssessmentResult).order_by(AssessmentResult.created_at.desc()).all()
    return [assessment_to_response(a) for a in assessments]

@router.patch("/{assessment_id}/feedback")
def update_instructor_feedback(assessment_id: str, payload: dict, db: Session = Depends(get_db)):
    a = db.query(AssessmentResult).filter(AssessmentResult.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if "feedback" in payload:
        a.instructor_feedback = payload["feedback"]
    if "override_score" in payload and payload["override_score"] is not None:
        a.instructor_override_score = float(payload["override_score"])
        # Update pass status if overridden
        if not a.safety_critical_failed:
            a.passed = (a.instructor_override_score >= 70.0)

    db.commit()
    db.refresh(a)
    return {"message": "Assessment updated", "id": a.id}
