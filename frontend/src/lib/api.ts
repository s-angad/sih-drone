const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface DashboardStats {
  total_training_sessions: number;
  active_missions_count: number;
  total_trainees_count: number;
  hazards_detected_count: number;
  mission_completion_rate: number;
  average_competency_score: number;
  recent_activity: Array<{
    id: string;
    session_code: string;
    trainee_name: string;
    mission_title: string;
    trade: string;
    status: string;
    timestamp: string;
  }>;
  latest_mission_results: Array<{
    assessment_id: string;
    session_code: string;
    trainee_name: string;
    mission_title: string;
    total_score: number;
    passed: boolean;
    safety_critical_failed: boolean;
    created_at: string;
  }>;
  system_connection_status: {
    database: string;
    simulation_service: string;
    hardware_bridge: string;
    telemetry_broker: string;
  };
  is_simulated_mode: boolean;
}

export interface Trainee {
  id: string;
  trainee_code: string;
  name: string;
  email?: string;
  trade_specialization: string;
  notes?: string;
  completed_sessions_count?: number;
  average_score?: number;
  created_at: string;
}

export interface Mission {
  id: string;
  mission_code: string;
  title: string;
  trade: string;
  difficulty: string;
  description: string;
  inspection_bounds: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
    z_min: number;
    z_max: number;
  };
  required_sensors: string[];
  assessment_weights: Record<string, number>;
  safety_critical_rules: Record<string, any>;
  environment_layout: {
    workshop_name: string;
    dimensions: { width: number; length: number; height: number };
    pipes: any[];
    valves: any[];
    joints: any[];
    workstations: any[];
    obstacles: any[];
  };
  created_at: string;
}

export interface TrainingSession {
  id: string;
  session_code: string;
  mission_id: string;
  trainee_id: string;
  status: "idle" | "in_progress" | "paused" | "completed" | "aborted";
  data_source: "simulation" | "hardware_esp32";
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  drone_battery_final: number;
  total_distance_meters: number;
  created_at: string;
  trainee_name?: string;
  mission_title?: string;
}

export interface SingleSensorReading {
  sensor_type: string;
  raw_value: number;
  calibrated_value?: number;
  unit: string;
  sensor_health: "nominal" | "noisy" | "degraded" | "disconnected";
}

export interface TelemetryFrame {
  session_id: string;
  sequence_number: number;
  timestamp: string;
  position: { x: number; y: number; z: number };
  heading_deg: number;
  camera_pitch_deg?: number;
  speed_mps: number;
  battery_pct: number;
  sensors: SingleSensorReading[];
  is_simulated: boolean;
  link_quality_pct: number;
}

export interface HazardEvent {
  id: string;
  session_id: string;
  timestamp: string;
  sensor_type: string;
  raw_value: number;
  calibrated_value?: number;
  measurement_unit: string;
  position_x: number;
  position_y: number;
  position_z: number;
  sensor_health: string;
  rule_name: string;
  severity: "normal" | "suspected" | "critical" | "inconclusive";
  confidence: number;
  review_status: "unreviewed" | "confirmed" | "false_positive" | "ignored";
  details?: string;
  associated_object_id?: string;
  visual_evidence_frame_id?: string;
}

export interface ReinspectionRecommendation {
  action_type: string;
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  reason: string;
  target_x?: number;
  target_y?: number;
  target_z?: number;
  recommended_duration_sec?: number;
  evidence_sensor?: string;
}

export interface AssessmentResponse {
  id: string;
  session_id: string;
  trainee_id: string;
  hazard_identification_score: number;
  location_accuracy_score: number;
  inspection_coverage_score: number;
  evidence_interpretation_score: number;
  safety_decision_score: number;
  total_score: number;
  passed: boolean;
  safety_critical_failed: boolean;
  missed_hazards_count: number;
  false_positives_count: number;
  mean_location_error_meters: number;
  inspection_coverage_pct: number;
  scoring_breakdown: {
    hazard_identification: { score: number; max_score: number; notes: string[] };
    location_accuracy: { score: number; max_score: number; error_meters: number; notes: string[] };
    inspection_coverage: { score: number; max_score: number; coverage_pct: number; notes: string[] };
    evidence_interpretation: { score: number; max_score: number; notes: string[] };
    safety_decision: { score: number; max_score: number; decision: string; notes: string[] };
    critical_safety_notes: string[];
  };
  instructor_feedback?: string;
  created_at: string;
}

// ----------------- API Calls -----------------
export async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { cache: "no-store" });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function apiPost<T>(endpoint: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function apiPatch<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

// Dashboard
export const getDashboardStats = () => apiGet<DashboardStats>("/api/dashboard/stats");

// Trainees
export const getTrainees = () => apiGet<Trainee[]>("/api/trainees");
export const createTrainee = (data: Partial<Trainee>) => apiPost<Trainee>("/api/trainees", data);
export const getTrainee = (id: string) => apiGet<any>(`/api/trainees/${id}`);
export const deleteTrainee = (id: string) => apiDelete<any>(`/api/trainees/${id}`);

// Missions
export const getMissions = () => apiGet<Mission[]>("/api/missions");
export const getMission = (id: string) => apiGet<Mission>(`/api/missions/${id}`);
export const getMissionScenario = (id: string) => apiGet<any>(`/api/missions/${id}/scenario`);
export const createMission = (data: any) => apiPost<Mission>("/api/missions", data);

// Sessions
export const getSessions = () => apiGet<TrainingSession[]>("/api/sessions");
export const getSession = (id: string) => apiGet<TrainingSession>(`/api/sessions/${id}`);
export const createSession = (data: { mission_id: string; trainee_id: string; data_source?: string }) =>
  apiPost<TrainingSession>("/api/sessions", data);
export const startSession = (id: string) => apiPost<any>(`/api/sessions/${id}/start`);
export const pauseSession = (id: string) => apiPost<any>(`/api/sessions/${id}/pause`);
export const resumeSession = (id: string) => apiPost<any>(`/api/sessions/${id}/resume`);
export const setSessionWaypoint = (id: string, coords: { x: number; y: number; z?: number }) =>
  apiPost<any>(`/api/sessions/${id}/waypoint`, coords);
export const recordDecision = (id: string, decision: any) =>
  apiPost<any>(`/api/sessions/${id}/decision`, decision);
export const submitDiagnosis = (id: string, submission: any) =>
  apiPost<AssessmentResponse>(`/api/sessions/${id}/submit_diagnosis`, submission);

// Hazards
export const getSessionHazards = (sessionId: string) =>
  apiGet<HazardEvent[]>(`/api/hazards/session/${sessionId}`);
export const updateHazardReview = (hazardId: string, status: string) =>
  apiPatch<any>(`/api/hazards/${hazardId}/review`, { review_status: status });

// Replay & Export
export const getSessionReplay = (sessionId: string) =>
  apiGet<any>(`/api/replay/${sessionId}`);
export const getSessionReport = (sessionId: string) =>
  apiGet<any>(`/api/replay/${sessionId}/report`);
export const getExportCsvUrl = (sessionId: string) =>
  `${API_BASE_URL}/api/replay/${sessionId}/export.csv`;
export const getPrintableReportUrl = (sessionId: string) =>
  `${API_BASE_URL}/api/replay/${sessionId}/report.html`;

// Vision & Voice
export const getVisionStatus = () => apiGet<any>("/api/vision/status");
export const setVisionProvider = (provider: string) =>
  apiPost<any>("/api/vision/provider", { provider });
export const captureEvidenceFrame = (sessionId: string, data: any) =>
  apiPost<any>(`/api/vision/sessions/${sessionId}/evidence`, data);
export const getSessionEvidence = (sessionId: string) =>
  apiGet<any[]>(`/api/vision/sessions/${sessionId}/evidence`);
export const getSessionAnnouncements = (sessionId: string) =>
  apiGet<any[]>(`/api/vision/sessions/${sessionId}/announcements`);

// Settings
export const getSettings = () => apiGet<any>("/api/settings");
export const updateSettings = (data: Record<string, string>) =>
  apiPost<any>("/api/settings/update", data);
export const updateThresholds = (data: Record<string, any>) =>
  apiPost<any>("/api/settings/thresholds", data);

// WebSocket Telemetry Helper
export function connectTelemetryWebSocket(
  sessionId: string,
  onMessage: (data: any) => void,
  onError?: (err: any) => void,
  onClose?: () => void
): WebSocket {
  const wsUrl = `${WS_BASE_URL}/api/telemetry/ws/${sessionId}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log(`[SkillDrone WS] Connected to session ${sessionId}`);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("[SkillDrone WS] Parse error", e);
    }
  };

  ws.onerror = (err) => {
    console.error("[SkillDrone WS] Error", err);
    if (onError) onError(err);
  };

  ws.onclose = () => {
    console.log(`[SkillDrone WS] Closed for session ${sessionId}`);
    if (onClose) onClose();
  };

  return ws;
}
