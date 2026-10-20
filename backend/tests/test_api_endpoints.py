from fastapi.testclient import TestClient

def test_health_check(client: TestClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "disclaimer" in data

def test_dashboard_stats(client: TestClient):
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_training_sessions" in data
    assert "total_trainees_count" in data
    assert "mission_completion_rate" in data

def test_trainee_crud(client: TestClient):
    # Create trainee
    payload = {
        "trainee_code": "TR-TEST-999",
        "name": "Jordan Lee",
        "email": "jordan.lee@trade.edu",
        "trade_specialization": "plumbing",
        "notes": "Testing trainee profile"
    }
    create_res = client.post("/api/trainees", json=payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # Duplicate check
    dup_res = client.post("/api/trainees", json=payload)
    assert dup_res.status_code == 400

    # Read trainee
    get_res = client.get(f"/api/trainees/{created_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Jordan Lee"

    # Update trainee
    upd_res = client.put(f"/api/trainees/{created_id}", json={"name": "Jordan M. Lee"})
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Jordan M. Lee"

    # Delete trainee
    del_res = client.delete(f"/api/trainees/{created_id}")
    assert del_res.status_code == 200
