# SkillDrone API & Protocol Specification

This document details the REST endpoints, WebSocket telemetry streaming format, and the `SKILLDRONE_ESP32_V1` payload protocol.

---

## 1. Authentication & Security Headers

| Header | Description | Required On |
|---|---|---|
| `x-trainer-token` | Secret trainer key (`settings.DEMO_AUTH_TOKEN`) required to access hidden ground-truth scenario faults. | `GET /api/missions/{id}/scenario`, `GET /api/replay/{id}` (during in-progress sessions) |

---

## 2. REST Endpoints Overview

### Missions (`/api/missions`)
- `GET /api/missions`: Lists all active training missions. Hidden scenario fault coordinates are omitted.
- `GET /api/missions/{id}`: Retrieves single mission specification.
- `GET /api/missions/{id}/scenario`: **Trainer only**. Requires `x-trainer-token` header. Returns ground-truth fault locations and simulation seed.
- `POST /api/missions`: Creates a new mission with hidden faults.
- `DELETE /api/missions/{id}`: Deletes a mission.

### Trainees (`/api/trainees`)
- `GET /api/trainees`: Lists registered trainees.
- `POST /api/trainees`: Registers a new trainee.
- `GET /api/trainees/{id}/profile`: Trainee competency profile with mission history.

### Sessions (`/api/sessions`)
- `POST /api/sessions`: Initializes a new training session (`status: "pending"`).
- `POST /api/sessions/{id}/start`: Starts session, initializes physics engine (`status: "in_progress"`).
- `POST /api/sessions/{id}/decision`: Logs trainee action (hover, sweep, waypoint inspect).
- `POST /api/sessions/{id}/submit_diagnosis`: Submits diagnosis, computes 100-pt rubric, locks session (`status: "completed"`).
- `POST /api/sessions/{id}/abort`: Aborts session.

### Replay & Audits (`/api/replay`)
- `GET /api/replay/{session_id}`: Retrieves complete flight trajectory, sensor traces, hazard events, and ground-truth comparison.
- `GET /api/replay/{session_id}/export.csv`: Downloads raw CSV sensor log.
- `GET /api/replay/{session_id}/report`: Structured diagnostic training summary report.

### Hardware (`/api/hardware`)
- `GET /api/hardware/status`: Ingestion protocol and sensor capability info.
- `POST /api/hardware/telemetry`: Ingests raw JSON frame from physical ESP32.

---

## 3. Real-Time Telemetry WebSocket Protocol

**Endpoint:** `ws://127.0.0.1:8000/api/telemetry/ws/{session_id}`

### Upstream Messages (Client to Backend):
```json
{
  "action": "steer",
  "x": 10.5,
  "y": 6.2,
  "z": 1.8
}
```
Supported actions: `"steer"`, `"pause"`, `"resume"`.

### Downstream Messages (Backend to Client, 2.0 Hz):
```json
{
  "type": "TELEMETRY",
  "frame": {
    "session_id": "ses-1234",
    "sequence_number": 42,
    "timestamp": "2026-10-20T12:00:00Z",
    "position": {"x": 10.2, "y": 5.1, "z": 1.8},
    "heading_deg": 45.0,
    "speed_mps": 0.8,
    "battery_pct": 92.4,
    "is_simulated": true,
    "link_quality_pct": 98.0,
    "sensors": [
      {
        "sensor_type": "mq4_gas",
        "raw_value": 780.0,
        "calibrated_value": 1044.0,
        "unit": "ADC_counts",
        "sensor_health": "nominal"
      }
    ]
  },
  "hazards": [
    {
      "rule_name": "MQ4_GAS_CRITICAL_EXCEEDANCE",
      "severity": "critical",
      "confidence": 0.94,
      "details": "CRITICAL [NEW]: Reading 780.0 ADC_counts..."
    }
  ],
  "recommendations": [
    {
      "action_type": "stationary_hover",
      "priority": "high",
      "title": "Stationary Plume Hover Scan",
      "reason": "Elevated gas signature detected..."
    }
  ],
  "session_status": "in_progress",
  "battery_pct": 92.4
}
```

---

## 4. SKILLDRONE_ESP32_V1 Protocol Specification

Payload sent from physical ESP32 to `POST /api/hardware/telemetry`:

```json
{
  "proto": "SKILLDRONE_ESP32_V1",
  "seq": 104,
  "drone_id": "DRONE-ALPHA",
  "session_id": "3e9b04f2-97f2-45e0-8fa5-01e9d1e3895a",
  "battery_mv": 11850,
  "link_quality": 95.0,
  "pos": {
    "x": 6.2,
    "y": 4.1,
    "z": 1.8
  },
  "sensors": [
    {"type": "mq4_gas", "raw_adc": 810, "health": "nominal"},
    {"type": "mq7_co", "raw_adc": 195, "health": "nominal"},
    {"type": "thermal_ir", "raw_c": 26.8, "health": "nominal"},
    {"type": "uv_flame", "raw_adc": 18, "health": "nominal"}
  ]
}
```
