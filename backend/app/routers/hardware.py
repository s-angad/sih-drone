from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database import get_db
from app.models.models import TrainingSession
from app.services.hardware_adapter import hardware_adapter
from app.routers.telemetry import ingest_telemetry_frame

router = APIRouter(prefix="/api/hardware", tags=["Hardware Integration (ESP32)"])

@router.get("/status")
def get_hardware_interface_status():
    """Returns connectivity and protocol specification for ESP32 and flight controller telemetry"""
    return {
        "status": "ready",
        "supported_protocols": ["HTTP_POST", "WEBSOCKET", "SERIAL_UART_MAVLINK_BRIDGE"],
        "version": hardware_adapter.PROTOCOL_VERSION,
        "supported_sensors": ["mq4_gas", "mq7_co", "thermal_ir", "uv_flame"],
        "voltage_range_mv": {"min": 10500, "max": 12600, "type": "3S LiPo"},
        "baud_rate": 115200,
        "note": "Connect ESP32 via Serial or WiFi to POST /api/hardware/telemetry with valid session_id."
    }

@router.post("/telemetry")
def ingest_esp32_telemetry(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """
    Ingests raw JSON telemetry payload from ESP32 payload controller.
    Validates frame schema, sequence numbers, and sensor health before processing.
    """
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing required 'session_id' in payload")

    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Training session '{session_id}' not found")

    is_valid, frame, msg = hardware_adapter.validate_and_parse_payload(payload, session_id)
    if not is_valid or not frame:
        raise HTTPException(status_code=422, detail=f"Hardware payload validation failure: {msg}")

    # Process frame through standard telemetry ingestion pipeline
    res = ingest_telemetry_frame(frame, db)
    return {
        "status": "success",
        "sequence": frame.sequence_number,
        "hazards_triggered": res.get("hazards_detected", 0),
        "message": msg
    }
