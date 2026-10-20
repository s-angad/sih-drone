import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.database import get_db, SessionLocal
from app.models.models import (
    TrainingSession,
    SensorEvent,
    HazardEvent,
    VisionObservation,
    CameraEvidenceFrame,
    VoiceAnnouncement,
)
from app.schemas.schemas import (
    TelemetryFrame,
    CameraState,
    VisionObservationResponse,
    FusionResult,
)
from app.services.hazard_detector import hazard_detector
from app.services.reinspection_engine import reinspection_engine
from app.services.vision_providers import vision_manager
from app.services.fusion_engine import fusion_engine
from app.services.voice_service import voice_service
from app.routers.sessions import get_active_simulator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telemetry", tags=["Live Telemetry & WebSockets"])

@router.post("/ingest")
def ingest_telemetry_frame(frame: TelemetryFrame, db: Session = Depends(get_db)):
    """REST endpoint for single telemetry frame ingestion (simulated or ESP32)"""
    session = db.query(TrainingSession).filter(TrainingSession.id == frame.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Persist sensor events
    hazard_events_logged = []
    for s in frame.sensors:
        event = SensorEvent(
            session_id=frame.session_id,
            sequence_number=frame.sequence_number,
            timestamp=frame.timestamp,
            sensor_type=s.sensor_type,
            raw_value=s.raw_value,
            calibrated_value=s.calibrated_value,
            measurement_unit=s.unit,
            position_x=frame.position["x"],
            position_y=frame.position["y"],
            position_z=frame.position["z"],
            drone_heading=frame.heading_deg,
            drone_speed=frame.speed_mps,
            sensor_health=s.sensor_health,
            is_simulated=frame.is_simulated
        )
        db.add(event)

        # Hazard detection
        hazard_result = hazard_detector.process_reading(
            session_id=frame.session_id,
            sensor_type=s.sensor_type,
            raw_value=s.raw_value,
            position=frame.position,
            calibrated_value=s.calibrated_value
        )
        if hazard_result and hazard_result.get("is_database_event", False):
            h_event = HazardEvent(
                session_id=frame.session_id,
                sensor_type=s.sensor_type,
                raw_value=hazard_result["raw_value"],
                calibrated_value=hazard_result["calibrated_value"],
                measurement_unit=hazard_result["unit"],
                position_x=frame.position["x"],
                position_y=frame.position["y"],
                position_z=frame.position["z"],
                sensor_health=hazard_result["sensor_health"],
                rule_name=hazard_result["rule_name"],
                severity=hazard_result["severity"],
                confidence=hazard_result["confidence"],
                details=hazard_result["details"]
            )
            db.add(h_event)
            hazard_events_logged.append(hazard_result)

    db.commit()
    return {"status": "ok", "hazards_detected": len(hazard_events_logged)}


@router.websocket("/ws/{session_id}")
async def websocket_telemetry_stream(websocket: WebSocket, session_id: str):
    """
    Real-time bidirectional WebSocket stream for live drone flight path,
    sensor gauges, hazard detection alerts, and adaptive reinspection cues.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected for session {session_id}")

    db = SessionLocal()
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        db.close()
        return

    camera_pitch = -15.0
    camera_zoom = 1.0

    # Extract scenario workshop layout if configured
    scenario_layout = {}
    if session.mission and session.mission.scenario and session.mission.scenario.environment_layout_json:
        try:
            scenario_layout = json.loads(session.mission.scenario.environment_layout_json)
        except Exception:
            scenario_layout = {}

    try:
        while True:
            # Check if client sent an upstream command (pause, steer, hover, snapshot, etc.)
            try:
                client_msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                data = json.loads(client_msg)
                action = data.get("action")
                sim = get_active_simulator(session_id)
                if sim:
                    if action == "steer":
                        sim.set_target_waypoint(data.get("x", 0.0), data.get("y", 0.0), data.get("z", 1.8))
                    elif action == "pause":
                        sim.pause()
                    elif action == "resume":
                        sim.resume()
                
                if action == "camera_pitch":
                    camera_pitch = float(data.get("pitch_deg", -15.0))
                elif action == "camera_zoom":
                    camera_zoom = float(data.get("zoom", 1.0))
                elif action == "set_vision_provider":
                    vision_manager.set_active_provider(data.get("provider", "simulation_vision_provider"))
                elif action == "snapshot":
                    # Manual evidence snapshot capture
                    ev_snap = CameraEvidenceFrame(
                        session_id=session_id,
                        trigger_event_type="manual_snapshot",
                        drone_pos_x=data.get("x", 0.0),
                        drone_pos_y=data.get("y", 0.0),
                        drone_pos_z=data.get("z", 1.8),
                        drone_heading_deg=data.get("heading", 0.0),
                        drone_pitch_deg=camera_pitch,
                        associated_object_id=data.get("associated_object_id"),
                        annotations_json=json.dumps(data.get("annotations", [])),
                        image_data_url=data.get("image_data_url")
                    )
                    db.add(ev_snap)
                    db.commit()
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

            # Refresh session status from DB periodically
            db.refresh(session)
            if session.status == "completed" or session.status == "aborted":
                await websocket.send_json({
                    "type": "SESSION_STATUS",
                    "status": session.status,
                    "message": "Session has terminated"
                })
                break

            if session.status == "in_progress":
                sim = get_active_simulator(session_id)
                if sim:
                    # Execute simulation physics tick
                    frame = sim.tick(dt=0.5)

                    # Compute Scene-Grounded Computer Vision Detections
                    cam_state = {
                        "x": frame.position["x"],
                        "y": frame.position["y"],
                        "z": frame.position["z"],
                        "heading_deg": frame.heading_deg,
                        "pitch_deg": camera_pitch,
                        "fov_deg": 70.0
                    }
                    raw_vis_obs = vision_manager.get_active_provider().detect_objects(cam_state, scenario_layout)
                    
                    frame.camera = CameraState(
                        fov_deg=70.0,
                        pitch_deg=camera_pitch,
                        heading_deg=frame.heading_deg,
                        zoom=camera_zoom,
                        status="active",
                        mode=session.data_source
                    )
                    frame.visible_objects = [VisionObservationResponse(**vo) for vo in raw_vis_obs]

                    # Periodic vision observation persistence (every 6 ticks ~ 3s)
                    if frame.sequence_number % 6 == 0 and raw_vis_obs:
                        for vo in raw_vis_obs[:3]:
                            db.add(VisionObservation(
                                session_id=session_id,
                                frame_sequence=frame.sequence_number,
                                object_class=vo["object_class"],
                                object_id=vo.get("object_id"),
                                confidence=vo.get("confidence", 0.85),
                                bbox_x_min=vo["bbox_x_min"],
                                bbox_y_min=vo["bbox_y_min"],
                                bbox_x_max=vo["bbox_x_max"],
                                bbox_y_max=vo["bbox_y_max"],
                                workshop_x=vo.get("workshop_x"),
                                workshop_y=vo.get("workshop_y"),
                                workshop_z=vo.get("workshop_z"),
                                drone_distance_m=vo.get("drone_distance_m"),
                                vision_provider=vo.get("vision_provider", "simulation_vision_provider"),
                                notes=vo.get("notes")
                            ))

                    # Persist sensor events in DB
                    new_hazards = []
                    for s in frame.sensors:
                        # Log sensor event
                        db.add(SensorEvent(
                            session_id=session_id,
                            sequence_number=frame.sequence_number,
                            sensor_type=s.sensor_type,
                            raw_value=s.raw_value,
                            calibrated_value=s.calibrated_value,
                            measurement_unit=s.unit,
                            position_x=frame.position["x"],
                            position_y=frame.position["y"],
                            position_z=frame.position["z"],
                            drone_heading=frame.heading_deg,
                            drone_speed=frame.speed_mps,
                            sensor_health=s.sensor_health,
                            is_simulated=True
                        ))

                        # Evaluate real-time hazard detection
                        h_res = hazard_detector.process_reading(
                            session_id=session_id,
                            sensor_type=s.sensor_type,
                            raw_value=s.raw_value,
                            position=frame.position,
                            calibrated_value=s.calibrated_value
                        )
                        
                        # Sensor & Vision Fusion
                        fusion_info = {}
                        if h_res and h_res.get("severity") in ("suspected", "critical"):
                            fusion_info = fusion_engine.fuse_hazard_with_vision(h_res, raw_vis_obs, frame.position)
                            if fusion_info.get("associated_object_id"):
                                h_res["associated_object_id"] = fusion_info["associated_object_id"]
                                frame.fusion = FusionResult(**fusion_info)

                        if h_res and h_res.get("is_database_event", False):
                            h_event = HazardEvent(
                                session_id=session_id,
                                sensor_type=s.sensor_type,
                                raw_value=h_res["raw_value"],
                                calibrated_value=h_res["calibrated_value"],
                                measurement_unit=h_res["unit"],
                                position_x=frame.position["x"],
                                position_y=frame.position["y"],
                                position_z=frame.position["z"],
                                sensor_health=h_res["sensor_health"],
                                rule_name=h_res["rule_name"],
                                severity=h_res["severity"],
                                confidence=h_res["confidence"],
                                details=h_res["details"],
                                associated_object_id=fusion_info.get("associated_object_id")
                            )
                            db.add(h_event)

                        if h_res and h_res.get("severity") in ("suspected", "critical"):
                            new_hazards.append(h_res)

                    # Voice Announcements & Audio Alerts
                    announcements_to_send = []
                    if new_hazards:
                        for h_res in new_hazards:
                            s_type = h_res.get("sensor_type", "")
                            ev_type = "gas_anomaly" if "gas" in s_type else ("thermal_hotspot" if "thermal" in s_type else "uv_arc")
                            ann = voice_service.generate_announcement(ev_type, {
                                "severity": h_res["severity"],
                                "raw_value": h_res["raw_value"],
                                "object_id": h_res.get("associated_object_id"),
                                "position": frame.position,
                                "hazard_id": h_res.get("id"),
                                "temp_c": h_res["raw_value"] if "thermal" in s_type else 0.0
                            })
                            if ann:
                                announcements_to_send.append(ann)
                                db.add(VoiceAnnouncement(
                                    session_id=session_id,
                                    message_text=ann["message_text"],
                                    priority=ann["priority"],
                                    category=ann["category"],
                                    spoken_successfully=True,
                                    associated_hazard_id=ann.get("associated_hazard_id"),
                                    associated_object_id=ann.get("associated_object_id")
                                ))

                                # Auto-capture Camera Evidence Snapshot on Critical Alert or Correlated Hazard
                                if h_res["severity"] == "critical" or h_res.get("associated_object_id"):
                                    db.add(CameraEvidenceFrame(
                                        session_id=session_id,
                                        trigger_event_type="hazard_alert",
                                        hazard_event_id=h_res.get("id"),
                                        drone_pos_x=frame.position["x"],
                                        drone_pos_y=frame.position["y"],
                                        drone_pos_z=frame.position["z"],
                                        drone_heading_deg=frame.heading_deg,
                                        drone_pitch_deg=camera_pitch,
                                        associated_object_id=h_res.get("associated_object_id"),
                                        fused_sensor_summary=json.dumps({s.sensor_type: s.raw_value for s in frame.sensors}),
                                        annotations_json=json.dumps(raw_vis_obs[:4]),
                                        image_data_url=None
                                    ))

                    db.commit()

                    # Generate adaptive reinspection recommendations
                    recs = []
                    if new_hazards:
                        for h in new_hazards:
                            recs.extend(reinspection_engine.generate_recommendations(
                                hazard_event=h,
                                drone_speed=frame.speed_mps,
                                recent_readings_count=frame.sequence_number
                            ))

                    # Send payload to client
                    await websocket.send_json({
                        "type": "TELEMETRY",
                        "frame": frame.model_dump(mode="json"),
                        "hazards": new_hazards,
                        "recommendations": [r.model_dump(mode="json") for r in recs],
                        "announcements": announcements_to_send,
                        "session_status": session.status,
                        "battery_pct": frame.battery_pct
                    })

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        db.close()
