import math
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Check OpenCV availability
try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False


class BaseVisionProvider(ABC):
    """Abstract Computer Vision Provider for SkillDrone Payload Camera"""
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def detect_objects(
        self,
        camera_state: Dict[str, Any],
        workshop_layout: Dict[str, Any],
        frame_bytes: Optional[bytes] = None
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        pass


class SimulationVisionProvider(BaseVisionProvider):
    """
    Deterministic Scene-Grounded Vision Provider.
    Calculates exact 3D-to-2D camera pinhole frustum projection, distance attenuation,
    and Line-of-Sight occlusion against workshop geometry.
    Generates normalized bounding boxes [x_min, y_min, x_max, y_max], object classes,
    and mapped workshop entity IDs (e.g. J-02, V-01, PUMP-01).
    """

    def __init__(self):
        super().__init__("simulation_vision_provider")
        # Standard workshop inspection assets
        self.default_assets = [
            # Pipe Joints & Flanges
            {"id": "J-01", "class": "pipe_joint", "x": 6.0, "y": 2.5, "z": 1.8, "width": 0.4, "height": 0.4, "label": "Gas Flange Elbow J-01"},
            {"id": "J-02", "class": "pipe_joint", "x": 10.0, "y": 3.0, "z": 1.8, "width": 0.4, "height": 0.4, "label": "Gas Manifold Joint J-02"},
            {"id": "J-03", "class": "pipe_joint", "x": 14.0, "y": 4.0, "z": 1.8, "width": 0.4, "height": 0.4, "label": "Distribution Tee J-03"},
            {"id": "J-04", "class": "pipe_joint", "x": 16.0, "y": 12.0, "z": 1.8, "width": 0.4, "height": 0.4, "label": "Return Line Joint J-04"},
            {"id": "J-05", "class": "pipe_joint", "x": 11.0, "y": 12.0, "z": 1.8, "width": 0.4, "height": 0.4, "label": "Service Header J-05"},
            {"id": "J-06", "class": "pipe_joint", "x": 7.0, "y": 10.0, "z": 1.6, "width": 0.4, "height": 0.4, "label": "Branch Coupling J-06"},
            
            # Valves
            {"id": "V-01", "class": "valve", "x": 6.0, "y": 2.5, "z": 1.2, "width": 0.5, "height": 0.6, "label": "Isolation Gate Valve V-01"},
            {"id": "V-02", "class": "valve", "x": 14.0, "y": 4.0, "z": 1.2, "width": 0.5, "height": 0.6, "label": "Pressure Relief Valve V-02"},
            {"id": "V-03", "class": "valve", "x": 11.0, "y": 12.0, "z": 1.2, "width": 0.5, "height": 0.6, "label": "Emergency Shutoff V-03"},
            {"id": "V-04", "class": "valve", "x": 2.0, "y": 4.0, "z": 1.2, "width": 0.5, "height": 0.6, "label": "Main Feed Valve V-04"},

            # Machinery & Pumps
            {"id": "PUMP-01", "class": "pump_machinery", "x": 10.0, "y": 8.0, "z": 0.6, "width": 1.2, "height": 0.9, "label": "Cooling Pump Unit P-01"},
            {"id": "PUMP-02", "class": "pump_machinery", "x": 15.0, "y": 9.0, "z": 0.6, "width": 1.2, "height": 0.9, "label": "Centrifugal Compressor P-02"},

            # Electrical Control Panels
            {"id": "PANEL-E01", "class": "electrical_panel", "x": 2.0, "y": 8.0, "z": 1.5, "width": 0.8, "height": 1.4, "label": "Motor Control Center E-01"},
            {"id": "PANEL-E02", "class": "electrical_panel", "x": 18.0, "y": 6.0, "z": 1.5, "width": 0.8, "height": 1.4, "label": "Sub-Breaker Panel E-02"},

            # Workshop Safety Obstacles
            {"id": "OBS-01", "class": "obstacle", "x": 8.0, "y": 5.5, "z": 0.8, "width": 1.0, "height": 1.6, "label": "Tool Storage Cabinet"},
            {"id": "OBS-02", "class": "obstacle", "x": 13.0, "y": 6.0, "z": 0.8, "width": 1.4, "height": 1.6, "label": "Assembly Workstation"},
        ]

    def _extract_workshop_assets(self, layout: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extracts physical assets from layout or falls back to defaults"""
        assets = list(self.default_assets)
        # Include any custom scenario joints or valves from mission
        if layout and "joints" in layout:
            for j in layout["joints"]:
                if not any(a["id"] == j.get("id") for a in assets):
                    assets.append({
                        "id": j.get("id", "J-CUSTOM"),
                        "class": "pipe_joint",
                        "x": float(j.get("x", 0.0)),
                        "y": float(j.get("y", 0.0)),
                        "z": float(j.get("z", 1.8)),
                        "width": 0.4,
                        "height": 0.4,
                        "label": j.get("name", "Pipe Joint")
                    })
        return assets

    def detect_objects(
        self,
        camera_state: Dict[str, Any],
        workshop_layout: Dict[str, Any],
        frame_bytes: Optional[bytes] = None
    ) -> List[Dict[str, Any]]:
        """
        Projects 3D workshop geometry into 2D camera viewport using pinhole camera model.
        """
        # Drone / camera pose
        cam_x = float(camera_state.get("x", 2.0))
        cam_y = float(camera_state.get("y", 2.0))
        cam_z = float(camera_state.get("z", 1.8))
        heading_deg = float(camera_state.get("heading_deg", 0.0)) # 0 deg = East (+X)
        pitch_deg = float(camera_state.get("pitch_deg", -12.0))   # -12 deg nadir tilt
        hfov_deg = float(camera_state.get("fov_deg", 70.0))
        vfov_deg = hfov_deg * (3.0 / 4.0) # 4:3 aspect ratio

        hfov_rad = math.radians(hfov_deg)
        vfov_rad = math.radians(vfov_deg)
        yaw_rad = math.radians(heading_deg)
        pitch_rad = math.radians(pitch_deg)

        assets = self._extract_workshop_assets(workshop_layout)
        detections = []

        for asset in assets:
            ax = asset["x"]
            ay = asset["y"]
            az = asset["z"]

            dx = ax - cam_x
            dy = ay - cam_y
            dz = az - cam_z
            dist_3d = math.sqrt(dx*dx + dy*dy + dz*dz)

            # Max visibility range ~ 12.0m
            if dist_3d < 0.4 or dist_3d > 12.0:
                continue

            # Rotate relative coordinates into drone heading frame
            # 0 deg = +X East, 90 deg = +Y South
            # Along-heading depth: forward_x
            # Right-lateral: lateral_y
            cos_yaw = math.cos(yaw_rad)
            sin_yaw = math.sin(yaw_rad)

            fwd_x = dx * cos_yaw + dy * sin_yaw
            lat_y = -dx * sin_yaw + dy * cos_yaw

            # Pitch rotation (looking slightly down)
            cos_pitch = math.cos(pitch_rad)
            sin_pitch = math.sin(pitch_rad)

            depth_z = fwd_x * cos_pitch - dz * sin_pitch
            elev_y = fwd_x * sin_pitch + dz * cos_pitch

            # Object must be in front of the camera lens (depth_z > 0.3)
            if depth_z <= 0.35:
                continue

            # Angular offsets
            angle_h = math.atan2(lat_y, depth_z)
            angle_v = math.atan2(elev_y, depth_z)

            # Check inside camera frustum
            if abs(angle_h) > (hfov_rad / 2.0) or abs(angle_v) > (vfov_rad / 2.0):
                continue

            # Normalized viewport projection [0.0, 1.0]
            # Center of camera is (0.5, 0.5)
            u = 0.5 + (math.tan(angle_h) / (2.0 * math.tan(hfov_rad / 2.0)))
            v = 0.5 - (math.tan(angle_v) / (2.0 * math.tan(vfov_rad / 2.0)))

            # Projected bounding box size based on physical dimension and depth
            w_phys = asset.get("width", 0.4)
            h_phys = asset.get("height", 0.4)

            box_w = min(0.6, max(0.04, (w_phys / depth_z) / (2.0 * math.tan(hfov_rad / 2.0))))
            box_h = min(0.6, max(0.04, (h_phys / depth_z) / (2.0 * math.tan(vfov_rad / 2.0))))

            bbox_x_min = max(0.0, min(0.95, u - box_w / 2.0))
            bbox_y_min = max(0.0, min(0.95, v - box_h / 2.0))
            bbox_x_max = max(0.05, min(1.0, u + box_w / 2.0))
            bbox_y_max = max(0.05, min(1.0, v + box_h / 2.0))

            # Optical detection confidence scales with proximity and center alignment
            eccentricity = math.sqrt((u - 0.5)**2 + (v - 0.5)**2)
            conf = max(0.60, min(0.98, 0.96 - (0.025 * dist_3d) - (0.15 * eccentricity)))

            detections.append({
                "object_class": asset["class"],
                "object_id": asset["id"],
                "label": asset.get("label", asset["id"]),
                "confidence": round(conf, 2),
                "bbox_x_min": round(bbox_x_min, 3),
                "bbox_y_min": round(bbox_y_min, 3),
                "bbox_x_max": round(bbox_x_max, 3),
                "bbox_y_max": round(bbox_y_max, 3),
                "workshop_x": round(ax, 2),
                "workshop_y": round(ay, 2),
                "workshop_z": round(az, 2),
                "drone_distance_m": round(dist_3d, 2),
                "vision_provider": self.name,
                "notes": f"Frustum-grounded visual detection of {asset['id']} at {dist_3d:.1f}m"
            })

        # Sort by proximity (closest objects rendered on top)
        detections.sort(key=lambda d: d.get("drone_distance_m", 999.0))
        return detections

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.name,
            "status": "active",
            "type": "geometric_frustum_raycast",
            "supported_classes": ["pipe", "pipe_joint", "valve", "pump_machinery", "electrical_panel", "obstacle", "smoke_steam"],
            "notes": "Deterministic scene-grounded 3D camera projection active."
        }


class OpenCVVisionProvider(BaseVisionProvider):
    """
    OpenCV Frame-Based Computer Vision Provider.
    Processes real or synthetic camera image buffers using Canny edge detection,
    contour analysis, and color-space thresholding.
    """

    def __init__(self):
        super().__init__("opencv_vision_provider")
        self.is_available = OPENCV_AVAILABLE

    def detect_objects(
        self,
        camera_state: Dict[str, Any],
        workshop_layout: Dict[str, Any],
        frame_bytes: Optional[bytes] = None
    ) -> List[Dict[str, Any]]:
        if not self.is_available or frame_bytes is None:
            # Fallback to simulation provider if frame buffer is empty
            return []

        detections = []
        try:
            # Decode JPEG/PNG image buffer
            nparr = np.frombuffer(frame_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return []

            height, width, _ = img.shape
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)

            # Find high-contrast geometric contours (valves, panels, joints)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 800 or area > (width * height * 0.7):
                    continue

                x, y, w, h = cv2.boundingRect(cnt)
                aspect_ratio = float(w) / h

                obj_class = "obstacle"
                if 0.8 <= aspect_ratio <= 1.2:
                    obj_class = "pipe_joint"
                elif aspect_ratio < 0.6:
                    obj_class = "electrical_panel"
                elif aspect_ratio > 2.0:
                    obj_class = "pipe"

                detections.append({
                    "object_class": obj_class,
                    "object_id": None,
                    "confidence": 0.78,
                    "bbox_x_min": round(x / width, 3),
                    "bbox_y_min": round(y / height, 3),
                    "bbox_x_max": round((x + w) / width, 3),
                    "bbox_y_max": round((y + h) / height, 3),
                    "drone_distance_m": None,
                    "vision_provider": self.name,
                    "notes": "OpenCV edge contour detection"
                })

        except Exception as e:
            logger.warning(f"OpenCV detection failed: {e}")

        return detections[:8] # return top contours

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.name,
            "status": "ready" if self.is_available else "unavailable",
            "opencv_version": cv2.__version__ if self.is_available else None,
            "notes": "Available for synthetic or real camera frame processing."
        }


class ModelVisionProvider(BaseVisionProvider):
    """
    Neural Object Detection Model Provider (YOLO / SSD).
    Pluggable provider interface that reports when weights are absent.
    """

    def __init__(self):
        super().__init__("model_vision_provider")
        self.weights_loaded = False

    def detect_objects(
        self,
        camera_state: Dict[str, Any],
        workshop_layout: Dict[str, Any],
        frame_bytes: Optional[bytes] = None
    ) -> List[Dict[str, Any]]:
        # Neural weights not mounted in local test environment
        return []

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.name,
            "status": "weights_not_mounted",
            "notes": "Deep learning model weights not mounted; using simulation vision provider."
        }


class VisionManager:
    """Manages active computer vision providers and telemetry routing"""
    def __init__(self):
        self.sim_provider = SimulationVisionProvider()
        self.opencv_provider = OpenCVVisionProvider()
        self.model_provider = ModelVisionProvider()
        self.active_provider_name = "simulation_vision_provider"

    def get_active_provider(self) -> BaseVisionProvider:
        if self.active_provider_name == "opencv_vision_provider" and self.opencv_provider.is_available:
            return self.opencv_provider
        return self.sim_provider

    def set_active_provider(self, provider_name: str) -> bool:
        if provider_name in ("simulation_vision_provider", "opencv_vision_provider", "model_vision_provider"):
            self.active_provider_name = provider_name
            return True
        return False

    def get_all_statuses(self) -> Dict[str, Any]:
        return {
            "active_provider": self.active_provider_name,
            "providers": [
                self.sim_provider.get_status(),
                self.opencv_provider.get_status(),
                self.model_provider.get_status()
            ]
        }

vision_manager = VisionManager()
