from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

# ----------------- Trainee Schemas -----------------
class TraineeBase(BaseModel):
    trainee_code: str = Field(..., json_schema_extra={"example": "TR-2026-001"})
    name: str = Field(..., json_schema_extra={"example": "Alex Morgan"})
    email: Optional[str] = Field(None, json_schema_extra={"example": "alex.morgan@trade.edu"})
    trade_specialization: str = Field("plumbing", json_schema_extra={"example": "plumbing"})
    notes: Optional[str] = None

class TraineeCreate(TraineeBase):
    pass

class TraineeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    trade_specialization: Optional[str] = None
    notes: Optional[str] = None

class TraineeResponse(TraineeBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    completed_sessions_count: Optional[int] = 0
    average_score: Optional[float] = 0.0


# ----------------- Mission Schemas -----------------
class InspectionBounds(BaseModel):
    x_min: float = 0.0
    x_max: float = 20.0
    y_min: float = 0.0
    y_max: float = 15.0
    z_min: float = 0.5
    z_max: float = 4.0

class AssessmentWeights(BaseModel):
    hazard_id: float = 30.0
    location_accuracy: float = 25.0
    coverage: float = 15.0
    evidence: float = 15.0
    safety: float = 15.0

class SafetyCriticalRules(BaseModel):
    fail_on_unreported_critical_gas: bool = True
    fail_on_critical_hotspot_disregard: bool = True
    penalty_on_false_alarm_evacuation: float = 10.0

class HiddenFaultItem(BaseModel):
    fault_id: str
    fault_type: str
    x: float
    y: float
    z: float
    radius_meters: float = 2.0
    peak_intensity: float = 650.0
    gas_type: Optional[str] = None
    temp_delta_c: Optional[float] = None
    uv_flux_uw_cm2: Optional[float] = None
    severity: str = "critical"
    description: str

class EnvironmentLayout(BaseModel):
    workshop_name: str = "Industrial Training Facility Bay 4"
    dimensions: Dict[str, float] = {"width": 20.0, "length": 15.0, "height": 4.5}
    pipes: List[Dict[str, Any]] = []
    valves: List[Dict[str, Any]] = []
    joints: List[Dict[str, Any]] = []
    workstations: List[Dict[str, Any]] = []
    obstacles: List[Dict[str, Any]] = []

class MissionCreate(BaseModel):
    mission_code: str
    title: str
    trade: str
    difficulty: str = "intermediate"
    description: str
    inspection_bounds: InspectionBounds = InspectionBounds()
    required_sensors: List[str] = ["mq4_gas", "thermal_ir"]
    assessment_weights: AssessmentWeights = AssessmentWeights()
    safety_critical_rules: SafetyCriticalRules = SafetyCriticalRules()
    
    hidden_faults: List[HiddenFaultItem]
    environment_layout: EnvironmentLayout = EnvironmentLayout()
    simulation_seed: int = 42
    noise_factor: float = 0.05
    sensor_drift_rate: float = 0.01

class MissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_code: str
    title: str
    trade: str
    difficulty: str
    description: str
    inspection_bounds: Dict[str, float]
    required_sensors: List[str]
    assessment_weights: Dict[str, float]
    safety_critical_rules: Dict[str, Any]
    environment_layout: Dict[str, Any]
    created_at: datetime

class MissionScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_id: str
    hidden_faults: List[Dict[str, Any]]
    environment_layout: Dict[str, Any]
    simulation_seed: int
    noise_factor: float
    sensor_drift_rate: float
    comm_drop_probability: float


# ----------------- Training Session Schemas -----------------
class SessionCreate(BaseModel):
    mission_id: str
    trainee_id: str
    data_source: str = "simulation"

class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_code: str
    mission_id: str
    trainee_id: str
    status: str
    data_source: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: float = 0.0
    drone_battery_final: float = 100.0
    total_distance_meters: float = 0.0
    created_at: datetime
    trainee_name: Optional[str] = None
    mission_title: Optional[str] = None


# ----------------- Telemetry & Sensor Schemas -----------------
class SingleSensorReading(BaseModel):
    sensor_type: str
    raw_value: float
    calibrated_value: Optional[float] = None
    unit: str
    sensor_health: str = "nominal"

class CameraState(BaseModel):
    fov_deg: float = 70.0
    pitch_deg: float = -15.0
    heading_deg: float = 0.0
    zoom: float = 1.0
    status: str = "active"
    mode: str = "simulation"

class VisionObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    frame_sequence: int = 0
    object_class: str
    object_id: Optional[str] = None
    confidence: float = 0.90
    bbox_x_min: float = 0.0
    bbox_y_min: float = 0.0
    bbox_x_max: float = 1.0
    bbox_y_max: float = 1.0
    workshop_x: Optional[float] = None
    workshop_y: Optional[float] = None
    workshop_z: Optional[float] = None
    drone_distance_m: Optional[float] = None
    vision_provider: str = "simulation_vision_provider"
    notes: Optional[str] = None

class FusionResult(BaseModel):
    associated_object_id: Optional[str] = None
    associated_object_class: Optional[str] = None
    fusion_status: str = "unresolved" # correlated, sensor_only_visual_unresolved, visual_only
    confidence: float = 0.8
    notes: Optional[str] = None

class TelemetryFrame(BaseModel):
    session_id: str
    sequence_number: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    position: Dict[str, float]
    heading_deg: float = 0.0
    speed_mps: float = 0.0
    battery_pct: float = 100.0
    sensors: List[SingleSensorReading]
    is_simulated: bool = True
    link_quality_pct: float = 100.0
    camera: Optional[CameraState] = None
    visible_objects: List[VisionObservationResponse] = []
    fusion: Optional[FusionResult] = None


# ----------------- Hazard Event Schemas -----------------
class HazardEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    timestamp: datetime
    sensor_type: str
    raw_value: float
    calibrated_value: Optional[float] = None
    measurement_unit: str
    position_x: float
    position_y: float
    position_z: float
    sensor_health: str
    rule_name: str
    severity: str
    confidence: float
    review_status: str
    details: Optional[str] = None
    associated_object_id: Optional[str] = None
    visual_evidence_frame_id: Optional[str] = None


# ----------------- Evidence & Voice Schemas -----------------
class CameraEvidenceFrameCreate(BaseModel):
    session_id: str
    trigger_event_type: str = "hazard_alert"
    hazard_event_id: Optional[str] = None
    drone_pos_x: float
    drone_pos_y: float
    drone_pos_z: float
    drone_heading_deg: float = 0.0
    drone_pitch_deg: float = -15.0
    associated_object_id: Optional[str] = None
    fused_sensor_summary: Optional[Dict[str, Any]] = None
    annotations: Optional[List[Dict[str, Any]]] = None
    image_data_url: Optional[str] = None

class CameraEvidenceFrameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    timestamp: datetime
    trigger_event_type: str
    hazard_event_id: Optional[str] = None
    drone_pos_x: float
    drone_pos_y: float
    drone_pos_z: float
    drone_heading_deg: float = 0.0
    drone_pitch_deg: float = -15.0
    associated_object_id: Optional[str] = None
    fused_sensor_summary: Optional[str] = None
    annotations_json: Optional[str] = None
    image_data_url: Optional[str] = None

class VoiceAnnouncementCreate(BaseModel):
    session_id: str
    message_text: str
    priority: str = "warning"
    category: str = "hazard_alert"
    associated_hazard_id: Optional[str] = None
    associated_object_id: Optional[str] = None

class VoiceAnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    timestamp: datetime
    message_text: str
    priority: str
    category: str
    spoken_successfully: bool = True
    associated_hazard_id: Optional[str] = None
    associated_object_id: Optional[str] = None


# ----------------- Adaptive Reinspection -----------------
class ReinspectionRecommendation(BaseModel):
    action_type: str
    priority: str
    title: str
    reason: str
    target_x: Optional[float] = None
    target_y: Optional[float] = None
    target_z: Optional[float] = None
    recommended_duration_sec: Optional[float] = 10.0
    evidence_sensor: Optional[str] = None


# ----------------- Trainee Diagnosis & Assessment -----------------
class TraineeDiagnosisSubmission(BaseModel):
    session_id: str
    hazard_detected: bool
    suspected_hazard_type: Optional[str] = "pipe_gas_leak"
    estimated_position: Optional[Dict[str, float]] = None
    reported_severity: str = "critical"
    safety_decision: str = "isolate_valve"
    evidence_rationale: str = ""

class AssessmentRubricBreakdown(BaseModel):
    hazard_identification: Dict[str, Any]
    location_accuracy: Dict[str, Any]
    inspection_coverage: Dict[str, Any]
    evidence_interpretation: Dict[str, Any]
    safety_decision: Dict[str, Any]
    critical_safety_notes: List[str] = []

class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    trainee_id: str
    hazard_identification_score: float
    location_accuracy_score: float
    inspection_coverage_score: float
    evidence_interpretation_score: float
    safety_decision_score: float
    total_score: float
    passed: bool
    safety_critical_failed: bool
    missed_hazards_count: int
    false_positives_count: int
    mean_location_error_meters: float
    inspection_coverage_pct: float
    scoring_breakdown: AssessmentRubricBreakdown
    instructor_feedback: Optional[str] = None
    instructor_override_score: Optional[float] = None
    created_at: datetime


# ----------------- Dashboard Analytics -----------------
class DashboardStatsResponse(BaseModel):
    total_training_sessions: int
    active_missions_count: int
    total_trainees_count: int
    hazards_detected_count: int
    mission_completion_rate: float
    average_competency_score: float
    recent_activity: List[Dict[str, Any]]
    latest_mission_results: List[Dict[str, Any]]
    system_connection_status: Dict[str, Any]
    is_simulated_mode: bool = True
