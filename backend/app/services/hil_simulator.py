import time
import random
from typing import Dict, Any, List, Optional
from app.services.hardware_adapter import hardware_adapter

class HardwareInTheLoopSimulator:
    """
    Hardware-in-the-Loop (HIL) Simulator for SkillDrone.
    Simulates physical ESP32 payload micro-controller behavior, transmitting
    standard SKILLDRONE_ESP32_V1 JSON telemetry frames over HTTP/UART.
    Used for automated CI/CD hardware testing and edge-case fault injection.
    """

    def __init__(self, session_id: str = "HIL-SIM-SESSION"):
        self.session_id = session_id
        self.seq_num = 0
        self.battery_mv = 12400 # 3S LiPo starting at 12.4V
        self.pos_x = 2.0
        self.pos_y = 2.0
        self.pos_z = 1.5

    def generate_frame(
        self,
        scenario: str = "nominal",
        custom_pos: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Generates a valid SKILLDRONE_ESP32_V1 frame.
        Scenarios:
        - "nominal": clean baseline signals, healthy sensors
        - "gas_leak": elevated MQ-4 ADC counts
        - "co_hazard": elevated MQ-7 ADC counts
        - "thermal_hotspot": elevated MLX90614 temperature
        - "uv_arc": elevated UV photodiode reading
        - "sensor_disconnect": MQ-4 railed to GND (raw_adc = 0)
        - "sensor_saturation": MQ-4 railed to VCC (raw_adc = 4095)
        """
        self.seq_num += 1
        # LiPo discharge ~ 0.5mV per tick
        self.battery_mv = max(10500, self.battery_mv - 1)

        if custom_pos:
            self.pos_x = custom_pos.get("x", self.pos_x)
            self.pos_y = custom_pos.get("y", self.pos_y)
            self.pos_z = custom_pos.get("z", self.pos_z)

        # Baseline readings
        mq4_adc = int(random.gauss(240, 10))
        mq7_adc = int(random.gauss(210, 8))
        temp_c = round(random.gauss(24.5, 0.4), 1)
        uv_adc = int(random.gauss(15, 3))

        mq4_health = "nominal"
        mq7_health = "nominal"
        thermal_health = "nominal"
        uv_health = "nominal"

        if scenario == "gas_leak":
            mq4_adc = int(random.gauss(820, 25))
        elif scenario == "co_hazard":
            mq7_adc = int(random.gauss(760, 20))
        elif scenario == "thermal_hotspot":
            temp_c = round(random.gauss(84.0, 1.5), 1)
        elif scenario == "uv_arc":
            uv_adc = int(random.gauss(65, 8))
        elif scenario == "sensor_disconnect":
            mq4_adc = 2
            mq4_health = "disconnected"
        elif scenario == "sensor_saturation":
            mq4_adc = 4094
            mq4_health = "degraded"

        return {
            "proto": "SKILLDRONE_ESP32_V1",
            "seq": self.seq_num,
            "drone_id": "DRONE-HIL-01",
            "session_id": self.session_id,
            "battery_mv": self.battery_mv,
            "link_quality": 98.0,
            "pos": {
                "x": round(self.pos_x, 2),
                "y": round(self.pos_y, 2),
                "z": round(self.pos_z, 2)
            },
            "heading_deg": 45.0,
            "speed_mps": 0.8,
            "sensors": [
                {"type": "mq4_gas", "raw_adc": mq4_adc, "health": mq4_health},
                {"type": "mq7_co", "raw_adc": mq7_adc, "health": mq7_health},
                {"type": "thermal_ir", "raw_c": temp_c, "health": thermal_health},
                {"type": "uv_flame", "raw_adc": uv_adc, "health": uv_health}
            ]
        }

    def run_validation_sequence(self, num_frames: int = 10) -> Dict[str, Any]:
        """Runs a sequence of frames and validates decoding and parsing consistency"""
        valid_frames = 0
        errors = []

        for i in range(num_frames):
            frame_dict = self.generate_frame("nominal")
            is_valid, parsed_frame, msg = hardware_adapter.validate_and_parse_payload(frame_dict, self.session_id)
            if is_valid and parsed_frame:
                valid_frames += 1
            else:
                errors.append(f"Frame {i+1} failed: {msg}")

        return {
            "total_tested": num_frames,
            "valid_frames": valid_frames,
            "success_rate_pct": round((valid_frames / num_frames) * 100.0, 1),
            "errors": errors
        }

hil_simulator = HardwareInTheLoopSimulator()
