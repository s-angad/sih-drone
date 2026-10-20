import math
import datetime
from typing import Dict, Any, List, Optional, Tuple

class SensorVisionFusionEngine:
    """
    Sensor & Vision Fusion Layer (SkillDrone V2).
    Correlates real-time sensor anomalies (gas, thermal, UV) with visible objects in camera FOV.
    - Matches elevated gas concentrations to visible pipe joints / flanges (e.g. J-02).
    - Matches elevated thermal readings to visible pump machinery or electrical panels.
    - Emits structured fusion records: associated_object_id, fusion_status, spatial_confidence.
    - Strictly preserves serious sensor alerts even when camera visual target is unobserved or obstructed.
    """

    def __init__(self, max_spatial_association_dist_m: float = 3.5):
        self.max_dist = max_spatial_association_dist_m

    def fuse_hazard_with_vision(
        self,
        hazard_result: Optional[Dict[str, Any]],
        visible_objects: List[Dict[str, Any]],
        drone_position: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Evaluates spatial and semantic correlation between an active sensor hazard
        and currently visible objects in the camera frame.
        """
        if not hazard_result or hazard_result.get("severity") not in ("suspected", "critical"):
            # No active hazard
            return {
                "associated_object_id": None,
                "associated_object_class": None,
                "fusion_status": "nominal_no_hazard",
                "confidence": 1.0,
                "notes": "Nominal conditions; no anomaly present."
            }

        sensor_type = hazard_result.get("sensor_type", "")
        hazard_sev = hazard_result.get("severity", "suspected")
        px = drone_position.get("x", 0.0)
        py = drone_position.get("y", 0.0)
        pz = drone_position.get("z", 1.5)

        # Filter candidate visible objects based on physical compatibility
        candidate_classes = []
        if "gas" in sensor_type:
            candidate_classes = ["pipe_joint", "valve", "pipe", "smoke_steam"]
        elif "thermal" in sensor_type:
            candidate_classes = ["pump_machinery", "electrical_panel", "valve"]
        elif "uv" in sensor_type:
            candidate_classes = ["electrical_panel", "machinery", "pipe_joint"]
        else:
            candidate_classes = ["pipe_joint", "valve", "pump_machinery", "electrical_panel"]

        best_object = None
        best_dist = float("inf")

        for obj in visible_objects:
            obj_class = obj.get("object_class", "")
            if obj_class not in candidate_classes:
                continue

            ox = obj.get("workshop_x")
            oy = obj.get("workshop_y")
            oz = obj.get("workshop_z", pz)

            if ox is not None and oy is not None:
                spatial_dist = math.hypot(ox - px, oy - py)
            else:
                spatial_dist = obj.get("drone_distance_m", 99.0)

            if spatial_dist <= self.max_dist and spatial_dist < best_dist:
                best_dist = spatial_dist
                best_object = obj

        if best_object is not None:
            obj_id = best_object.get("object_id") or best_object.get("label") or "ASSET-UNTAGGED"
            obj_class = best_object.get("object_class")
            vis_conf = best_object.get("confidence", 0.85)

            # Spatial correlation confidence factor
            dist_factor = max(0.4, 1.0 - (best_dist / (self.max_dist * 1.5)))
            fusion_conf = round(vis_conf * dist_factor, 2)

            return {
                "associated_object_id": obj_id,
                "associated_object_class": obj_class,
                "fusion_status": "correlated",
                "confidence": fusion_conf,
                "distance_to_asset_m": round(best_dist, 2),
                "notes": f"Correlated {sensor_type} anomaly with visible {obj_class} '{obj_id}' at {best_dist:.1f}m."
            }
        else:
            # Important requirement: Visual absence must NOT suppress sensor alert
            return {
                "associated_object_id": None,
                "associated_object_class": None,
                "fusion_status": "sensor_only_visual_unresolved",
                "confidence": round(hazard_result.get("confidence", 0.8) * 0.75, 2),
                "distance_to_asset_m": None,
                "notes": f"{hazard_sev.upper()} sensor alert triggered; visual localization unavailable (no compatible physical asset currently in camera FOV)."
            }

fusion_engine = SensorVisionFusionEngine()
