# SkillDrone — Smart India Hackathon (SIH) Evaluator Guide

This guide provides a rapid, timed script for pitching and evaluating SkillDrone for Smart India Hackathon (SIH) evaluators, industrial jury members, and technical examiners.

---

## 1. Quick Pitch (First 60 Seconds)
- **The Problem**: Vocational trainees in plumbing, gas fitting, and HVAC cannot safely practice hazardous inspection (explosive gas leaks, high-voltage arcing, boiler hotspots) on physical sites without severe safety risks.
- **The Solution**: SkillDrone is an intelligent drone-assisted vocational training and competency assessment platform. It transforms standard UAV sensor telemetry into a quantitative 100-point diagnostic competency workflow.
- **Key Innovation**: Not simply attaching sensors to a drone, but providing a **1-click end-to-end guided simulation** on a single unified screen: first-person 3D WebGL camera view, modular computer vision grounded to workshop assets, sensor-vision spatial fusion, real-time synthesized voice announcements, audible controller alarms, and automated 100-point rubric scoring.

---

## 2. The Evaluator Journey (One Unified Screen on Home)

The entire demonstration takes place right at: **`http://localhost:3000`**

Evaluators do **not** need to navigate separately between different tabs to experience the complete platform.

### Step 1: Open the Home Dashboard
1. Navigate to `http://localhost:3000`.
2. Notice the clean hero:
   - Heading: **Train Smarter. Inspect Safer.**
   - 3 value cards: *Inspect Facility*, *Detect & Investigate*, *Learn & Receive a Score*.
   - Simple mission preview of the industrial workshop, target assets, and sensor thresholds.
3. Click **How It Works** in the header to view the 4-step workflow explainer.

### Step 2: One-Click "Start Guided Simulation"
1. Click the large cyan button: **▶ Start Guided Simulation**.
2. The browser automatically enables voice synthesis and the screen transforms into the **Unified Simulation Screen**.
3. Watch the 5-step mission lifecycle unfold automatically:
   - **Step 1 of 5 (Takeoff)**: Drone lifts off, progress highlights *Takeoff*, and initial pipeline patrol begins.
   - **Step 2 of 5 (Inspect & Asset Identification)**: Drone camera moves along the corridor; computer vision identifies `Pipe Joint J-02` (Flange Gasket Manifold Elbow).
   - **Step 3 of 5 (Detect)**: Chemical gas sensor spikes to ~780 ADC counts. Audible double-chime sounds and voice announcement speaks: *"Warning. Elevated gas reading detected near Pipe Joint J-02. The drone is performing a closer inspection."*
   - **Step 4 of 5 (Investigate)**: The system commands an adaptive stationary hover scan. The drone holds position over J-02, verifies persistence, and captures an annotated visual evidence frame.
   - **Step 5 of 5 (Assess)**: System finalizes findings and submits diagnosis to the backend assessment engine. Trainee is awarded **98/100 (PASSED)**.

### Step 3: Inspect Findings & Final Competency Report
1. On mission completion, the **Final Diagnostic Inspection Report** modal automatically appears:
   - Evaluates the 5 rubric dimensions: Hazard ID (30/30), Location Accuracy (25/25, <0.3m error), Coverage (15/15), Evidence (15/15), Safety Mitigation (15/15).
   - Shows the captured photographic evidence frame with telemetry metadata.
   - Shows the spoken announcement history.
2. Click **Printable Report (HTML)**: opens the executive audit printout (`/api/replay/{id}/report.html`) complete with examiner signature blocks.
3. Click **Replay Flight** to scrub the flight path, or click **Reset Demo** to return to the clean home dashboard.

---

## 3. Explaining Advanced Concepts to Judges

If an evaluator asks technical questions, point out the built-in explanation features:
- **"What am I seeing?" Button**: Explains the 3D WebGL camera feed in everyday terms (yellow = natural gas, green = cooling water, red = valves).
- **"How was this detected?" Button**: Explains sensor-vision fusion (cameras cannot see invisible gas; readings are mathematically correlated with visible pipe joints).
- **Technical Details Accordion**: Expands raw ADC counts, mV calibration curves, and 3D spatial coordinates.
- **Advanced Tools Menu**: Discreetly links to `/live`, `/vision`, `/replay`, and `/hardware` for deep-dive technical evaluations.
