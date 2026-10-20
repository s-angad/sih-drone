from fastapi.testclient import TestClient

def test_full_mission_diagnostic_workflow(client: TestClient):
    # 1. Create Trainee
    trainee_res = client.post("/api/trainees", json={
        "trainee_code": "TR-INT-001",
        "name": "Sam Taylor",
        "email": "sam.taylor@test.edu",
        "trade_specialization": "gas_fitting",
        "notes": "Integration test apprentice"
    })
    assert trainee_res.status_code == 201
    trainee_id = trainee_res.json()["id"]

    # 2. Create Diagnostic Mission with hidden fault
    mission_res = client.post("/api/missions", json={
        "mission_code": "MSN-INT-001",
        "title": "Integration Test Pipeline Survey",
        "trade": "gas_fitting",
        "difficulty": "intermediate",
        "description": "Survey pipeline branch for simulated gas anomaly.",
        "inspection_bounds": {"x_min": 0, "x_max": 20, "y_min": 0, "y_max": 15, "z_min": 0.5, "z_max": 3.0},
        "required_sensors": ["mq4_gas", "thermal_ir"],
        "assessment_weights": {"hazard_id": 30.0, "location_accuracy": 25.0, "coverage": 15.0, "evidence": 15.0, "safety": 15.0},
        "safety_critical_rules": {"fail_on_unreported_critical_gas": True, "fail_on_critical_hotspot_disregard": False},
        "hidden_faults": [
            {
                "fault_id": "FLT-TEST-01",
                "fault_type": "pipe_gas_leak",
                "x": 8.0,
                "y": 4.0,
                "z": 1.5,
                "radius_meters": 2.0,
                "peak_intensity": 750.0,
                "gas_type": "methane",
                "severity": "critical",
                "description": "Test leak location"
            }
        ],
        "environment_layout": {
            "workshop_name": "Test Bay",
            "pipes": [], "valves": [], "joints": [], "workstations": [], "obstacles": []
        },
        "simulation_seed": 777
    })
    assert mission_res.status_code == 201
    mission_id = mission_res.json()["id"]

    # 3. Start a Session
    session_res = client.post("/api/sessions", json={
        "mission_id": mission_id,
        "trainee_id": trainee_id,
        "data_source": "simulation"
    })
    assert session_res.status_code == 201
    session_id = session_res.json()["id"]

    start_res = client.post(f"/api/sessions/{session_id}/start")
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "in_progress"

    # 4. Feed sensor events (simulated drone flying near the leak)
    # Background point far away
    ingest1 = client.post("/api/telemetry/ingest", json={
        "session_id": session_id,
        "sequence_number": 1,
        "position": {"x": 2.0, "y": 2.0, "z": 1.5},
        "heading_deg": 0.0,
        "speed_mps": 1.0,
        "battery_pct": 99.0,
        "sensors": [
            {"sensor_type": "mq4_gas", "raw_value": 220.0, "calibrated_value": 30.0, "unit": "ADC_counts", "sensor_health": "nominal"}
        ],
        "is_simulated": True
    })
    assert ingest1.status_code == 200

    # Drone enters leak plume (critical readings)
    ingest2 = client.post("/api/telemetry/ingest", json={
        "session_id": session_id,
        "sequence_number": 2,
        "position": {"x": 8.1, "y": 4.1, "z": 1.5},
        "heading_deg": 30.0,
        "speed_mps": 0.4,
        "battery_pct": 98.5,
        "sensors": [
            {"sensor_type": "mq4_gas", "raw_value": 810.0, "calibrated_value": 915.0, "unit": "ADC_counts", "sensor_health": "nominal"}
        ],
        "is_simulated": True
    })
    assert ingest2.status_code == 200

    # 5. Trainee records a stationary hover decision
    dec_res = client.post(f"/api/sessions/{session_id}/decision", json={
        "action_type": "stationary_hover",
        "target_x": 8.1,
        "target_y": 4.1,
        "target_z": 1.5,
        "evidence_notes": "Holding hover to isolate peak methane gradient"
    })
    assert dec_res.status_code == 200

    # 6. Trainee submits diagnosis
    diag_res = client.post(f"/api/sessions/{session_id}/submit_diagnosis", json={
        "session_id": session_id,
        "hazard_detected": True,
        "suspected_hazard_type": "pipe_gas_leak",
        "estimated_position": {"x": 8.05, "y": 4.08, "z": 1.5},
        "reported_severity": "critical",
        "safety_decision": "isolate_valve",
        "evidence_rationale": "High persistent MQ-4 concentration exceeding 800 ADC at branch junction."
    })
    assert diag_res.status_code == 200
    diag_data = diag_res.json()

    # 7. Verify competency score
    assert diag_data["passed"] is True
    assert diag_data["safety_critical_failed"] is False
    assert diag_data["total_score"] >= 80.0
    assert diag_data["location_accuracy_score"] == 25.0 # error < 0.1m

    # 8. Verify session completed and retrieve saved replay & CSV report
    sess_chk = client.get(f"/api/sessions/{session_id}")
    assert sess_chk.status_code == 200
    assert sess_chk.json()["status"] == "completed"

    # CSV export
    csv_res = client.get(f"/api/replay/{session_id}/export.csv")
    assert csv_res.status_code == 200
    assert "mq4_gas" in csv_res.text

    # Diagnostic report
    rpt_res = client.get(f"/api/replay/{session_id}/report")
    assert rpt_res.status_code == 200
    rpt_data = rpt_res.json()
    assert rpt_data["trainee"]["name"] == "Sam Taylor"
    assert rpt_data["assessment"]["total_score"] >= 80.0
