# SkillDrone Safety Notice & System Limitations

> [!WARNING]
> **EDUCATIONAL & VOCATIONAL TRAINING NOTICE**
> SkillDrone is engineered strictly as an educational diagnostic training platform, simulation benchmark, and competency assessment tool. It is **NOT** certified for life-critical industrial safety, explosive atmosphere entry (ATEX / IECEx), or emergency first-response gas mitigation.

---

## 1. Regulatory Boundaries & Compliance Scope

1. **Not a Certified Life-Safety Device**:
   The multi-sensor payload on the drone (MQ-4, MQ-7, MLX90614) provides indicative spatial measurements to teach trainees diagnostic decision-making, systematic search methodology, and evidence gathering. It must never substitute for certified fixed gas monitors (OSHA / EN 50073) or calibrated hand-held flame-ionization detectors.

2. **Explosion Hazard / Zone Classification**:
   Standard commercial drones (brushless motors, exposed LiPo connectors, non-potted electronics) are **ignition sources**. Under no circumstances should a non-intrinsically-safe drone be deployed into real explosive environments (Zone 0 / Zone 1 hazardous areas). Real-world aerial gas inspection in explosive zones requires ATEX Zone 1 certified, purged, and sealed UAV architectures.

3. **Autonomous Flight Boundaries**:
   The flight control system must always maintain a Human-in-the-Loop (HITL) manual override through the pilot transmitter. Automated waypoint inspection paths must comply with local aviation authority guidelines (FAA Part 107 / DGCA regulations), including line-of-sight (VLOS) maintenance and propeller guard installation.

---

## 2. Hardwired Safety-Critical Assessment Overrides

In the SkillDrone assessment rubric, high-consequence failure modes override all points:

1. **Unreported Critical Gas Leak**:
   If an active explosive methane or toxic carbon monoxide hazard is present in the training scenario and the trainee certifies the facility as `clear_to_operate` or fails to detect the leak, the system triggers an **Immediate Safety-Critical Failure**. The session score is marked as Failed regardless of flight coverage or distance.

2. **Gross Inappropriate Action**:
   Selecting `scheduled_maintenance` for an immediate high-pressure gas leak is marked as a safety violation. Required industrial actions are `isolate_valve` or `evacuate_area`.
