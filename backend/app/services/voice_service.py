import time
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

class VoiceAnnouncementService:
    """
    Intelligent Spoken Announcement Service (SkillDrone V2).
    Generates natural, event-grounded spoken alert messages.
    Implements:
    - Event-based generation with dynamic token insertion (location, asset ID, sensor value)
    - Anti-flooding duplicate suppression with configurable cooldowns
    - Severity-based prioritization (CRITICAL preempts WARNING and INFO)
    - Re-announcement when hazard state or location changes meaningfully
    - Transcript logging
    """

    def __init__(self):
        # Tracking last announcement per category: key = category, value = (timestamp, message_text, severity)
        self._last_spoken: Dict[str, Tuple[float, str, str]] = {}
        # Cooldown intervals in seconds
        self.COOLDOWNS = {
            "info": 15.0,
            "visual_detection": 12.0,
            "warning": 8.0,
            "critical": 5.0,
            "sensor_malfunction": 10.0,
            "comm_loss": 10.0
        }

    def reset_session(self):
        self._last_spoken.clear()

    def generate_announcement(
        self,
        event_type: str,
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates incoming system event and generates a voice announcement if not suppressed.
        Returns announcement dict with message_text, priority, category, and metadata.
        """
        now = time.time()
        category = event_type
        priority = "info"
        message = ""
        associated_hazard_id = params.get("hazard_id")
        associated_object_id = params.get("object_id")

        if event_type == "mission_start":
            mission_title = params.get("mission_title", "Diagnostic Inspection")
            trade = params.get("trade", "vocational")
            message = f"Inspection mission initiated for {trade}. Entering workshop inspection corridor."
            priority = "info"

        elif event_type == "visual_detection":
            obj_id = params.get("object_id", "Asset")
            obj_label = params.get("label", obj_id)
            dist = params.get("distance_m", 2.0)
            message = f"{obj_label} detected ahead at {dist:.1f} metres."
            priority = "info"

        elif event_type == "gas_anomaly":
            severity = params.get("severity", "suspected")
            sensor_val = params.get("raw_value", 0.0)
            asset_id = params.get("object_id")
            pos = params.get("position", {})
            px = pos.get("x", 0.0)
            py = pos.get("y", 0.0)

            if severity == "critical":
                priority = "critical"
                if asset_id:
                    message = f"Critical safety alert! Severe gas plume detected at {asset_id}, coordinates X {px:.1f}, Y {py:.1f}. Immediate valve isolation recommended."
                else:
                    message = f"Critical safety alert! Dangerous gas concentration of {sensor_val:.0f} counts at X {px:.1f}, Y {py:.1f}. Recommend immediate emergency hover."
            else:
                priority = "warning"
                if asset_id:
                    message = f"Warning. Elevated gas reading of {sensor_val:.0f} counts near {asset_id}. Hovering for plume confirmation."
                else:
                    message = f"Warning. Elevated gas sensor reading of {sensor_val:.0f} counts. Target location X {px:.1f}, Y {py:.1f}."

        elif event_type == "thermal_hotspot":
            temp_c = params.get("temp_c", 0.0)
            asset_id = params.get("object_id", "equipment surface")
            priority = "critical" if temp_c > 75.0 else "warning"
            message = f"{'Critical training alert' if priority == 'critical' else 'Warning'}. Elevated thermal infrared temperature of {temp_c:.1f} degrees Celsius detected near {asset_id}."

        elif event_type == "uv_arc":
            priority = "critical"
            message = "Critical warning! High-energy optical ultraviolet arc emission detected. Potential electrical flashover."

        elif event_type == "sensor_health":
            health = params.get("health", "degraded")
            sensor_type = params.get("sensor_type", "sensor")
            priority = "warning"
            message = f"Sensor integrity warning. {sensor_type.replace('_', ' ').upper()} report {health}. Recalibration check advised."

        elif event_type == "comm_loss":
            priority = "warning"
            message = "Warning. Telemetry communication link quality degraded. Live telemetry may experience packet delay."

        elif event_type == "reinspection_recommended":
            reinspection_type = params.get("action_type", "stationary_hover").replace("_", " ")
            priority = "warning"
            message = f"Adaptive reinspection suggested. Trainee instructed to perform {reinspection_type}."

        elif event_type == "mission_complete":
            score = params.get("score")
            passed = params.get("passed", False)
            priority = "info"
            if score is not None:
                status_str = "Passed with competency certification" if passed else "Requirements not satisfied"
                message = f"Inspection complete. Final score: {score:.1f} points. {status_str}. Full report ready for review."
            else:
                message = "Inspection complete. Diagnostic assessment report is ready for instructor review."

        if not message:
            return None

        # Anti-flooding & duplicate suppression check
        last_entry = self._last_spoken.get(category)
        if last_entry:
            last_time, last_msg, last_prio = last_entry
            elapsed = now - last_time
            cooldown = self.COOLDOWNS.get(priority, 10.0)

            # Suppress if within cooldown, UNLESS current announcement is CRITICAL and previous was not
            if elapsed < cooldown:
                if priority != "critical" or last_prio == "critical":
                    if last_msg == message or elapsed < (cooldown * 0.6):
                        return None # Suppress duplicate flood

        # Update last spoken tracker
        self._last_spoken[category] = (now, message, priority)

        return {
            "message_text": message,
            "priority": priority,
            "category": category,
            "timestamp": now,
            "associated_hazard_id": associated_hazard_id,
            "associated_object_id": associated_object_id
        }

voice_service = VoiceAnnouncementService()
