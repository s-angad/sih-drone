import json
from sqlalchemy.orm import Session
from app.models.models import Trainee, Mission, MissionScenario, SystemConfig

def init_db_data(db: Session):
    """Seeds predefined trainees, missions, and hidden ground-truth scenarios if not present."""
    
    # 1. Trainees
    if db.query(Trainee).count() == 0:
        trainees = [
            Trainee(
                trainee_code="TR-2026-001",
                name="Alex Morgan",
                email="alex.morgan@trade-academy.edu",
                trade_specialization="gas_fitting",
                notes="Level 2 apprentice, strong spatial skills, working on gas leak isolation protocols."
            ),
            Trainee(
                trainee_code="TR-2026-002",
                name="Priya Sharma",
                email="priya.sharma@trade-academy.edu",
                trade_specialization="industrial_maintenance",
                notes="Certified electromechanical technician trainee, practicing thermal predictive maintenance."
            ),
            Trainee(
                trainee_code="TR-2026-003",
                name="Marcus Vance",
                email="marcus.vance@trade-academy.edu",
                trade_specialization="welding",
                notes="Advanced structural welder trainee, focusing on hot-work safety and arc hazard containment."
            )
        ]
        for t in trainees:
            db.add(t)
        db.commit()

    # 2. Predefined Missions
    if db.query(Mission).count() == 0:
        # Common workshop layout
        default_layout = {
            "workshop_name": "Vocational Training Bay 4 - Industrial Diagnostics",
            "dimensions": {"width": 20.0, "length": 15.0, "height": 4.5},
            "pipes": [
                {"id": "P-01", "name": "Main Gas Header", "from": {"x": 2.0, "y": 3.0, "z": 2.0}, "to": {"x": 18.0, "y": 3.0, "z": 2.0}, "diameter_in": 4, "type": "gas_manifold"},
                {"id": "P-02", "name": "Boiler Feed Branch", "from": {"x": 10.5, "y": 3.0, "z": 2.0}, "to": {"x": 10.5, "y": 8.0, "z": 2.0}, "diameter_in": 2, "type": "gas_branch"},
                {"id": "P-03", "name": "High-Temp Steam Return", "from": {"x": 4.0, "y": 12.0, "z": 2.5}, "to": {"x": 16.0, "y": 12.0, "z": 2.5}, "diameter_in": 3, "type": "steam_line"},
                {"id": "P-04", "name": "Cooling Loop", "from": {"x": 16.0, "y": 5.0, "z": 1.5}, "to": {"x": 16.0, "y": 12.0, "z": 1.5}, "diameter_in": 2, "type": "water_line"},
            ],
            "valves": [
                {"id": "V-01", "name": "Main Isolation Valve", "position": {"x": 3.0, "y": 3.0, "z": 1.8}, "status": "OPEN", "critical_shutdown": True},
                {"id": "V-02", "name": "Manifold Junction Valve", "position": {"x": 10.5, "y": 3.2, "z": 1.8}, "status": "OPEN", "critical_shutdown": False},
                {"id": "V-03", "name": "Steam By-pass Valve", "position": {"x": 12.0, "y": 12.0, "z": 2.2}, "status": "CLOSED", "critical_shutdown": True},
            ],
            "joints": [
                {"id": "J-01", "name": "High-Pressure Flange Joint A", "position": {"x": 6.5, "y": 3.0, "z": 2.0}},
                {"id": "J-02", "name": "Flange Gasket Manifold Elbow", "position": {"x": 10.5, "y": 3.2, "z": 1.8}},
                {"id": "J-03", "name": "Expansion Coupling B", "position": {"x": 14.5, "y": 3.0, "z": 2.0}},
            ],
            "workstations": [
                {"id": "WS-01", "name": "Rotary Slurry Pump Bed", "position": {"x": 15.8, "y": 8.4, "z": 0.8}, "size": {"dx": 2.5, "dy": 2.0}},
                {"id": "WS-02", "name": "Welding & Fabrication Station", "position": {"x": 6.0, "y": 9.5, "z": 0.8}, "size": {"dx": 3.0, "dy": 2.5}},
                {"id": "WS-03", "name": "High-Voltage Distribution Panel", "position": {"x": 13.0, "y": 11.2, "z": 1.5}, "size": {"dx": 1.5, "dy": 0.8}},
            ],
            "obstacles": [
                {"id": "OB-01", "name": "Structural Support Column 1", "position": {"x": 8.0, "y": 6.0, "z": 2.2}, "radius": 0.4},
                {"id": "OB-02", "name": "Tool Storage Gantry", "position": {"x": 3.0, "y": 8.0, "z": 1.0}, "radius": 0.8},
            ]
        }

        # --- MISSION 1: Suspected Pipe Leak ---
        m1 = Mission(
            mission_code="MSN-GAS-01",
            title="Suspected Gas Distribution Flange Leak",
            trade="gas_fitting",
            difficulty="beginner",
            description="Inspect the primary gas manifold for suspected combustible gas leakage. Identify leaking flange joints and determine if emergency line isolation is required.",
            inspection_bounds_json=json.dumps({"x_min": 1.0, "x_max": 19.0, "y_min": 1.0, "y_max": 14.0, "z_min": 0.5, "z_max": 3.5}),
            required_sensors_json=json.dumps(["mq4_gas", "thermal_ir"]),
            assessment_weights_json=json.dumps({"hazard_id": 30.0, "location_accuracy": 25.0, "coverage": 15.0, "evidence": 15.0, "safety": 15.0}),
            safety_critical_rules_json=json.dumps({"fail_on_unreported_critical_gas": True, "fail_on_critical_hotspot_disregard": False})
        )
        db.add(m1)
        db.flush()

        s1 = MissionScenario(
            mission_id=m1.id,
            hidden_faults_json=json.dumps([
                {
                    "fault_id": "FLT-GAS-01",
                    "fault_type": "pipe_gas_leak",
                    "x": 10.5,
                    "y": 3.2,
                    "z": 1.8,
                    "radius_meters": 2.2,
                    "peak_intensity": 780.0, # ADC counts
                    "gas_type": "methane_mq4",
                    "severity": "critical",
                    "description": "Degraded neoprene flange gasket producing elevated methane emission at Manifold Elbow J-02."
                }
            ]),
            environment_layout_json=json.dumps(default_layout),
            simulation_seed=101,
            noise_factor=0.04,
            sensor_drift_rate=0.008,
            comm_drop_probability=0.02
        )
        db.add(s1)

        # --- MISSION 2: Abnormal Equipment Temperature ---
        m2 = Mission(
            mission_code="MSN-THERM-02",
            title="Abnormal Equipment Temperature & Bearing Overheat",
            trade="industrial_maintenance",
            difficulty="intermediate",
            description="Survey mechanical drives and slurry pump workstations using infrared thermography. Detect localized hotspots and evaluate thermal runaway risk.",
            inspection_bounds_json=json.dumps({"x_min": 1.0, "x_max": 19.0, "y_min": 1.0, "y_max": 14.0, "z_min": 0.5, "z_max": 3.5}),
            required_sensors_json=json.dumps(["thermal_ir", "mq7_co"]),
            assessment_weights_json=json.dumps({"hazard_id": 30.0, "location_accuracy": 25.0, "coverage": 15.0, "evidence": 15.0, "safety": 15.0}),
            safety_critical_rules_json=json.dumps({"fail_on_unreported_critical_gas": False, "fail_on_critical_hotspot_disregard": True})
        )
        db.add(m2)
        db.flush()

        s2 = MissionScenario(
            mission_id=m2.id,
            hidden_faults_json=json.dumps([
                {
                    "fault_id": "FLT-THM-01",
                    "fault_type": "hot_spot_overheating",
                    "x": 15.8,
                    "y": 8.4,
                    "z": 1.0,
                    "radius_meters": 1.8,
                    "temp_delta_c": 56.0, # Ambient 24C + 56C = 80C hotspot
                    "severity": "critical",
                    "description": "Slurry Pump WS-01 inboard bearing unlubricated and experiencing severe friction overheat."
                }
            ]),
            environment_layout_json=json.dumps(default_layout),
            simulation_seed=202,
            noise_factor=0.03,
            sensor_drift_rate=0.005,
            comm_drop_probability=0.015
        )
        db.add(s2)

        # --- MISSION 3: Multi-Hazard Inspection ---
        m3 = Mission(
            mission_code="MSN-MULTI-03",
            title="Multi-Hazard Facility Survey: Arc Flash & CO Infiltration",
            trade="welding",
            difficulty="advanced",
            description="Conduct a comprehensive multi-spectral aerial assessment across the welding booth and power distribution cabinets. Reconcile concurrent gas and electromagnetic hazards.",
            inspection_bounds_json=json.dumps({"x_min": 1.0, "x_max": 19.0, "y_min": 1.0, "y_max": 14.0, "z_min": 0.5, "z_max": 4.0}),
            required_sensors_json=json.dumps(["mq4_gas", "mq7_co", "thermal_ir", "uv_flame"]),
            assessment_weights_json=json.dumps({"hazard_id": 30.0, "location_accuracy": 25.0, "coverage": 15.0, "evidence": 15.0, "safety": 15.0}),
            safety_critical_rules_json=json.dumps({"fail_on_unreported_critical_gas": True, "fail_on_critical_hotspot_disregard": True})
        )
        db.add(m3)
        db.flush()

        s3 = MissionScenario(
            mission_id=m3.id,
            hidden_faults_json=json.dumps([
                {
                    "fault_id": "FLT-GAS-02",
                    "fault_type": "pipe_gas_leak",
                    "gas_type": "co",
                    "x": 6.0,
                    "y": 9.5,
                    "z": 1.4,
                    "radius_meters": 2.0,
                    "peak_intensity": 620.0,
                    "severity": "critical",
                    "description": "Welding booth localized incomplete combustion exhaust leak causing Carbon Monoxide buildup."
                },
                {
                    "fault_id": "FLT-ARC-01",
                    "fault_type": "electrical_arcing",
                    "x": 13.0,
                    "y": 11.2,
                    "z": 1.5,
                    "radius_meters": 1.5,
                    "uv_flux_uw_cm2": 38.0,
                    "temp_delta_c": 32.0,
                    "severity": "critical",
                    "description": "Distribution panel main breaker arcing due to loose busbar connection."
                }
            ]),
            environment_layout_json=json.dumps(default_layout),
            simulation_seed=303,
            noise_factor=0.05,
            sensor_drift_rate=0.01,
            comm_drop_probability=0.03
        )
        db.add(s3)

        db.commit()

    # 3. System Configuration
    configs = [
        ("SIMULATION_SPEED_MULTIPLIER", "1.0", "Global simulation clock multiplier"),
        ("DRONE_DEFAULT_ALTITUDE_METERS", "1.8", "Standard hover altitude for payload inspection"),
        ("DATA_SOURCE_MODE", "simulation", "Active data source: 'simulation' or 'hardware_esp32'"),
        ("EDUCATIONAL_DISCLAIMER_ACCEPTED", "true", "Compliance flag for vocational training")
    ]
    for k, v, desc in configs:
        if not db.query(SystemConfig).filter(SystemConfig.config_key == k).first():
            db.add(SystemConfig(config_key=k, config_value=v, description=desc))
    db.commit()
