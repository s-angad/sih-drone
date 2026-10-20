from fastapi.testclient import TestClient
from app.config import settings

def test_ground_truth_not_in_trainee_mission_endpoint(client: TestClient):
    # Fetch list of missions
    res = client.get("/api/missions")
    assert res.status_code == 200
    missions = res.json()
    assert len(missions) > 0

    for m in missions:
        # Crucial: hidden_faults must NOT be present in mission payload
        assert "hidden_faults" not in m
        assert "hidden_faults_json" not in m
        assert "scenario" not in m

    # Fetch single mission
    m_id = missions[0]["id"]
    res_single = client.get(f"/api/missions/{m_id}")
    assert res_single.status_code == 200
    data = res_single.json()
    assert "hidden_faults" not in data

def test_ground_truth_scenario_requires_trainer_auth(client: TestClient):
    res = client.get("/api/missions")
    m_id = res.json()[0]["id"]

    # 1. Unauthenticated or wrong token must fail with 401 Unauthorized
    res_unauth = client.get(f"/api/missions/{m_id}/scenario")
    assert res_unauth.status_code == 401

    res_bad_token = client.get(
        f"/api/missions/{m_id}/scenario",
        headers={"x-trainer-token": "wrong-token-123"}
    )
    assert res_bad_token.status_code == 401

    # 2. Authenticated trainer token provides ground truth for instructors / evaluation
    res_scen = client.get(
        f"/api/missions/{m_id}/scenario",
        headers={"x-trainer-token": settings.DEMO_AUTH_TOKEN}
    )
    assert res_scen.status_code == 200
    scenario_data = res_scen.json()
    assert "hidden_faults" in scenario_data
    assert len(scenario_data["hidden_faults"]) > 0

def test_replay_ground_truth_isolation(client: TestClient):
    # Create or fetch a session
    trainees = client.get("/api/trainees").json()
    missions = client.get("/api/missions").json()
    t_id = trainees[0]["id"]
    m_id = missions[0]["id"]

    create_res = client.post("/api/sessions", json={
        "trainee_id": t_id,
        "mission_id": m_id,
        "data_source": "simulated"
    })
    assert create_res.status_code == 201
    session_id = create_res.json()["id"]

    # Replay while in_progress without trainer token -> ground_truth_faults MUST be empty
    replay_trainee = client.get(f"/api/replay/{session_id}")
    assert replay_trainee.status_code == 200
    assert replay_trainee.json()["ground_truth_faults"] == []

    # Replay with trainer token -> ground_truth_faults revealed
    replay_trainer = client.get(
        f"/api/replay/{session_id}",
        headers={"x-trainer-token": settings.DEMO_AUTH_TOKEN}
    )
    assert replay_trainer.status_code == 200
    assert len(replay_trainer.json()["ground_truth_faults"]) > 0
