from app.services.hardware_adapter import ESP32HardwareAdapter

def test_hardware_payload_parsing():
    adapter = ESP32HardwareAdapter()
    raw = {
        "proto": "SKILLDRONE_ESP32_V1",
        "seq": 102,
        "drone_id": "DRONE-ALPHA",
        "battery_mv": 12200, # ~81% on 3S
        "pos": {"x": 3.4, "y": 7.1, "z": 1.8},
        "heading_deg": 45.0,
        "speed_mps": 0.8,
        "sensors": [
            {"type": "mq4_gas", "raw_adc": 520, "health": "nominal"},
            {"type": "thermal_ir", "raw_c": 28.5, "health": "nominal"}
        ]
    }

    ok, frame, msg = adapter.validate_and_parse_payload(raw, session_id="ses-hw-1")
    assert ok is True
    assert frame is not None
    assert frame.sequence_number == 102
    assert frame.battery_pct > 75.0
    assert frame.position["x"] == 3.4
    assert len(frame.sensors) == 2
    assert frame.is_simulated is False

def test_hardware_corrupted_payload():
    adapter = ESP32HardwareAdapter()
    # Invalid missing sequence
    ok, frame, msg = adapter.validate_and_parse_payload("not-json", "ses-1")
    assert ok is False
    assert frame is None
