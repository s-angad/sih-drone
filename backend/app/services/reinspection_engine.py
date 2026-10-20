from typing import Dict, Any, List, Optional
from app.schemas.schemas import ReinspectionRecommendation

class AdaptiveReinspectionEngine:
    """
    Generates evidence-backed diagnostic recommendations for the trainee
    based on real-time sensor anomalies, noisy measurements, and spatial uncertainty.
    """

    @staticmethod
    def generate_recommendations(
        hazard_event: Optional[Dict[str, Any]],
        drone_speed: float,
        recent_readings_count: int
    ) -> List[ReinspectionRecommendation]:
        recs = []

        if not hazard_event:
            return recs

        severity = hazard_event.get("severity", "normal")
        sensor_type = hazard_event.get("sensor_type", "")
        raw_val = hazard_event.get("raw_value", 0.0)
        pos = hazard_event.get("position", {})
        sensor_health = hazard_event.get("sensor_health", "nominal")
        confidence = hazard_event.get("confidence", 0.8)

        # Rule 1: Noisy or Inconclusive measurement -> Recommend Sensor Health Check
        if sensor_health in ("noisy", "degraded", "disconnected") or severity == "inconclusive":
            recs.append(ReinspectionRecommendation(
                action_type="sensor_calibration_check",
                priority="high",
                title="Perform Sensor Health & Baseline Verification",
                reason=f"Telemetry anomaly detected ({hazard_event.get('details', '')}). Verify ADC ground reference and sensor heater voltage before relying on readings.",
                target_x=pos.get("x"),
                target_y=pos.get("y"),
                target_z=pos.get("z"),
                recommended_duration_sec=15.0,
                evidence_sensor=sensor_type
            ))
            return recs

        # Rule 2: High speed during suspected hazard detection -> Recommend Stationary Hover Scan
        if severity in ("suspected", "critical") and drone_speed > 0.6:
            recs.append(ReinspectionRecommendation(
                action_type="stationary_hover",
                priority="urgent" if severity == "critical" else "high",
                title="Execute Stationary Hover Scan",
                reason=f"Elevated {sensor_type} reading ({raw_val}) captured while drone moving at {drone_speed:.1f} m/s. Sensor response time requires 10-15s stationary sample to isolate plume center.",
                target_x=pos.get("x"),
                target_y=pos.get("y"),
                target_z=pos.get("z"),
                recommended_duration_sec=12.0,
                evidence_sensor=sensor_type
            ))

        # Rule 3: Elevated gas concentration with moderate confidence -> Multi-angle Crosswind Sweep
        if "gas" in sensor_type and severity in ("suspected", "critical"):
            recs.append(ReinspectionRecommendation(
                action_type="multi_angle_sweep",
                priority="medium",
                title="Perform Multi-Angle Perimeter Sweep",
                reason="Atmospheric dispersion creates directional gas plumes. Orbit the suspicious pipe joint at 1.5m radius to triangulate leak source coordinates.",
                target_x=pos.get("x"),
                target_y=pos.get("y"),
                target_z=pos.get("z"),
                recommended_duration_sec=20.0,
                evidence_sensor=sensor_type
            ))

        # Rule 4: Critical hotspot detected -> Safety-critical Action & Instructor Confirmation
        if sensor_type == "thermal_ir" and severity == "critical":
            recs.append(ReinspectionRecommendation(
                action_type="request_instructor_review",
                priority="urgent",
                title="Flag Thermal Runaway Risk to Supervisor",
                reason=f"Surface temperature exceeded {raw_val:.1f} degC. High risk of component breakdown. Initiate safety isolation protocol.",
                target_x=pos.get("x"),
                target_y=pos.get("y"),
                target_z=pos.get("z"),
                recommended_duration_sec=5.0,
                evidence_sensor=sensor_type
            ))

        return recs

reinspection_engine = AdaptiveReinspectionEngine()
