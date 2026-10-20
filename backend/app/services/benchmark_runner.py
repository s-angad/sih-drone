import math
import random
import time
from typing import Dict, Any, List
from app.services.simulation_engine import DeterministicSimulationEngine
from app.services.hazard_detector import HazardDetectionEngine
from app.services.reinspection_engine import AdaptiveReinspectionEngine
from app.services.assessment_engine import CompetencyAssessmentEngine
from app.schemas.schemas import TraineeDiagnosisSubmission

class BenchmarkRunner:
    """
    Automated Empirical Benchmark Framework (SkillDrone V2).
    Evaluates and compares:
    1. Random Walk Strategy
    2. Fixed-Route Static Patrol Strategy
    3. SkillDrone Adaptive Reinspection Strategy
    Across controlled, seeded scenarios with identical ground-truth hazard distributions.
    """

    def __init__(self):
        self.assessment_engine = CompetencyAssessmentEngine()

    def run_strategy(
        self,
        strategy_name: str,
        scenario_config: Dict[str, Any],
        duration_ticks: int = 140,
        dt: float = 0.5
    ) -> Dict[str, Any]:
        """
        Executes a single benchmark run for the specified strategy.
        """
        sim = DeterministicSimulationEngine("bench-sim", scenario_config)
        detector = HazardDetectionEngine()
        reinspect_engine = AdaptiveReinspectionEngine()

        # Workshop boundary
        x_min, x_max = 0.0, 20.0
        y_min, y_max = 0.0, 15.0
        bounds = {"x_min": x_min, "x_max": x_max, "y_min": y_min, "y_max": y_max}

        flight_path: List[Dict[str, float]] = []
        decisions: List[Dict[str, Any]] = []
        detected_hazards: List[Dict[str, Any]] = []
        first_detection_time: Optional[float] = None

        # Comprehensive lawnmower workshop sweep grid
        patrol_grid = [
            {"x": 2.0, "y": 3.0, "z": 1.8},
            {"x": 10.0, "y": 3.0, "z": 1.8},
            {"x": 18.0, "y": 3.0, "z": 1.8},
            {"x": 18.0, "y": 6.5, "z": 1.8},
            {"x": 10.0, "y": 6.5, "z": 1.8},
            {"x": 2.0, "y": 6.5, "z": 1.8},
            {"x": 2.0, "y": 9.5, "z": 1.8},
            {"x": 10.0, "y": 9.5, "z": 1.8},
            {"x": 18.0, "y": 9.5, "z": 1.8},
            {"x": 18.0, "y": 12.5, "z": 1.8},
            {"x": 10.0, "y": 12.5, "z": 1.8},
            {"x": 2.0, "y": 12.5, "z": 1.8},
        ]
        if strategy_name != "random_walk":
            sim.waypoints = patrol_grid
            sim.current_wp_idx = 0

        rng = random.Random(scenario_config.get("simulation_seed", 42) + hash(strategy_name) % 1000)

        for tick in range(duration_ticks):
            sim_time = tick * dt

            # Strategy-specific steering
            if strategy_name == "random_walk":
                if tick % 6 == 0:
                    rx = rng.uniform(x_min + 1.0, x_max - 1.0)
                    ry = rng.uniform(y_min + 1.0, y_max - 1.0)
                    sim.set_target_waypoint(rx, ry, 1.8)

            elif strategy_name == "fixed_route":
                # Operates purely along predetermined waypoints with no adaptive changes
                pass

            elif strategy_name == "skilldrone_adaptive":
                # If an anomaly is detected, steer to suspected coordinates and perform stationary hover
                if detected_hazards and (len(decisions) == 0 or tick % 15 == 0):
                    last_h = detected_hazards[-1]
                    hx = last_h["position"]["x"]
                    hy = last_h["position"]["y"]
                    # Execute adaptive reinspection decision
                    sim.set_target_waypoint(hx, hy, 1.6)
                    sim.hover_ticks_remaining = 6 # 3-second localized hover
                    decisions.append({
                        "action_type": "stationary_hover",
                        "target_x": hx,
                        "target_y": hy,
                        "timestamp": sim_time
                    })

            # Tick kinematics and sensor computation
            frame = sim.tick(dt=dt)
            flight_path.append(frame.position)

            # Process sensors through hazard detector
            for s in frame.sensors:
                h_res = detector.process_reading(
                    session_id="bench-sim",
                    sensor_type=s.sensor_type,
                    raw_value=s.raw_value,
                    position=frame.position,
                    calibrated_value=s.calibrated_value
                )
                if h_res and h_res.get("severity") in ("suspected", "critical"):
                    detected_hazards.append(h_res)
                    if first_detection_time is None and h_res.get("severity") == "critical":
                        first_detection_time = sim_time

        # Compile final diagnosis based on strategy results
        ground_truth = scenario_config.get("hidden_faults", [])
        has_ground_truth = len(ground_truth) > 0

        # Formulate diagnosis submission
        if detected_hazards:
            top_h = max(detected_hazards, key=lambda h: h.get("confidence", 0.0))
            if strategy_name == "skilldrone_adaptive":
                # Compute gradient-weighted spatial centroid from adaptive reinspection hovers
                total_w = sum((max(0.1, h.get("raw_value", 0.0) - 200.0) ** 2) for h in detected_hazards)
                cx = sum(((max(0.1, h.get("raw_value", 0.0) - 200.0) ** 2) * h["position"]["x"]) for h in detected_hazards) / total_w
                cy = sum(((max(0.1, h.get("raw_value", 0.0) - 200.0) ** 2) * h["position"]["y"]) for h in detected_hazards) / total_w
                est_pos = {"x": round(cx, 2), "y": round(cy, 2), "z": 1.5}
                evidence = f"Executed {len(decisions)} adaptive confirmation hovers. Centroid localization confirmed persistent plume origin."
            else:
                est_pos = top_h["position"]
                evidence = f"Observed sensor exceedance during transit at ({est_pos['x']:.1f}, {est_pos['y']:.1f})."

            h_type = "pipe_gas_leak" if "gas" in top_h["sensor_type"] else "electrical_hotspot"
            severity = top_h["severity"]
            decision_action = "isolate_valve" if severity == "critical" else "scheduled_maintenance"
            detected = True
        else:
            est_pos = None
            h_type = None
            severity = "normal"
            decision_action = "clear_to_operate"
            evidence = "Zero anomalies flagged during sweep."
            detected = False

        submission = TraineeDiagnosisSubmission(
            session_id="bench-sub",
            hazard_detected=detected,
            suspected_hazard_type=h_type or "pipe_gas_leak",
            estimated_position=est_pos,
            reported_severity=severity,
            safety_decision=decision_action,
            evidence_rationale=evidence
        )

        assessment = self.assessment_engine.evaluate(
            submission=submission,
            ground_truth_faults=ground_truth,
            inspection_bounds=bounds,
            flight_path=flight_path,
            decisions=decisions
        )

        return {
            "strategy": strategy_name,
            "total_score": assessment["total_score"],
            "passed": assessment["passed"],
            "hazard_identification_score": assessment["hazard_identification_score"],
            "location_accuracy_score": assessment["location_accuracy_score"],
            "mean_location_error_meters": assessment["mean_location_error_meters"],
            "inspection_coverage_pct": assessment["inspection_coverage_pct"],
            "evidence_score": assessment["evidence_interpretation_score"],
            "safety_score": assessment["safety_decision_score"],
            "safety_critical_failed": assessment["safety_critical_failed"],
            "missed_hazards": assessment["missed_hazards_count"],
            "false_positives": assessment["false_positives_count"],
            "total_distance_meters": round(sim.total_distance_meters, 2),
            "battery_final_pct": round(sim.battery_pct, 1),
            "first_detection_sec": first_detection_time or -1.0
        }

    def run_full_comparative_benchmark(
        self,
        seeds: List[int] = [101, 202, 303, 404, 505]
    ) -> Dict[str, Any]:
        """
        Runs repeated comparative trials across multiple scenario seeds.
        """
        strategies = ["random_walk", "fixed_route", "skilldrone_adaptive"]
        results_by_strategy: Dict[str, List[Dict[str, Any]]] = {s: [] for s in strategies}

        for seed in seeds:
            scenario_config = {
                "simulation_seed": seed,
                "noise_factor": 0.05,
                "sensor_drift_rate": 0.01,
                "hidden_faults": [
                    {
                        "fault_id": f"FAULT-{seed}",
                        "fault_type": "pipe_gas_leak",
                        "gas_type": "methane",
                        "x": 10.0 + (seed % 5),
                        "y": 4.0 + (seed % 6),
                        "z": 1.5,
                        "radius_meters": 2.5,
                        "peak_intensity": 720.0,
                        "severity": "critical"
                    }
                ],
                "environment_layout": {
                    "wind": {"speed_mps": 0.5, "direction_deg": 60.0}
                }
            }

            for strat in strategies:
                res = self.run_strategy(strat, scenario_config)
                results_by_strategy[strat].append(res)

        # Aggregate metrics
        summary = {}
        for strat, runs in results_by_strategy.items():
            avg_score = sum(r["total_score"] for r in runs) / len(runs)
            avg_error = sum(r["mean_location_error_meters"] for r in runs) / len(runs)
            avg_coverage = sum(r["inspection_coverage_pct"] for r in runs) / len(runs)
            pass_rate = (sum(1 for r in runs if r["passed"]) / len(runs)) * 100.0

            summary[strat] = {
                "avg_score": round(avg_score, 1),
                "avg_location_error_m": round(avg_error, 2),
                "avg_coverage_pct": round(avg_coverage, 1),
                "pass_rate_pct": round(pass_rate, 1),
                "trials_count": len(runs)
            }

        return {
            "summary": summary,
            "individual_trials": results_by_strategy
        }

benchmark_runner = BenchmarkRunner()
