import datetime
import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class Trainee(Base):
    __tablename__ = "trainees"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    trainee_code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=True)
    trade_specialization = Column(String(64), nullable=False) # plumbing, gas_fitting, welding, industrial_maintenance
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sessions = relationship("TrainingSession", back_populates="trainee", cascade="all, delete-orphan")
    assessments = relationship("AssessmentResult", back_populates="trainee", cascade="all, delete-orphan")


class Mission(Base):
    __tablename__ = "missions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    mission_code = Column(String(32), unique=True, index=True, nullable=False)
    title = Column(String(128), nullable=False)
    trade = Column(String(64), nullable=False) # plumbing, gas_fitting, welding, industrial_maintenance
    difficulty = Column(String(32), default="intermediate") # beginner, intermediate, advanced
    description = Column(Text, nullable=False)
    inspection_bounds_json = Column(Text, nullable=False) # {x_min, x_max, y_min, y_max, z_min, z_max}
    required_sensors_json = Column(Text, nullable=False) # ["mq4_gas", "thermal_ir", etc]
    assessment_weights_json = Column(Text, nullable=False) # {hazard_id: 30, location_accuracy: 25, coverage: 15, evidence: 15, safety: 15}
    safety_critical_rules_json = Column(Text, nullable=False) # {fail_on_unreported_critical_gas: true}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # 1-to-1 relationship with hidden scenario ground truth
    scenario = relationship("MissionScenario", back_populates="mission", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("TrainingSession", back_populates="mission")


class MissionScenario(Base):
    """
    Hidden Ground Truth Scenario details - ISOLATED from Trainee API during active missions!
    """
    __tablename__ = "mission_scenarios"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    mission_id = Column(String(36), ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, unique=True)
    hidden_faults_json = Column(Text, nullable=False) # Ground-truth faults with true positions, radii, peak intensities
    environment_layout_json = Column(Text, nullable=False) # Workshop layout: pipes, valves, joints, obstacles, zones
    simulation_seed = Column(Integer, default=42)
    noise_factor = Column(Float, default=0.05)
    sensor_drift_rate = Column(Float, default=0.01)
    comm_drop_probability = Column(Float, default=0.02)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    mission = relationship("Mission", back_populates="scenario")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_code = Column(String(32), unique=True, index=True, nullable=False)
    mission_id = Column(String(36), ForeignKey("missions.id"), nullable=False)
    trainee_id = Column(String(36), ForeignKey("trainees.id"), nullable=False)
    status = Column(String(32), default="idle") # idle, in_progress, paused, completed, aborted
    data_source = Column(String(32), default="simulation") # simulation, hardware_esp32
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    drone_battery_final = Column(Float, default=100.0)
    total_distance_meters = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    trainee = relationship("Trainee", back_populates="sessions")
    mission = relationship("Mission", back_populates="sessions")
    sensor_events = relationship("SensorEvent", back_populates="session", cascade="all, delete-orphan")
    hazard_events = relationship("HazardEvent", back_populates="session", cascade="all, delete-orphan")
    decisions = relationship("TraineeDecision", back_populates="session", cascade="all, delete-orphan")
    assessment = relationship("AssessmentResult", back_populates="session", uselist=False, cascade="all, delete-orphan")
    vision_observations = relationship("VisionObservation", back_populates="session", cascade="all, delete-orphan")
    evidence_frames = relationship("CameraEvidenceFrame", back_populates="session", cascade="all, delete-orphan")
    voice_announcements = relationship("VoiceAnnouncement", back_populates="session", cascade="all, delete-orphan")


class SensorEvent(Base):
    __tablename__ = "sensor_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    sensor_type = Column(String(32), nullable=False) # mq4_gas, mq7_co, thermal_ir, uv_flame, battery
    raw_value = Column(Float, nullable=False)
    calibrated_value = Column(Float, nullable=True)
    measurement_unit = Column(String(32), nullable=False) # ADC_counts, degC, uW/cm2, V
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    position_z = Column(Float, nullable=False)
    drone_heading = Column(Float, default=0.0)
    drone_speed = Column(Float, default=0.0)
    sensor_health = Column(String(32), default="nominal") # nominal, noisy, degraded, disconnected
    is_simulated = Column(Boolean, default=True)

    session = relationship("TrainingSession", back_populates="sensor_events")


class HazardEvent(Base):
    __tablename__ = "hazard_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    sensor_type = Column(String(32), nullable=False)
    raw_value = Column(Float, nullable=False)
    calibrated_value = Column(Float, nullable=True)
    measurement_unit = Column(String(32), nullable=False)
    position_x = Column(Float, nullable=False)
    position_y = Column(Float, nullable=False)
    position_z = Column(Float, nullable=False)
    sensor_health = Column(String(32), default="nominal")
    rule_name = Column(String(64), nullable=False)
    severity = Column(String(32), nullable=False) # normal, suspected, critical
    confidence = Column(Float, default=0.8)
    review_status = Column(String(32), default="unreviewed") # unreviewed, confirmed, false_positive, ignored
    details = Column(Text, nullable=True)
    associated_object_id = Column(String(64), nullable=True) # e.g. J-02, V-01, PUMP-01
    visual_evidence_frame_id = Column(String(36), nullable=True)

    session = relationship("TrainingSession", back_populates="hazard_events")


class TraineeDecision(Base):
    __tablename__ = "trainee_decisions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action_type = Column(String(64), nullable=False) # waypoint_inspect, stationary_hover, multi_angle_sweep, sensor_calibration_check, submit_diagnosis
    target_x = Column(Float, nullable=True)
    target_y = Column(Float, nullable=True)
    target_z = Column(Float, nullable=True)
    suspected_hazard_type = Column(String(64), nullable=True) # pipe_gas_leak, hot_spot_overheating, electrical_arcing, clear
    severity_report = Column(String(32), nullable=True) # low, medium, critical, none
    evidence_notes = Column(Text, nullable=True)
    recommended_action = Column(String(64), nullable=True) # isolate_valve, evacuate_area, scheduled_maintenance, clear_to_operate

    session = relationship("TrainingSession", back_populates="decisions")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    trainee_id = Column(String(36), ForeignKey("trainees.id"), nullable=False)
    
    # 100-point rubric breakdown
    hazard_identification_score = Column(Float, default=0.0) # max 30
    location_accuracy_score = Column(Float, default=0.0)      # max 25
    inspection_coverage_score = Column(Float, default=0.0)    # max 15
    evidence_interpretation_score = Column(Float, default=0.0)# max 15
    safety_decision_score = Column(Float, default=0.0)        # max 15
    total_score = Column(Float, default=0.0)                  # max 100
    
    passed = Column(Boolean, default=False)
    safety_critical_failed = Column(Boolean, default=False)
    missed_hazards_count = Column(Integer, default=0)
    false_positives_count = Column(Integer, default=0)
    mean_location_error_meters = Column(Float, default=0.0)
    inspection_coverage_pct = Column(Float, default=0.0)
    scoring_breakdown_json = Column(Text, nullable=False)
    instructor_feedback = Column(Text, nullable=True)
    instructor_override_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("TrainingSession", back_populates="assessment")
    trainee = relationship("Trainee", back_populates="assessments")


class SystemConfig(Base):
    __tablename__ = "system_configs"

    config_key = Column(String(64), primary_key=True)
    config_value = Column(Text, nullable=False)
    description = Column(String(256), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class VisionObservation(Base):
    __tablename__ = "vision_observations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    frame_sequence = Column(Integer, default=0)
    object_class = Column(String(64), nullable=False) # pipe_joint, valve, electrical_panel, machinery, obstacle, smoke_steam
    object_id = Column(String(64), nullable=True)     # e.g. J-02, V-01, PUMP-01, PANEL-E04
    confidence = Column(Float, default=0.9)
    # Normalized bounding box coordinates [0.0 to 1.0]
    bbox_x_min = Column(Float, default=0.0)
    bbox_y_min = Column(Float, default=0.0)
    bbox_x_max = Column(Float, default=1.0)
    bbox_y_max = Column(Float, default=1.0)
    # Spatial coordinates in workshop (if resolved)
    workshop_x = Column(Float, nullable=True)
    workshop_y = Column(Float, nullable=True)
    workshop_z = Column(Float, nullable=True)
    drone_distance_m = Column(Float, nullable=True)
    vision_provider = Column(String(32), default="simulation_vision_provider")
    notes = Column(Text, nullable=True)

    session = relationship("TrainingSession", back_populates="vision_observations")


class CameraEvidenceFrame(Base):
    __tablename__ = "camera_evidence_frames"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    trigger_event_type = Column(String(64), nullable=False) # hazard_alert, trainee_inspection, reinspection_hover, manual_snapshot
    hazard_event_id = Column(String(36), nullable=True)
    drone_pos_x = Column(Float, nullable=False)
    drone_pos_y = Column(Float, nullable=False)
    drone_pos_z = Column(Float, nullable=False)
    drone_heading_deg = Column(Float, default=0.0)
    drone_pitch_deg = Column(Float, default=0.0)
    associated_object_id = Column(String(64), nullable=True)
    fused_sensor_summary = Column(Text, nullable=True) # JSON summary of sensor values at snapshot
    annotations_json = Column(Text, nullable=True)     # Bounding boxes and object classes
    image_data_url = Column(Text, nullable=True)       # SVG / Base64 snapshot for report embedding

    session = relationship("TrainingSession", back_populates="evidence_frames")


class VoiceAnnouncement(Base):
    __tablename__ = "voice_announcements"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    session_id = Column(String(36), ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    message_text = Column(Text, nullable=False)
    priority = Column(String(32), default="warning")   # info, warning, critical
    category = Column(String(64), default="hazard_alert") # mission_lifecycle, visual_detection, hazard_alert, sensor_malfunction, comm_loss
    spoken_successfully = Column(Boolean, default=True)
    associated_hazard_id = Column(String(36), nullable=True)
    associated_object_id = Column(String(64), nullable=True)

    session = relationship("TrainingSession", back_populates="voice_announcements")
