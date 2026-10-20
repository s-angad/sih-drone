import pytest
from app.services.vision_providers import SimulationVisionProvider, vision_manager
from app.services.fusion_engine import SensorVisionFusionEngine
from app.services.voice_service import VoiceAnnouncementService
from app.services.report_generator import report_generator
from fastapi.testclient import TestClient

def test_simulation_vision_provider_frustum_projection():
    provider = SimulationVisionProvider()
    
    # Drone at (9.0, 3.0, 1.8), heading 0 deg (East, looking towards +X)
    # Asset J-02 is at (10.0, 3.0, 1.8) -> exactly 1.0m directly ahead along optical axis!
    cam_state = {
        "x": 9.0,
        "y": 3.0,
        "z": 1.8,
        "heading_deg": 0.0,
        "pitch_deg": 0.0,
        "fov_deg": 70.0
    }
    detections = provider.detect_objects(cam_state, {})
    assert len(detections) > 0

    # Verify J-02 is visible and centered
    j02_det = next((d for d in detections if d.get("object_id") == "J-02"), None)
    assert j02_det is not None
    assert j02_det["object_class"] == "pipe_joint"
    assert 0.8 <= j02_det["drone_distance_m"] <= 1.2
    # Should be near the center of the viewport (u ~ 0.5, v ~ 0.5)
    center_u = (j02_det["bbox_x_min"] + j02_det["bbox_x_max"]) / 2.0
    center_v = (j02_det["bbox_y_min"] + j02_det["bbox_y_max"]) / 2.0
    assert 0.45 <= center_u <= 0.55
    assert 0.45 <= center_v <= 0.55

    # If drone turns 180 degrees (looking West), J-02 should be behind the drone and NOT visible
    cam_state_turned = dict(cam_state, heading_deg=180.0)
    turned_detections = provider.detect_objects(cam_state_turned, {})
    j02_turned = next((d for d in turned_detections if d.get("object_id") == "J-02"), None)
    assert j02_turned is None

def test_sensor_vision_fusion():
    fusion = SensorVisionFusionEngine()

    # Case A: Elevated gas reading with visible pipe joint J-02 in view
    hazard_gas = {
        "sensor_type": "mq4_gas",
        "severity": "critical",
        "raw_value": 820.0,
        "confidence": 0.95
    }
    visible_objects = [
        {"object_id": "J-02", "object_class": "pipe_joint", "workshop_x": 10.0, "workshop_y": 3.0, "confidence": 0.92}
    ]
    drone_pos = {"x": 10.2, "y": 3.1, "z": 1.8}

    res_fused = fusion.fuse_hazard_with_vision(hazard_gas, visible_objects, drone_pos)
    assert res_fused["fusion_status"] == "correlated"
    assert res_fused["associated_object_id"] == "J-02"
    assert res_fused["confidence"] > 0.80

    # Case B: Elevated gas reading but camera view is empty or facing away
    res_empty_vis = fusion.fuse_hazard_with_vision(hazard_gas, [], drone_pos)
    # Sensor alert MUST NOT be suppressed; marked as visual unresolved
    assert res_empty_vis["fusion_status"] == "sensor_only_visual_unresolved"
    assert res_empty_vis["associated_object_id"] is None
    assert "visual localization unavailable" in res_empty_vis["notes"].lower()

def test_voice_announcement_generation_and_flooding_suppression():
    voice = VoiceAnnouncementService()
    voice.reset_session()

    # 1. Critical gas alert
    ann1 = voice.generate_announcement("gas_anomaly", {
        "severity": "critical",
        "raw_value": 850.0,
        "object_id": "J-02",
        "position": {"x": 10.0, "y": 3.0}
    })
    assert ann1 is not None
    assert ann1["priority"] == "critical"
    assert "J-02" in ann1["message_text"]
    assert "Critical" in ann1["message_text"]

    # 2. Immediate duplicate warning within cooldown -> should be suppressed
    ann_dup = voice.generate_announcement("gas_anomaly", {
        "severity": "warning",
        "raw_value": 440.0,
        "object_id": "J-02",
        "position": {"x": 10.0, "y": 3.0}
    })
    assert ann_dup is None

def test_vision_api_endpoints(client: TestClient):
    # Status endpoint
    status_res = client.get("/api/vision/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert "active_provider" in data
    assert len(data["providers"]) >= 2

    # Switch provider
    switch_res = client.post("/api/vision/provider", json={"provider": "opencv_vision_provider"})
    assert switch_res.status_code == 200
    assert switch_res.json()["active_provider"] == "opencv_vision_provider"

    # Reset back to simulation provider
    client.post("/api/vision/provider", json={"provider": "simulation_vision_provider"})

def test_printable_html_report_generation(client: TestClient):
    # Fetch existing session or create one
    trainees = client.get("/api/trainees").json()
    missions = client.get("/api/missions").json()
    t_id = trainees[0]["id"]
    m_id = missions[0]["id"]

    ses_res = client.post("/api/sessions", json={"trainee_id": t_id, "mission_id": m_id})
    s_id = ses_res.json()["id"]

    # Request HTML report
    html_res = client.get(f"/api/replay/{s_id}/report.html")
    assert html_res.status_code == 200
    assert "text/html" in html_res.headers["content-type"]
    assert "<!DOCTYPE html>" in html_res.text
    assert "SkillDrone Inspection Audit Report" in html_res.text
