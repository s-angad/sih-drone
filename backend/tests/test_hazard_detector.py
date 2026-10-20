import pytest
from app.services.hazard_detector import HazardDetectionEngine

def test_sensor_health_detection():
    engine = HazardDetectionEngine()

    # Railed ADC low -> disconnected
    health, note = engine.evaluate_sensor_health("mq4_gas", 2.0)
    assert health == "disconnected"

    # Railed ADC high -> degraded
    health, note = engine.evaluate_sensor_health("mq4_gas", 4094.0)
    assert health == "degraded"

    # Normal reading
    health, note = engine.evaluate_sensor_health("mq4_gas", 280.0)
    assert health == "nominal"

    # Extreme slew rate -> noisy
    health, note = engine.evaluate_sensor_health("mq4_gas", 900.0, prev_value=250.0)
    assert health == "noisy"

def test_persistence_filtering():
    engine = HazardDetectionEngine()
    session_id = "test-session-persistence"

    # Single isolated elevated spike should not immediately trigger critical alert if persistence requires multiple samples
    res1 = engine.process_reading(session_id, "mq4_gas", 440.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    assert res1 is not None
    assert res1["severity"] in ("suspected", "critical")

    # Consecutive critical readings trigger critical classification
    engine.process_reading(session_id, "mq4_gas", 820.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    res_crit = engine.process_reading(session_id, "mq4_gas", 850.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    assert res_crit is not None
    assert res_crit["severity"] == "critical"
    assert res_crit["confidence"] >= 0.85

def test_thermal_thresholds():
    engine = HazardDetectionEngine()
    session_id = "test-thermal"

    # Normal temp (30C) -> returns None (no hazard emitted)
    res_norm = engine.process_reading(session_id, "thermal_ir", 30.0, {"x": 2.0, "y": 2.0, "z": 1.0})
    assert res_norm is None

    # Suspected hotspot (54C)
    res_sus = engine.process_reading(session_id, "thermal_ir", 54.0, {"x": 2.0, "y": 2.0, "z": 1.0})
    assert res_sus is not None
    assert res_sus["severity"] == "suspected"

    # Critical hotspot (85C)
    engine.process_reading(session_id, "thermal_ir", 85.0, {"x": 2.0, "y": 2.0, "z": 1.0})
    res_crit = engine.process_reading(session_id, "thermal_ir", 88.0, {"x": 2.0, "y": 2.0, "z": 1.0})
    assert res_crit is not None
    assert res_crit["severity"] == "critical"

def test_alert_lifecycle_and_hysteresis():
    engine = HazardDetectionEngine()
    session_id = "test-lifecycle"

    # 1. First elevated reading -> transitions to new alert (is_database_event = True)
    r1 = engine.process_reading(session_id, "mq4_gas", 450.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    assert r1 is not None
    assert r1["lifecycle_state"] == "new"
    assert r1["is_database_event"] is True
    assert "v2.1" in r1["rule_version"]

    # 2. Second elevated reading -> persistent (is_database_event = False, no duplicate DB row!)
    r2 = engine.process_reading(session_id, "mq4_gas", 460.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    assert r2 is not None
    assert r2["lifecycle_state"] == "persistent"
    assert r2["is_database_event"] is False

    # 3. Reading within hysteresis margin (e.g. 400.0, where threshold is 420 and clear is 385)
    r3 = engine.process_reading(session_id, "mq4_gas", 400.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    # Remains in suspected/persistent state due to hysteresis
    assert r3 is not None
    assert r3["lifecycle_state"] == "persistent"

    # 4. Readings well below clear threshold (< 385.0) for 2 consecutive samples
    engine.process_reading(session_id, "mq4_gas", 300.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    r_cleared = engine.process_reading(session_id, "mq4_gas", 290.0, {"x": 5.0, "y": 5.0, "z": 1.5})
    # Alarm is now cleared! Returns None (no active hazard)
    assert r_cleared is None

