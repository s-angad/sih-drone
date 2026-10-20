import pytest
from app.services.assessment_engine import CompetencyAssessmentEngine
from app.schemas.schemas import TraineeDiagnosisSubmission

def test_perfect_assessment_score():
    engine = CompetencyAssessmentEngine()

    ground_truth = [{
        "fault_id": "F-01",
        "fault_type": "pipe_gas_leak",
        "x": 10.0,
        "y": 5.0,
        "z": 1.5,
        "severity": "critical"
    }]
    bounds = {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 15}

    # Dense flight path covering the area
    flight_path = [{"x": x, "y": y, "z": 1.5} for x in range(0, 20, 2) for y in range(0, 15, 2)]

    decisions = [{"action_type": "stationary_hover", "target_x": 10.0, "target_y": 5.0}]

    submission = TraineeDiagnosisSubmission(
        session_id="ses-1",
        hazard_detected=True,
        suspected_hazard_type="pipe_gas_leak",
        estimated_position={"x": 10.2, "y": 5.1, "z": 1.5}, # 0.22m error (< 1.0m tolerance)
        reported_severity="critical",
        safety_decision="isolate_valve",
        evidence_rationale="Observed elevated MQ-4 gas reading peaking at 780 ADC near manifold elbow. Stationary hover confirmed localized plume."
    )

    result = engine.evaluate(submission, ground_truth, bounds, flight_path, decisions)

    assert result["passed"] is True
    assert result["safety_critical_failed"] is False
    assert result["hazard_identification_score"] == 30.0
    assert result["location_accuracy_score"] == 25.0
    assert result["safety_decision_score"] == 15.0
    assert result["total_score"] >= 90.0

def test_safety_critical_failure_override():
    """
    Even with high coverage and good flight metrics, if a critical hazard is present
    and trainee fails to flag it or clears the facility, it MUST trigger a safety-critical failure.
    """
    engine = CompetencyAssessmentEngine()

    ground_truth = [{
        "fault_id": "F-CRIT-GAS",
        "fault_type": "pipe_gas_leak",
        "x": 10.0,
        "y": 5.0,
        "z": 1.5,
        "severity": "critical"
    }]
    bounds = {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 15}
    flight_path = [{"x": x, "y": y, "z": 1.5} for x in range(0, 20, 2) for y in range(0, 15, 2)]

    # Trainee says everything is clear!
    submission = TraineeDiagnosisSubmission(
        session_id="ses-fail",
        hazard_detected=False, # MISSED!
        safety_decision="clear_to_operate",
        evidence_rationale="Scanned area, readings seemed normal."
    )

    result = engine.evaluate(submission, ground_truth, bounds, flight_path, [])

    assert result["safety_critical_failed"] is True
    assert result["passed"] is False
    assert result["missed_hazards_count"] == 1
    assert len(result["scoring_breakdown"].critical_safety_notes) > 0

def test_location_error_taper():
    engine = CompetencyAssessmentEngine()
    ground_truth = [{"fault_type": "pipe_gas_leak", "x": 10.0, "y": 10.0, "z": 1.5, "severity": "critical"}]
    bounds = {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 20}

    # Estimate off by 6 meters
    submission = TraineeDiagnosisSubmission(
        session_id="ses-inaccurate",
        hazard_detected=True,
        suspected_hazard_type="pipe_gas_leak",
        estimated_position={"x": 16.0, "y": 10.0, "z": 1.5},
        safety_decision="isolate_valve",
        evidence_rationale="Smelled gas"
    )

    result = engine.evaluate(submission, ground_truth, bounds, [], [])
    assert result["location_accuracy_score"] == 0.0
    assert result["mean_location_error_meters"] == 6.0

def test_multi_hazard_assessment():
    engine = CompetencyAssessmentEngine()
    ground_truth = [
        {"fault_id": "F-01", "fault_type": "pipe_gas_leak", "x": 6.0, "y": 5.0, "z": 1.5, "severity": "critical"},
        {"fault_id": "F-02", "fault_type": "electrical_hotspot", "x": 14.0, "y": 8.0, "z": 1.5, "severity": "medium"}
    ]
    bounds = {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 20}
    flight_path = [{"x": x, "y": y, "z": 1.5} for x in range(0, 20, 2) for y in range(0, 20, 2)]

    # Case A: Trainee reports only one hazard (gas leak)
    sub_partial = TraineeDiagnosisSubmission(
        session_id="ses-partial",
        hazard_detected=True,
        suspected_hazard_type="pipe_gas_leak",
        estimated_position={"x": 6.1, "y": 5.1, "z": 1.5},
        reported_severity="critical",
        safety_decision="isolate_valve",
        evidence_rationale="Identified severe methane gas plume near manifold elbow at (6, 5)."
    )
    res_partial = engine.evaluate(sub_partial, ground_truth, bounds, flight_path, [])
    assert res_partial["missed_hazards_count"] == 1
    assert res_partial["hazard_identification_score"] < 30.0  # partial credit

    # Case B: Trainee misses the critical hazard (reports only medium hotspot at 14,8)
    sub_missed_crit = TraineeDiagnosisSubmission(
        session_id="ses-missed-crit",
        hazard_detected=True,
        suspected_hazard_type="electrical_hotspot",
        estimated_position={"x": 14.1, "y": 8.1, "z": 1.5},
        reported_severity="medium",
        safety_decision="scheduled_maintenance",
        evidence_rationale="Observed warm electrical panel at 14, 8."
    )
    res_crit_fail = engine.evaluate(sub_missed_crit, ground_truth, bounds, flight_path, [])
    assert res_crit_fail["safety_critical_failed"] is True
    assert res_crit_fail["passed"] is False
    assert res_crit_fail["missed_hazards_count"] == 1

def test_nominal_facility_assessment():
    engine = CompetencyAssessmentEngine()
    ground_truth = [] # 0 faults
    bounds = {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 20}
    flight_path = [{"x": x, "y": y, "z": 1.5} for x in range(0, 20, 2) for y in range(0, 20, 2)]

    submission = TraineeDiagnosisSubmission(
        session_id="ses-nominal",
        hazard_detected=False,
        safety_decision="clear_to_operate",
        evidence_rationale="Scanned all corridors; all sensor readings were at baseline with zero anomalies."
    )
    result = engine.evaluate(submission, ground_truth, bounds, flight_path, [])
    assert result["passed"] is True
    assert result["safety_critical_failed"] is False
    assert result["missed_hazards_count"] == 0
    assert result["false_positives_count"] == 0
    assert result["hazard_identification_score"] == 30.0
    assert result["location_accuracy_score"] == 25.0

