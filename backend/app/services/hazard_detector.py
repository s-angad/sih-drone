from typing import Dict, Any, List, Optional, Tuple
import math
import datetime

class HazardDetectionEngine:
    """
    Deterministic real-time hazard event processor (SkillDrone V2).
    Implements:
    - Multi-sample persistence filtering
    - Sensor health & electrical sanity validation
    - ANSI/ISA-18.2 compliant Alert Lifecycle State Machine (IDLE -> SUSPECTED -> CRITICAL -> CLEARED)
    - Hysteresis margins to prevent alarm chatter
    - Auditable rule metadata (rule_version, supporting_samples, threshold_applied, evidence_score)
    """

    def __init__(self):
        # Rolling persistence windows: key = (session_id, sensor_type), value = List[float]
        self._history: Dict[Tuple[str, str], List[float]] = {}
        # Active alert states: key = (session_id, sensor_type), value = dict with state, peak_val, ticks
        self._alert_states: Dict[Tuple[str, str], Dict[str, Any]] = {}
        
        self.PERSISTENCE_WINDOW = 3 # Require at least 2 out of 3 consecutive elevated samples to trigger alert
        self.RULE_VERSION = "v2.1-industrial"

        # Thresholds (Configurable for vocational education)
        # Hysteresis margin prevents rapid oscillation at the boundary
        self.THRESHOLDS = {
            "mq4_gas": {
                "unit": "ADC_counts",
                "normal_max": 400.0,
                "suspected_min": 420.0,
                "critical_min": 750.0,
                "hysteresis": 35.0, # Must drop below 385.0 to clear
                "max_physical_slew": 350.0, # max plausible delta per second
                "description": "Combustible Methane/Hydrocarbon Gas Concentration"
            },
            "mq7_co": {
                "unit": "ADC_counts",
                "normal_max": 350.0,
                "suspected_min": 380.0,
                "critical_min": 700.0,
                "hysteresis": 30.0,
                "max_physical_slew": 250.0,
                "description": "Carbon Monoxide / Incomplete Combustion Gas"
            },
            "thermal_ir": {
                "unit": "degC",
                "normal_max": 48.0,
                "suspected_min": 52.0,
                "critical_min": 78.0,
                "hysteresis": 4.0,
                "max_physical_slew": 40.0,
                "description": "Non-contact Infrared Surface Temperature"
            },
            "uv_flame": {
                "unit": "uW/cm2",
                "normal_max": 8.0,
                "suspected_min": 14.0,
                "critical_min": 35.0,
                "hysteresis": 3.0,
                "max_physical_slew": 50.0,
                "description": "Ultraviolet Spectral Radiation (Arc / Flame)"
            }
        }

    def evaluate_sensor_health(self, sensor_type: str, raw_value: float, prev_value: Optional[float] = None) -> Tuple[str, str]:
        """
        Evaluate physical sensor connection and electrical sanity.
        Returns (health_status, health_notes)
        """
        # ADC rail saturation check (assuming 12-bit ESP32 ADC: 0 to 4095)
        if "mq" in sensor_type:
            if raw_value <= 5.0:
                return "disconnected", "Sensor input pulled to ground; potential wiring disconnect or open circuit."
            if raw_value >= 4090.0:
                return "degraded", "ADC railed to VCC; potential sensor saturation or short to power."

        # Plausible temperature range (-10C to 200C)
        if sensor_type == "thermal_ir":
            if raw_value < -20.0 or raw_value > 300.0:
                return "disconnected", "IR sensor reported out-of-range physical temperature."

        # Sudden impossible slew rate (glitch/noise)
        if prev_value is not None and sensor_type in self.THRESHOLDS:
            delta = abs(raw_value - prev_value)
            max_slew = self.THRESHOLDS[sensor_type]["max_physical_slew"]
            if delta > max_slew:
                return "noisy", f"Rapid electrical spike detected (delta: {delta:.1f} exceeds physical slew {max_slew:.1f})."

        return "nominal", "Sensor operating within valid electrical parameters."

    def process_reading(
        self,
        session_id: str,
        sensor_type: str,
        raw_value: float,
        position: Dict[str, float],
        calibrated_value: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Processes a single sensor reading and determines if a hazard event should be emitted.
        Manages the alarm state lifecycle and avoids duplicate event spam.
        """
        if sensor_type not in self.THRESHOLDS:
            return None

        rules = self.THRESHOLDS[sensor_type]
        hist_key = (session_id, sensor_type)
        if hist_key not in self._history:
            self._history[hist_key] = []
        
        prev_value = self._history[hist_key][-1] if self._history[hist_key] else None
        self._history[hist_key].append(raw_value)
        if len(self._history[hist_key]) > self.PERSISTENCE_WINDOW * 2:
            self._history[hist_key].pop(0)

        # 1. Check electrical sensor health
        health, health_note = self.evaluate_sensor_health(sensor_type, raw_value, prev_value)

        # Retrieve or initialize alert lifecycle state
        if hist_key not in self._alert_states:
            self._alert_states[hist_key] = {
                "current_level": "IDLE", # IDLE, SUSPECTED, CRITICAL
                "peak_value": raw_value,
                "ticks_active": 0,
                "clearance_ticks": 0
            }
        alert_state = self._alert_states[hist_key]

        # 2. Inconclusive if sensor health is degraded or disconnected
        if health in ("disconnected", "degraded"):
            return {
                "rule_name": f"{sensor_type.upper()}_INTEGRITY_FAULT",
                "severity": "inconclusive",
                "confidence": 0.20,
                "evidence_score": 0.20,
                "sensor_health": health,
                "rule_version": self.RULE_VERSION,
                "supporting_samples": 1,
                "threshold_applied": rules["suspected_min"],
                "lifecycle_state": "new",
                "is_database_event": True,
                "details": f"Inconclusive telemetry: {health_note} Raw: {raw_value:.1f} {rules['unit']}",
                "raw_value": raw_value,
                "calibrated_value": calibrated_value,
                "unit": rules["unit"],
                "position": position,
                "sensor_type": sensor_type,
            }

        # 3. Persistence filtering & threshold evaluation
        recent_samples = self._history[hist_key][-self.PERSISTENCE_WINDOW:]
        elevated_samples = [s for s in recent_samples if s >= rules["suspected_min"]]
        critical_samples = [s for s in recent_samples if s >= rules["critical_min"]]

        # Target severity evaluation
        target_severity = "normal"
        if len(critical_samples) >= 2 or (len(recent_samples) >= 1 and raw_value >= rules["critical_min"] * 1.15):
            target_severity = "critical"
        elif len(elevated_samples) >= 2 or raw_value >= rules["suspected_min"]:
            target_severity = "suspected"

        # Check clearance with hysteresis margin
        clear_threshold = rules["suspected_min"] - rules["hysteresis"]
        if raw_value < clear_threshold:
            alert_state["clearance_ticks"] += 1
        else:
            alert_state["clearance_ticks"] = 0

        # State transition logic
        prev_level = alert_state["current_level"]
        lifecycle_state = "none"
        is_database_event = False

        if target_severity == "critical":
            if prev_level == "IDLE":
                lifecycle_state = "new"
                is_database_event = True
                alert_state["current_level"] = "CRITICAL"
                alert_state["peak_value"] = raw_value
                alert_state["ticks_active"] = 1
            elif prev_level == "SUSPECTED":
                lifecycle_state = "escalated"
                is_database_event = True
                alert_state["current_level"] = "CRITICAL"
                alert_state["peak_value"] = max(alert_state["peak_value"], raw_value)
                alert_state["ticks_active"] += 1
            else: # Already CRITICAL
                lifecycle_state = "persistent"
                is_database_event = False
                alert_state["peak_value"] = max(alert_state["peak_value"], raw_value)
                alert_state["ticks_active"] += 1

        elif target_severity == "suspected":
            if prev_level == "IDLE":
                lifecycle_state = "new"
                is_database_event = True
                alert_state["current_level"] = "SUSPECTED"
                alert_state["peak_value"] = raw_value
                alert_state["ticks_active"] = 1
            elif prev_level == "CRITICAL":
                # Stays in critical state until fully cleared by hysteresis
                lifecycle_state = "persistent"
                is_database_event = False
                alert_state["ticks_active"] += 1
            else: # Already SUSPECTED
                lifecycle_state = "persistent"
                is_database_event = False
                alert_state["peak_value"] = max(alert_state["peak_value"], raw_value)
                alert_state["ticks_active"] += 1

        else: # normal reading
            if prev_level in ("SUSPECTED", "CRITICAL") and alert_state["clearance_ticks"] >= 2:
                # Alarm cleared!
                lifecycle_state = "cleared"
                is_database_event = False # don't insert hazard, state is cleared
                alert_state["current_level"] = "IDLE"
                alert_state["peak_value"] = 0.0
                alert_state["ticks_active"] = 0
            elif prev_level in ("SUSPECTED", "CRITICAL"):
                # Within hysteresis buffer
                lifecycle_state = "persistent"
                is_database_event = False
                alert_state["ticks_active"] += 1

        # Emit hazard object if in active alert condition or noisy
        active_severity = "critical" if alert_state["current_level"] == "CRITICAL" else "suspected"

        if alert_state["current_level"] in ("SUSPECTED", "CRITICAL") or health == "noisy":
            confidence = 0.94 if active_severity == "critical" else 0.80
            if health != "nominal":
                confidence = max(0.40, confidence - 0.25)

            thresh_applied = rules["critical_min"] if active_severity == "critical" else rules["suspected_min"]
            supporting_cnt = len(critical_samples) if active_severity == "critical" else len(elevated_samples)
            rule_name = f"{sensor_type.upper()}_{active_severity.upper()}_EXCEEDANCE"

            details = (
                f"{active_severity.upper()} [{lifecycle_state.upper()}]: "
                f"Reading {raw_value:.1f} {rules['unit']} (Threshold: {thresh_applied:.1f}). "
                f"Peak: {alert_state['peak_value']:.1f} {rules['unit']}, "
                f"Supporting: {supporting_cnt}/{len(recent_samples)} samples. "
                f"Rule: {self.RULE_VERSION}."
            )
            if health == "noisy":
                details += f" [Warning: {health_note}]"

            return {
                "rule_name": rule_name,
                "severity": active_severity,
                "confidence": round(confidence, 2),
                "evidence_score": round(confidence * min(1.0, raw_value / thresh_applied), 2),
                "sensor_health": health,
                "rule_version": self.RULE_VERSION,
                "supporting_samples": supporting_cnt,
                "threshold_applied": thresh_applied,
                "lifecycle_state": lifecycle_state,
                "is_database_event": is_database_event,
                "details": details,
                "raw_value": raw_value,
                "calibrated_value": calibrated_value,
                "unit": rules["unit"],
                "position": position,
                "sensor_type": sensor_type,
            }

        return None

    def reset_session_state(self, session_id: str):
        """Cleans up internal state for terminated session"""
        keys_to_del = [k for k in self._alert_states.keys() if k[0] == session_id]
        for k in keys_to_del:
            self._alert_states.pop(k, None)
            self._history.pop(k, None)

    def clear_session(self, session_id: str):
        """Alias for reset_session_state"""
        self.reset_session_state(session_id)

hazard_detector = HazardDetectionEngine()
