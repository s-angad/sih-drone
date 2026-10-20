import pytest
from app.services.hil_simulator import HardwareInTheLoopSimulator
from app.services.hardware_adapter import hardware_adapter

def test_hil_simulator_frame_generation():
    hil = HardwareInTheLoopSimulator("test-hil-ses")
    
    # 1. Nominal frame
    frame = hil.generate_frame("nominal")
    assert frame["proto"] == "SKILLDRONE_ESP32_V1"
    assert frame["seq"] == 1
    assert len(frame["sensors"]) == 4

    # Validate against hardware adapter
    valid, parsed, msg = hardware_adapter.validate_and_parse_payload(frame, "test-hil-ses")
    assert valid is True
    assert parsed is not None
    assert parsed.sequence_number == 1
    assert parsed.battery_pct > 80.0

def test_hil_sensor_fault_injection():
    hil = HardwareInTheLoopSimulator("test-hil-faults")

    # Disconnect injection
    frame_disc = hil.generate_frame("sensor_disconnect")
    valid, parsed, msg = hardware_adapter.validate_and_parse_payload(frame_disc, "test-hil-faults")
    assert valid is True
    mq4_sensor = [s for s in parsed.sensors if s.sensor_type == "mq4_gas"][0]
    assert mq4_sensor.sensor_health == "disconnected"
    assert mq4_sensor.raw_value <= 5.0

    # Saturation injection
    frame_sat = hil.generate_frame("sensor_saturation")
    valid, parsed, msg = hardware_adapter.validate_and_parse_payload(frame_sat, "test-hil-faults")
    assert valid is True
    mq4_sensor = [s for s in parsed.sensors if s.sensor_type == "mq4_gas"][0]
    assert mq4_sensor.sensor_health == "degraded"
    assert mq4_sensor.raw_value >= 4090.0

def test_hil_sequence_validation():
    hil = HardwareInTheLoopSimulator("test-hil-seq")
    res = hil.run_validation_sequence(num_frames=20)
    assert res["total_tested"] == 20
    assert res["valid_frames"] == 20
    assert res["success_rate_pct"] == 100.0
