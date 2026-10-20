import csv
import io
import json
from typing import List, Dict, Any, Optional

class DiagnosticReportGenerator:
    """
    Generates standard audit CSV logs, formatted JSON diagnostic summaries,
    and printable executive HTML inspection reports (SkillDrone V2).
    """

    @staticmethod
    def generate_sensor_events_csv(sensor_events: List[Any]) -> str:
        """Outputs RFC 4180 compliant CSV stream for recorded telemetry events"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Event_ID",
            "Session_ID",
            "Sequence_Num",
            "Timestamp_UTC",
            "Sensor_Type",
            "Raw_Value",
            "Calibrated_Value",
            "Measurement_Unit",
            "Position_X_m",
            "Position_Y_m",
            "Position_Z_m",
            "Sensor_Health",
            "Is_Simulated"
        ])

        for ev in sensor_events:
            writer.writerow([
                getattr(ev, "id", ""),
                getattr(ev, "session_id", ""),
                getattr(ev, "sequence_number", 0),
                getattr(ev, "timestamp", "").isoformat() if hasattr(getattr(ev, "timestamp", ""), "isoformat") else str(getattr(ev, "timestamp", "")),
                getattr(ev, "sensor_type", ""),
                getattr(ev, "raw_value", 0.0),
                getattr(ev, "calibrated_value", ""),
                getattr(ev, "measurement_unit", ""),
                getattr(ev, "position_x", 0.0),
                getattr(ev, "position_y", 0.0),
                getattr(ev, "position_z", 0.0),
                getattr(ev, "sensor_health", "nominal"),
                "SIMULATED" if getattr(ev, "is_simulated", True) else "HARDWARE"
            ])

        return output.getvalue()

    @staticmethod
    def generate_session_summary_dict(
        session: Any,
        assessment: Any,
        trainee: Any,
        mission: Any,
        hazard_events: List[Any],
        decisions: List[Any],
        evidence_frames: Optional[List[Any]] = None,
        voice_announcements: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """Creates unified structured summary for printable replay or export"""
        breakdown = {}
        if assessment and getattr(assessment, "scoring_breakdown_json", None):
            try:
                breakdown = json.loads(assessment.scoring_breakdown_json)
            except Exception:
                breakdown = {}

        return {
            "session_code": getattr(session, "session_code", ""),
            "status": getattr(session, "status", ""),
            "data_source": getattr(session, "data_source", "simulation"),
            "duration_seconds": getattr(session, "duration_seconds", 0.0),
            "start_time": getattr(session, "start_time", None),
            "end_time": getattr(session, "end_time", None),
            "total_distance_meters": getattr(session, "total_distance_meters", 0.0),
            "trainee": {
                "name": getattr(trainee, "name", "Unknown Trainee"),
                "trainee_code": getattr(trainee, "trainee_code", ""),
                "trade": getattr(trainee, "trade_specialization", ""),
            },
            "mission": {
                "title": getattr(mission, "title", "Diagnostic Mission"),
                "trade": getattr(mission, "trade", ""),
                "difficulty": getattr(mission, "difficulty", "intermediate"),
            },
            "assessment": {
                "total_score": getattr(assessment, "total_score", 0.0) if assessment else 0.0,
                "passed": getattr(assessment, "passed", False) if assessment else False,
                "safety_critical_failed": getattr(assessment, "safety_critical_failed", False) if assessment else False,
                "hazard_identification_score": getattr(assessment, "hazard_identification_score", 0.0) if assessment else 0.0,
                "location_accuracy_score": getattr(assessment, "location_accuracy_score", 0.0) if assessment else 0.0,
                "inspection_coverage_score": getattr(assessment, "inspection_coverage_score", 0.0) if assessment else 0.0,
                "evidence_interpretation_score": getattr(assessment, "evidence_interpretation_score", 0.0) if assessment else 0.0,
                "safety_decision_score": getattr(assessment, "safety_decision_score", 0.0) if assessment else 0.0,
                "scoring_breakdown": breakdown,
                "instructor_feedback": getattr(assessment, "instructor_feedback", "") if assessment else "",
            },
            "total_hazards_logged": len(hazard_events),
            "total_decisions_made": len(decisions),
            "evidence_frames_count": len(evidence_frames) if evidence_frames else 0,
            "voice_announcements_count": len(voice_announcements) if voice_announcements else 0,
        }

    @staticmethod
    def generate_printable_html_report(
        session: Any,
        assessment: Any,
        trainee: Any,
        mission: Any,
        hazard_events: List[Any],
        decisions: List[Any],
        evidence_frames: List[Any],
        voice_announcements: List[Any]
    ) -> str:
        """Generates executive printable HTML audit report"""
        score = getattr(assessment, "total_score", 0.0) if assessment else 0.0
        passed = getattr(assessment, "passed", False) if assessment else False
        safety_failed = getattr(assessment, "safety_critical_failed", False) if assessment else False

        badge_class = "pass" if (passed and not safety_failed) else "fail"
        badge_text = "COMPETENCY CERTIFIED (PASSED)" if (passed and not safety_failed) else ("SAFETY CRITICAL FAILURE" if safety_failed else "REQUIREMENTS NOT MET")

        # Hazards rows
        hazards_rows = ""
        for h in hazard_events:
            sev_color = "#dc2626" if h.severity == "critical" else "#f59e0b"
            hazards_rows += f"""
            <tr>
                <td>{h.timestamp.strftime('%H:%M:%S') if h.timestamp else '-'}</td>
                <td><span style="color: {sev_color}; font-weight: bold;">{h.severity.upper()}</span></td>
                <td>{h.sensor_type}</td>
                <td>{h.raw_value:.1f} {h.measurement_unit}</td>
                <td>({h.position_x:.1f}m, {h.position_y:.1f}m, {h.position_z:.1f}m)</td>
                <td><strong>{getattr(h, 'associated_object_id', None) or 'Unresolved'}</strong></td>
                <td>{h.details or '-'}</td>
            </tr>
            """
        if not hazards_rows:
            hazards_rows = "<tr><td colspan='7' style='text-align: center; color: #64748b;'>No hazard events logged during session.</td></tr>"

        # Evidence frames rows
        evidence_cards = ""
        for ef in evidence_frames:
            ann_text = ""
            if ef.annotations_json:
                try:
                    ann_list = json.loads(ef.annotations_json)
                    ann_text = ", ".join([f"{a.get('object_class')} ({a.get('object_id', 'Asset')})" for a in ann_list[:3]])
                except Exception:
                    ann_text = ""

            evidence_cards += f"""
            <div class="evidence-card">
                <div class="evidence-header">
                    <strong>Event: {ef.trigger_event_type}</strong> | {ef.timestamp.strftime('%H:%M:%S') if ef.timestamp else ''}
                </div>
                <div class="evidence-body">
                    <p><strong>Drone Position:</strong> ({ef.drone_pos_x:.1f}m, {ef.drone_pos_y:.1f}m, {ef.drone_pos_z:.1f}m) | <strong>Heading:</strong> {ef.drone_heading_deg:.0f}&deg;</p>
                    <p><strong>Associated Asset:</strong> <span style="color: #0284c7; font-weight: bold;">{ef.associated_object_id or 'Visual Unresolved'}</span></p>
                    {f'<p><strong>Detected Objects:</strong> {ann_text}</p>' if ann_text else ''}
                    {f'<p><strong>Sensor Telemetry:</strong> <code>{ef.fused_sensor_summary}</code></p>' if ef.fused_sensor_summary else ''}
                </div>
            </div>
            """
        if not evidence_cards:
            evidence_cards = "<p style='color: #64748b;'>No visual evidence snapshots captured.</p>"

        # Voice announcements
        voice_rows = ""
        for va in voice_announcements:
            voice_rows += f"""
            <tr>
                <td>{va.timestamp.strftime('%H:%M:%S') if va.timestamp else '-'}</td>
                <td><span class="prio-{va.priority}">{va.priority.upper()}</span></td>
                <td>{va.category}</td>
                <td>{va.message_text}</td>
            </tr>
            """
        if not voice_rows:
            voice_rows = "<tr><td colspan='4' style='text-align: center; color: #64748b;'>No voice announcements recorded.</td></tr>"

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SkillDrone Inspection Audit Report — {getattr(session, 'session_code', '')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 30px; color: #1e293b; background: #fff; }}
        .header {{ border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-start; }}
        h1 {{ margin: 0; font-size: 24px; color: #0f172a; }}
        .badge {{ display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 14px; text-transform: uppercase; }}
        .badge.pass {{ background: #dcfce7; color: #166534; border: 1px solid #86efac; }}
        .badge.fail {{ background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }}
        .section {{ margin-bottom: 30px; }}
        h2 {{ font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }}
        .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }}
        .card .title {{ font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }}
        .card .value {{ font-size: 18px; font-weight: bold; color: #0f172a; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }}
        th, td {{ border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }}
        th {{ background: #f1f5f9; color: #475569; font-weight: bold; }}
        .evidence-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }}
        .evidence-card {{ border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f8fafc; }}
        .evidence-header {{ background: #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: bold; }}
        .evidence-body {{ padding: 10px 12px; font-size: 11px; }}
        .evidence-body p {{ margin: 4px 0; }}
        .prio-critical {{ color: #dc2626; font-weight: bold; }}
        .prio-warning {{ color: #d97706; font-weight: bold; }}
        .prio-info {{ color: #0284c7; }}
        .footer {{ font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 40px; text-align: center; }}
        @media print {{ body {{ margin: 10mm; }} }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>SkillDrone Inspection Audit Report</h1>
            <p style="margin: 4px 0; color: #64748b; font-size: 13px;">Session Code: <strong>{getattr(session, 'session_code', '')}</strong> | Mission: <strong>{getattr(mission, 'title', 'Diagnostic Mission')}</strong></p>
            <p style="margin: 0; color: #64748b; font-size: 12px;">Trainee: <strong>{getattr(trainee, 'name', 'Unknown')}</strong> ({getattr(trainee, 'trade_specialization', 'Vocational')})</p>
        </div>
        <div>
            <span class="badge {badge_class}">{badge_text}</span>
            <div style="font-size: 26px; font-weight: bold; text-align: right; margin-top: 6px; color: #0f172a;">{score:.1f} / 100</div>
        </div>
    </div>

    <div class="section">
        <h2>Mission Overview & Flight Telemetry</h2>
        <div class="grid">
            <div class="card">
                <div class="title">Duration</div>
                <div class="value">{getattr(session, 'duration_seconds', 0.0):.1f}s</div>
            </div>
            <div class="card">
                <div class="title">Distance Flown</div>
                <div class="value">{getattr(session, 'total_distance_meters', 0.0):.1f}m</div>
            </div>
            <div class="card">
                <div class="title">Hazards Flagged</div>
                <div class="value">{len(hazard_events)}</div>
            </div>
            <div class="card">
                <div class="title">Decisions Logged</div>
                <div class="value">{len(decisions)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Competency Assessment Breakdown (100-Point Rubric)</h2>
        <table>
            <thead>
                <tr>
                    <th>Rubric Dimension</th>
                    <th>Weight</th>
                    <th>Score Earned</th>
                    <th>Assessment Notes</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Hazard Identification</strong></td>
                    <td>30.0 pts</td>
                    <td><strong>{getattr(assessment, 'hazard_identification_score', 0.0):.1f}</strong></td>
                    <td>Identified anomalies, verified type classification against scenario faults.</td>
                </tr>
                <tr>
                    <td><strong>Location Accuracy</strong></td>
                    <td>25.0 pts</td>
                    <td><strong>{getattr(assessment, 'location_accuracy_score', 0.0):.1f}</strong></td>
                    <td>Spatial error: {getattr(assessment, 'mean_location_error_meters', 0.0):.2f}m from ground truth fault origin.</td>
                </tr>
                <tr>
                    <td><strong>Inspection Coverage</strong></td>
                    <td>15.0 pts</td>
                    <td><strong>{getattr(assessment, 'inspection_coverage_score', 0.0):.1f}</strong></td>
                    <td>Flight corridor coverage: {getattr(assessment, 'inspection_coverage_pct', 0.0):.1f}% of designated bay.</td>
                </tr>
                <tr>
                    <td><strong>Evidence Interpretation</strong></td>
                    <td>15.0 pts</td>
                    <td><strong>{getattr(assessment, 'evidence_interpretation_score', 0.0):.1f}</strong></td>
                    <td>Diagnostic notes rationale and adaptive confirmation hovers performed.</td>
                </tr>
                <tr>
                    <td><strong>Safety Decision</strong></td>
                    <td>15.0 pts</td>
                    <td><strong>{getattr(assessment, 'safety_decision_score', 0.0):.1f}</strong></td>
                    <td>Appropriate mitigation selection (valve isolation / evacuation).</td>
                </tr>
            </tbody>
        </table>
        {f'<p style="color: #dc2626; font-weight: bold; margin-top: 10px;">SAFETY CRITICAL BREACH: Facility declared safe or improper action taken while active high-consequence hazard was present.</p>' if safety_failed else ''}
    </div>

    <div class="section">
        <h2>Hazard Detection & Vision Fusion Ledger</h2>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Severity</th>
                    <th>Sensor</th>
                    <th>Reading</th>
                    <th>Coordinates</th>
                    <th>Associated Visual Asset</th>
                    <th>Diagnostic Details</th>
                </tr>
            </thead>
            <tbody>
                {hazards_rows}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Annotated Camera Evidence Frames</h2>
        <div class="evidence-grid">
            {evidence_cards}
        </div>
    </div>

    <div class="section">
        <h2>Voice Announcement Transcript</h2>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Priority</th>
                    <th>Category</th>
                    <th>Announcement Text</th>
                </tr>
            </thead>
            <tbody>
                {voice_rows}
            </tbody>
        </table>
    </div>

    <div class="footer">
        SkillDrone Platform v2.0 &bull; Simulated Drone Vocational Inspection &bull; For Educational & Assessment Use Only
    </div>
</body>
</html>
        """
        return html

report_generator = DiagnosticReportGenerator()
