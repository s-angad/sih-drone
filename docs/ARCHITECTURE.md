# SkillDrone System Architecture & Data Flow

SkillDrone combines real-time sensor processing, deterministic physics simulation, spatial workshop mapping, adaptive reinspection recommendations, and a transparent 100-point competency assessment engine.

---

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph "Aerial Diagnostic Payload"
        FC[Flight Controller\nPX4 / ArduPilot\nAttitude & Stabilization]
        ESP[ESP32 Payload Node\nSensors Acquisition]
        Sensors["MQ-4 Methane\nMQ-7 CO\nThermal IR\nUV Flame"]
        Sensors --> ESP
    end

    subgraph "SkillDrone Backend (FastAPI)"
        HAL[Hardware Abstraction Layer\nESP32 Ingestion Adapter]
        SimEngine[Deterministic Simulation Engine\nPhysics, Gaussian Plumes, Noise, Drift]
        Detector[Hazard Event Detector\nPersistence Filters & Slew Limiter]
        AdaptiveAI[Adaptive Reinspection Engine\nActionable Investigation Rules]
        Assessment[Competency Assessment Engine\n100-Pt Rubric & Safety Rules]
        SQLite[(SQLite / PostgreSQL DB\nPersistence & Audits)]
        WSBroker[WebSocket Live Stream Broker]
    end

    subgraph "SkillDrone Frontend (Next.js & React)"
        UI_Dash[Dashboard & KPI Overview]
        UI_Map[Interactive 2D Workshop Map\nSVG Spatial Floorplan]
        UI_Gauges[Real-time Sensor Gauges]
        UI_Diag[Diagnostic Decision Modal]
        UI_Replay[Session Replay & CSV Export]
    end

    ESP -->|JSON / WiFi or UART| HAL
    SimEngine -->|Synthetic Telemetry| Detector
    HAL -->|Real Telemetry| Detector
    Detector -->|Hazard Events| AdaptiveAI
    Detector -->|Audit Records| SQLite
    AdaptiveAI -->|Recommendations| WSBroker
    Detector -->|Live Alerts| WSBroker
    SimEngine -->|Frame 2.0 Hz| WSBroker
    
    WSBroker <-->|Bidirectional WS| UI_Map
    WSBroker -->|Live Readings| UI_Gauges
    UI_Map -->|Steer / Hover Command| SimEngine
    UI_Diag -->|Trainee Diagnosis| Assessment
    Assessment -->|Scoring Breakdown| SQLite
    SQLite --> UI_Replay
    SQLite --> UI_Dash
```

---

## Mission Lifecycle Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Trainee as Trainee / Apprentice
    participant UI as Next.js Live Control
    participant API as FastAPI Backend
    participant Sim as Deterministic Simulation Engine
    participant Det as Hazard Event Detector
    participant Reinspect as Adaptive Reinspection
    participant Eval as Competency Assessment Engine
    participant DB as Persistent Database

    Trainee->>UI: Select Mission & Trainee -> Click Start
    UI->>API: POST /api/sessions/{id}/start
    API->>Sim: Initialize Physics & Hidden Ground Truth
    API-->>UI: Session status: in_progress
    UI->>API: Connect WebSocket /api/telemetry/ws/{id}

    loop Every 500ms (2.0 Hz)
        Sim->>Sim: Calculate Kinematics, Battery, & Plume Dispersions
        Sim->>Det: Evaluate Sensor Health & Thresholds
        opt Anomaly Detected
            Det->>DB: Record HazardEvent
            Det->>Reinspect: Generate Adaptive Recommendations
        end
        Sim->>UI: Broadcast TelemetryFrame & Active Alerts
    end

    opt Suspicious Reading Observed
        Reinspect-->>UI: Recommend Stationary Hover Scan
        Trainee->>UI: Click "Command Drone Reinspection"
        UI->>Sim: Steer Drone / Pause at Target Coordinates
    end

    Trainee->>UI: Click "Submit Diagnosis"
    Trainee->>UI: Fill Diagnosis Form (Type, Coords, Severity, Safety Action)
    UI->>API: POST /api/sessions/{id}/submit_diagnosis
    API->>Eval: Compare Diagnosis vs Hidden Ground Truth
    Eval->>Eval: Compute 100-Pt Rubric & Check Safety-Critical Violations
    Eval->>DB: Save AssessmentResult & Lock Session
    API-->>UI: Return Assessment Breakdown & Certification Status
    UI-->>Trainee: Display Visual Rubric & Feedback
```
