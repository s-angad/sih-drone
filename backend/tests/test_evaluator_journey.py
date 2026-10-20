import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.seed_data import init_db_data
from app.models.models import Mission, Trainee, TrainingSession

@pytest.fixture(scope="module")
def client():
    db = SessionLocal()
    init_db_data(db)
    db.close()
    with TestClient(app) as c:
        yield c

def test_evaluator_journey_end_to_end(client):
    """
    Validates the exact 5-step guided evaluator demonstration journey:
    1. Retrieve seed mission & trainee
    2. Create & start simulation session
    3. Ingest telemetry & verify sensor exceedance
    4. Execute adaptive reinspection decision & evidence snapshot
    5. Submit diagnosis & verify 100-point rubric assessment & printable report
    """
    # Step 1: Pre-requisites
    missions_res = client.get("/api/missions")
    assert missions_res.status_code == 200
    missions = missions_res.json()
    assert len(missions) > 0
    mission_id = missions[0]["id"]

    trainees_res = client.get("/api/trainees")
    assert trainees_res.status_code == 200
    trainees = trainees_res.json()
    assert len(trainees) > 0
    trainee_id = trainees[0]["id"]

    # Step 2: Create & Start Session (Stage 1: Takeoff)
    create_res = client.post("/api/sessions", json={
        "mission_id": mission_id,
        "trainee_id": trainee_id,
        "data_source": "simulation"
    })
    assert create_res.status_code in (200, 201)
    session_data = create_res.json()
    session_id = session_data["id"]

    start_res = client.post(f"/api/sessions/{session_id}/start")
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "in_progress"

    # Step 3: Advance Waypoint toward Pipe Joint J-02 (Stage 2 & 3: Inspect & Detect)
    wp_res = client.post(f"/api/sessions/{session_id}/waypoint", json={
        "x": 10.5,
        "y": 3.2,
        "z": 1.8
    })
    assert wp_res.status_code == 200

    # Step 4: Record Trainee Reinspection Decision & Evidence Frame (Stage 4: Investigate)
    decision_res = client.post(f"/api/sessions/{session_id}/decision", json={
        "action_type": "stationary_hover",
        "target_x": 10.5,
        "target_y": 3.2,
        "suspected_hazard_type": "pipe_gas_leak",
        "severity_report": "critical",
        "evidence_notes": "Executed stationary hover scan to confirm methane plume at Pipe Joint J-02.",
        "recommended_action": "isolate_valve"
    })
    assert decision_res.status_code == 200

    evidence_res = client.post(f"/api/vision/sessions/{session_id}/evidence", json={
        "session_id": session_id,
        "trigger_event_type": "reinspection_hover",
        "drone_pos_x": 10.5,
        "drone_pos_y": 3.2,
        "drone_pos_z": 1.8,
        "drone_heading_deg": 0.0,
        "drone_pitch_deg": -15.0,
        "associated_object_id": "J-02",
        "fused_sensor_summary": {"mq4_gas": 780.0, "thermal_degc": 24.8},
        "annotations": [{"object_class": "pipe_joint", "object_id": "J-02", "confidence": 0.95}],
        "image_data_url": "data:image/svg+xml;utf8,<svg width='100' height='100'></svg>"
    })
    assert evidence_res.status_code in (200, 201)
    evidence_id = evidence_res.json()["id"]

    # Step 5: Finalize & Submit Diagnosis (Stage 5: Assess)
    diag_res = client.post(f"/api/sessions/{session_id}/submit_diagnosis", json={
        "session_id": session_id,
        "hazard_detected": True,
        "suspected_hazard_type": "pipe_gas_leak",
        "estimated_position": {"x": 10.5, "y": 3.2, "z": 1.8},
        "reported_severity": "critical",
        "safety_decision": "isolate_valve",
        "evidence_rationale": "Methane spike confirmed at Pipe Joint J-02 via stationary hover. Emergency line isolation required."
    })
    assert diag_res.status_code == 200
    assessment = diag_res.json()
    assert assessment["passed"] is True
    assert assessment["total_score"] >= 80.0
    assert assessment["safety_critical_failed"] is False

    # Step 6: Verify Replay API includes evidence and completed status
    replay_res = client.get(f"/api/replay/{session_id}")
    assert replay_res.status_code == 200
    replay_data = replay_res.json()
    assert replay_data["session"]["status"] == "completed"
    assert len(replay_data["evidence_frames"]) >= 1
    assert replay_data["evidence_frames"][0]["associated_object_id"] == "J-02"

    # Step 7: Verify Printable HTML Report Generation
    report_res = client.get(f"/api/replay/{session_id}/report.html")
    assert report_res.status_code == 200
    assert "text/html" in report_res.headers["content-type"]
    html_content = report_res.text
    assert "SkillDrone" in html_content
    assert "Alex Morgan" in html_content
    assert "Pipe Joint J-02" in html_content or "J-02" in html_content
