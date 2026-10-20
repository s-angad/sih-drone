from typing import Dict, Any, List, Optional
import math
from app.schemas.schemas import TraineeDiagnosisSubmission, AssessmentRubricBreakdown

class CompetencyAssessmentEngine:
    """
    Automated 100-point Vocational Assessment Engine (SkillDrone V2).
    Evaluates trainee diagnostics against hidden scenario ground truth using
    bipartite spatial & semantic association across single or multi-hazard scenarios.
    Strictly enforces safety-critical pass/fail constraints.
    """

    @staticmethod
    def _associate_reports_to_faults(
        reports: List[Dict[str, Any]],
        ground_truth_faults: List[Dict[str, Any]],
        association_radius_meters: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        Greedy bipartite matching between trainee reported hazards and ground truth faults.
        Returns list of match records with distances and classification alignment.
        """
        matches = []
        unmatched_faults = list(ground_truth_faults)

        for report in reports:
            rep_type = str(report.get("hazard_type") or report.get("suspected_hazard_type") or "").lower()
            rep_pos = report.get("position") or report.get("estimated_position") or {"x": 0.0, "y": 0.0, "z": 1.5}
            rx, ry, rz = rep_pos.get("x", 0.0), rep_pos.get("y", 0.0), rep_pos.get("z", 1.5)

            best_fault = None
            best_dist = float("inf")
            best_idx = -1

            for idx, fault in enumerate(unmatched_faults):
                fx = fault.get("x", 0.0)
                fy = fault.get("y", 0.0)
                fz = fault.get("z", 1.5)
                dist = math.sqrt((rx - fx)**2 + (ry - fy)**2 + (rz - fz)**2)

                # Check spatial association gate
                if dist <= association_radius_meters and dist < best_dist:
                    best_dist = dist
                    best_fault = fault
                    best_idx = idx

            if best_fault is not None:
                true_type = str(best_fault.get("fault_type", "")).lower()
                type_matched = (rep_type in true_type) or (true_type in rep_type) or (
                    ("gas" in rep_type and "gas" in true_type) or
                    ("thermal" in rep_type and "thermal" in true_type) or
                    ("temp" in rep_type and "hot" in true_type) or
                    ("uv" in rep_type and "arc" in true_type)
                )

                matches.append({
                    "matched": True,
                    "report": report,
                    "fault": best_fault,
                    "distance_error": best_dist,
                    "type_matched": type_matched
                })
                unmatched_faults.pop(best_idx)
            else:
                matches.append({
                    "matched": False,
                    "report": report,
                    "fault": None,
                    "distance_error": None,
                    "type_matched": False
                })

        return matches, unmatched_faults

    @classmethod
    def evaluate(
        cls,
        submission: TraineeDiagnosisSubmission,
        ground_truth_faults: List[Dict[str, Any]],
        inspection_bounds: Dict[str, float],
        flight_path: List[Dict[str, float]],
        decisions: List[Dict[str, Any]],
        weights: Optional[Dict[str, float]] = None,
        safety_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        weights = weights or {
            "hazard_id": 30.0,
            "location_accuracy": 25.0,
            "coverage": 15.0,
            "evidence": 15.0,
            "safety": 15.0
        }
        safety_rules = safety_rules or {
            "fail_on_unreported_critical_gas": True,
            "fail_on_critical_hotspot_disregard": True
        }

        # Normalize trainee reported hazards
        # Handles both legacy single-hazard submission and multi-hazard payloads
        trainee_reports = []
        if submission.hazard_detected:
            # Check if submission has multiple reported items or single
            sub_dict = submission.model_dump() if hasattr(submission, "model_dump") else {}
            multi_reports = sub_dict.get("suspected_hazards")
            if multi_reports and isinstance(multi_reports, list):
                trainee_reports = multi_reports
            else:
                trainee_reports = [{
                    "hazard_type": submission.suspected_hazard_type,
                    "position": submission.estimated_position,
                    "reported_severity": submission.reported_severity
                }]

        total_true_hazards = len(ground_truth_faults)
        has_true_hazards = total_true_hazards > 0

        # Perform bipartite spatial & semantic association
        matches, unmatched_faults = cls._associate_reports_to_faults(trainee_reports, ground_truth_faults)

        matched_pairs = [m for m in matches if m["matched"]]
        false_positive_reports = [m for m in matches if not m["matched"]]
        missed_faults = unmatched_faults

        true_positives = len(matched_pairs)
        false_positives = len(false_positive_reports)
        missed_hazards = len(missed_faults)

        # ---------------------------------------------------------
        # 1. Hazard Identification Scoring (30 pts default)
        # ---------------------------------------------------------
        hazard_id_score = 0.0
        hazard_notes = []

        if has_true_hazards:
            if true_positives > 0:
                # Base recall score
                recall = true_positives / total_true_hazards
                # Classification precision bonus among matched
                type_correct_count = sum(1 for m in matched_pairs if m["type_matched"])
                type_ratio = type_correct_count / true_positives
                
                # Combine recall (70%) and category accuracy (30%)
                composite_ratio = (recall * 0.70) + (recall * type_ratio * 0.30)
                # Penalize false alarms slightly
                fp_penalty = max(0.0, 1.0 - (0.2 * false_positives))
                hazard_id_score = weights["hazard_id"] * composite_ratio * fp_penalty

                hazard_notes.append(
                    f"Identified {true_positives}/{total_true_hazards} active anomalies. "
                    f"Classification accuracy: {type_correct_count}/{true_positives} correctly categorized."
                )
                if missed_hazards > 0:
                    hazard_notes.append(f"MISSED HAZARDS: {missed_hazards} active faults remained undetected.")
                if false_positives > 0:
                    hazard_notes.append(f"FALSE ALARMS: {false_positives} reported hazards in non-fault locations.")
            else:
                # Trainee detected hazards but none matched actual locations, or trainee reported safe
                if len(trainee_reports) > 0:
                    hazard_id_score = max(0.0, weights["hazard_id"] * 0.2)
                    hazard_notes.append(f"Spurious detections: Reported {len(trainee_reports)} hazards, but none aligned with actual fault positions.")
                else:
                    hazard_id_score = 0.0
                    hazard_notes.append(f"MISSED ALL HAZARDS: Trainee failed to identify any of the {total_true_hazards} active hazards.")
        else:
            # Nominal scenario (0 true faults)
            if not submission.hazard_detected or len(trainee_reports) == 0:
                hazard_id_score = weights["hazard_id"]
                hazard_notes.append("Correctly certified workshop facility as nominal with zero false alarms.")
            else:
                false_positives = len(trainee_reports)
                hazard_id_score = max(0.0, weights["hazard_id"] * 0.25)
                hazard_notes.append(f"FALSE ALARM: Reported {false_positives} anomalies in a completely safe, nominal facility.")

        # ---------------------------------------------------------
        # 2. Location Accuracy Scoring (25 pts default)
        # ---------------------------------------------------------
        loc_score = 0.0
        location_errors = []
        loc_notes = []

        if has_true_hazards:
            if matched_pairs:
                for m in matched_pairs:
                    err = m["distance_error"]
                    location_errors.append(err)

                mean_loc_error = sum(location_errors) / len(location_errors)
                # Calibrated non-linear taper:
                # <= 1.0m: full points (100%)
                # 1.0m - 3.5m: linear decline
                # > 3.5m: 0 pts
                if mean_loc_error <= 1.0:
                    loc_ratio = 1.0
                    loc_notes.append(f"Exceptional spatial localization accuracy: mean error {mean_loc_error:.2f}m.")
                elif mean_loc_error <= 3.5:
                    loc_ratio = max(0.15, 1.0 - ((mean_loc_error - 1.0) / 2.5))
                    loc_notes.append(f"Acceptable localization: mean error {mean_loc_error:.2f}m from fault origins.")
                else:
                    loc_ratio = 0.0
                    loc_notes.append(f"Inaccurate location estimates: mean error {mean_loc_error:.2f}m exceeds operational tolerance (3.5m).")

                # Scale by fraction of faults matched
                loc_score = weights["location_accuracy"] * loc_ratio * (true_positives / total_true_hazards)
            else:
                # No hazards matched
                # If trainee supplied an estimated position, calculate distance to nearest fault for diagnostic feedback
                if submission.estimated_position and ground_truth_faults:
                    est = submission.estimated_position
                    min_dist = min(
                        math.sqrt((est.get("x", 0.0) - f.get("x", 0.0))**2 + (est.get("y", 0.0) - f.get("y", 0.0))**2)
                        for f in ground_truth_faults
                    )
                    mean_loc_error = min_dist
                    loc_notes.append(f"Location estimate deviated by {min_dist:.2f}m from nearest fault.")
                else:
                    mean_loc_error = 0.0
                    loc_notes.append("No valid localization provided for active hazards.")
                loc_score = 0.0
        else:
            mean_loc_error = 0.0
            if not submission.hazard_detected:
                loc_score = weights["location_accuracy"]
                loc_notes.append("Facility nominal: No localization required.")
            else:
                loc_score = 0.0
                loc_notes.append("Spurious coordinates provided for non-existent hazard.")

        # ---------------------------------------------------------
        # 3. Inspection Coverage Scoring (15 pts default)
        # ---------------------------------------------------------
        x_min = inspection_bounds.get("x_min", 0.0)
        x_max = inspection_bounds.get("x_max", 20.0)
        y_min = inspection_bounds.get("y_min", 0.0)
        y_max = inspection_bounds.get("y_max", 15.0)

        grid_cols = max(1, int(math.ceil((x_max - x_min) / 2.5)))
        grid_rows = max(1, int(math.ceil((y_max - y_min) / 2.5)))
        total_bins = grid_cols * grid_rows
        visited_bins = set()

        for pt in flight_path:
            px = pt.get("x", 0.0)
            py = pt.get("y", 0.0)
            if x_min <= px <= x_max and y_min <= py <= y_max:
                col = min(grid_cols - 1, max(0, int((px - x_min) / 2.5)))
                row = min(grid_rows - 1, max(0, int((py - y_min) / 2.5)))
                visited_bins.add((col, row))

        coverage_pct = round((len(visited_bins) / total_bins) * 100.0, 1) if total_bins > 0 else 100.0
        coverage_score = round(weights["coverage"] * min(1.0, coverage_pct / 65.0), 1)
        coverage_notes = [f"Inspection flight covered {coverage_pct}% of designated workshop search envelope."]

        # ---------------------------------------------------------
        # 4. Evidence Interpretation Scoring (15 pts default)
        # ---------------------------------------------------------
        evidence_score = 0.0
        evidence_notes = []

        rationale_len = len(submission.evidence_rationale.strip()) if submission.evidence_rationale else 0
        if rationale_len >= 30:
            evidence_score += weights["evidence"] * 0.5
            evidence_notes.append("Submitted clear diagnostic evidence and observations.")
        elif rationale_len > 0:
            evidence_score += weights["evidence"] * 0.25
            evidence_notes.append("Brief diagnostic notes submitted.")
        else:
            evidence_notes.append("No written diagnostic rationale provided.")

        reinspect_actions = [
            d for d in decisions 
            if d.get("action_type") in ("stationary_hover", "multi_angle_sweep", "sensor_calibration_check")
        ]
        if len(reinspect_actions) >= 1:
            evidence_score += weights["evidence"] * 0.5
            evidence_notes.append(f"Demonstrated good protocol: executed {len(reinspect_actions)} adaptive reinspection verification scans.")
        else:
            evidence_notes.append("Did not conduct stationary hover or confirmation scan before submitting diagnosis.")

        # ---------------------------------------------------------
        # 5. Safety Decision Scoring (15 pts default)
        # ---------------------------------------------------------
        safety_score = 0.0
        safety_notes = []
        safety_critical_failed = False
        critical_flags = []

        if has_true_hazards:
            # Check if any critical severity fault was missed
            critical_unmatched = [f for f in missed_faults if f.get("severity") == "critical"]
            critical_matched = [m for m in matched_pairs if m["fault"].get("severity") == "critical"]

            if critical_unmatched:
                safety_score = 0.0
                safety_notes.append(f"CRITICAL SAFETY BREACH: Missed {len(critical_unmatched)} high-consequence critical hazards.")
                if safety_rules.get("fail_on_unreported_critical_gas", True):
                    safety_critical_failed = True
                    critical_flags.append(f"SAFETY CRITICAL FAILURE: Trainee missed {len(critical_unmatched)} active critical hazard(s).")
            elif not submission.hazard_detected:
                safety_score = 0.0
                safety_notes.append("CRITICAL SAFETY BREACH: Facility declared safe while active hazards were present.")
                safety_critical_failed = True
                critical_flags.append("SAFETY CRITICAL FAILURE: Facility declared clear despite active hazard presence.")
            else:
                # Trainee detected the hazard(s); evaluate safety action taken
                action = submission.safety_decision
                has_critical_hazards = any(f.get("severity") == "critical" for f in ground_truth_faults)

                if has_critical_hazards:
                    if action in ("evacuate_area", "isolate_valve"):
                        safety_score = weights["safety"]
                        safety_notes.append(f"Appropriate emergency mitigation selected: {action.replace('_', ' ').title()}.")
                    elif action == "scheduled_maintenance":
                        safety_score = weights["safety"] * 0.35
                        safety_notes.append("Insufficient mitigation: Scheduled maintenance is hazardous for an immediate leak/hotspot.")
                    else: # clear_to_operate or other inappropriate action
                        safety_score = 0.0
                        safety_critical_failed = True
                        critical_flags.append(f"SAFETY CRITICAL FAILURE: Inappropriate action '{action}' for severe hazard.")
                else:
                    # Low / medium hazards
                    if action in ("isolate_valve", "scheduled_maintenance"):
                        safety_score = weights["safety"]
                        safety_notes.append(f"Controlled containment action selected: {action.replace('_', ' ').title()}.")
                    elif action == "evacuate_area":
                        safety_score = weights["safety"] * 0.75
                        safety_notes.append("Conservative mitigation selected: Evacuated for non-critical hazard.")
                    else:
                        safety_score = weights["safety"] * 0.4
                        safety_notes.append(f"Moderate response selected: {action.replace('_', ' ').title()}.")
        else:
            # Nominal bay
            if submission.safety_decision == "clear_to_operate":
                safety_score = weights["safety"]
                safety_notes.append("Correctly cleared system for normal industrial operation.")
            else:
                safety_score = weights["safety"] * 0.4
                safety_notes.append(f"Unnecessary operational shutdown: {submission.safety_decision}.")

        total_score = round(hazard_id_score + loc_score + coverage_score + evidence_score + safety_score, 1)
        passed = (total_score >= 70.0) and not safety_critical_failed

        breakdown = AssessmentRubricBreakdown(
            hazard_identification={
                "score": round(hazard_id_score, 1),
                "max_score": weights["hazard_id"],
                "true_positives": true_positives,
                "missed_hazards": missed_hazards,
                "false_positives": false_positives,
                "notes": hazard_notes
            },
            location_accuracy={
                "score": round(loc_score, 1),
                "max_score": weights["location_accuracy"],
                "error_meters": round(mean_loc_error, 2),
                "notes": loc_notes
            },
            inspection_coverage={
                "score": round(coverage_score, 1),
                "max_score": weights["coverage"],
                "coverage_pct": coverage_pct,
                "notes": coverage_notes
            },
            evidence_interpretation={
                "score": round(evidence_score, 1),
                "max_score": weights["evidence"],
                "notes": evidence_notes
            },
            safety_decision={
                "score": round(safety_score, 1),
                "max_score": weights["safety"],
                "decision": submission.safety_decision,
                "notes": safety_notes
            },
            critical_safety_notes=critical_flags
        )

        return {
            "total_score": total_score,
            "passed": passed,
            "safety_critical_failed": safety_critical_failed,
            "hazard_identification_score": round(hazard_id_score, 1),
            "location_accuracy_score": round(loc_score, 1),
            "inspection_coverage_score": round(coverage_score, 1),
            "evidence_interpretation_score": round(evidence_score, 1),
            "safety_decision_score": round(safety_score, 1),
            "missed_hazards_count": missed_hazards,
            "false_positives_count": false_positives,
            "mean_location_error_meters": round(mean_loc_error, 2),
            "inspection_coverage_pct": coverage_pct,
            "scoring_breakdown": breakdown
        }

assessment_engine = CompetencyAssessmentEngine()
