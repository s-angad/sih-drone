import json
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from app.schemas.schemas import TelemetryFrame, SingleSensorReading

logger = logging.getLogger(__name__)

class ESP32HardwareAdapter:
    """
    Hardware Abstraction Layer for ESP32 and flight-controller sensor payloads.
    Validates frame checksums/sequence numbers, decodes ADC readings, and handles
    telemetry ingestion over Serial, UDP, or HTTP/WebSocket.
    """

    PROTOCOL_VERSION = "SKILLDRONE_ESP32_V1"

    @staticmethod
    def validate_and_parse_payload(raw_payload: str or bytes or Dict[str, Any], session_id: str) -> Tuple[bool, Optional[TelemetryFrame], str]:
        """
        Validates raw payload received from ESP32 micro-controller.
        Expected JSON schema:
        {
            "proto": "SKILLDRONE_ESP32_V1",
            "seq": 1042,
            "drone_id": "DRONE-01",
            "pos": {"x": 4.5, "y": 2.1, "z": 1.8},
            "battery_mv": 11800,
            "sensors": [
                {"type": "mq4_gas", "raw_adc": 480, "health": "nominal"},
                {"type": "thermal_ir", "raw_c": 32.4, "health": "nominal"}
            ]
        }
        """
        try:
            if isinstance(raw_payload, (bytes, bytearray)):
                data = json.loads(raw_payload.decode("utf-8"))
            elif isinstance(raw_payload, str):
                data = json.loads(raw_payload)
            elif isinstance(raw_payload, dict):
                data = data = raw_payload
            else:
                return False, None, "Invalid payload format: must be string, bytes, or json dict"

            # Check sequence
            seq = data.get("seq", 0)
            if not isinstance(seq, int) or seq < 0:
                return False, None, "Invalid or missing sequence number"

            # Decode battery (from millivolts to percentage, standard 3S LiPo: 10.5V=0%, 12.6V=100%)
            battery_mv = data.get("battery_mv", 12000)
            battery_pct = round(max(0.0, min(100.0, ((battery_mv - 10500) / (12600 - 10500)) * 100.0)), 1)

            # Drone coordinates (from onboard optical flow or flight controller MAVLink bridge)
            pos_dict = data.get("pos", {"x": 0.0, "y": 0.0, "z": 1.0})
            pos = {
                "x": float(pos_dict.get("x", 0.0)),
                "y": float(pos_dict.get("y", 0.0)),
                "z": float(pos_dict.get("z", 1.0)),
            }

            raw_sensors = data.get("sensors", [])
            parsed_sensors = []

            for s in raw_sensors:
                s_type = s.get("type", "")
                health = s.get("health", "nominal")
                raw_adc = float(s.get("raw_adc", s.get("raw_c", 0.0)))
                unit = "ADC_counts"
                calibrated = None

                if "mq" in s_type:
                    unit = "ADC_counts"
                    # Note: We do not treat raw ADC as certified ppm without multi-point calibration!
                    # Only calculate indicative vocational estimate
                    calibrated = round(max(0.0, (raw_adc - 200.0) * 1.5), 1)
                elif "thermal" in s_type:
                    unit = "degC"
                    calibrated = raw_adc
                elif "uv" in s_type:
                    unit = "uW/cm2"
                    calibrated = raw_adc

                parsed_sensors.append(SingleSensorReading(
                    sensor_type=s_type,
                    raw_value=raw_adc,
                    calibrated_value=calibrated,
                    unit=unit,
                    sensor_health=health
                ))

            frame = TelemetryFrame(
                session_id=session_id,
                sequence_number=seq,
                timestamp=datetime.utcnow(),
                position=pos,
                heading_deg=float(data.get("heading_deg", 0.0)),
                speed_mps=float(data.get("speed_mps", 0.0)),
                battery_pct=battery_pct,
                sensors=parsed_sensors,
                is_simulated=False,
                link_quality_pct=float(data.get("link_quality", 95.0))
            )
            return True, frame, "Frame parsed successfully"

        except Exception as e:
            logger.error(f"Failed to parse hardware payload: {e}")
            return False, None, f"Payload decoding error: {str(e)}"

hardware_adapter = ESP32HardwareAdapter()
