import math
import random
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.schemas.schemas import TelemetryFrame, SingleSensorReading

class DeterministicSimulationEngine:
    """
    Deterministic Physics & Sensor Simulation Engine (SkillDrone V2).
    Simulates:
    - Advective/turbulent Gaussian gas dispersion with wind vector dependence
    - Conical Field-of-View (FOV 35°) nadir thermopile temperature integration
    - Directional inverse-square optical UV radiation
    - First-order sensor dynamic lag (RC time constant tau) for MOX/thermopile sensors
    - Non-linear 3S LiPo discharge curve with throttle-dependent current sag
    - Aligned cartesian/screen coordinate kinematics
    """

    def __init__(self, session_id: str, scenario_config: Dict[str, Any], initial_battery: float = 100.0):
        self.session_id = session_id
        self.seed = scenario_config.get("simulation_seed", 42)
        self.rng = random.Random(self.seed)

        self.noise_factor = scenario_config.get("noise_factor", 0.05)
        self.drift_rate = scenario_config.get("sensor_drift_rate", 0.01)
        self.comm_drop_prob = scenario_config.get("comm_drop_probability", 0.02)
        
        # Ground truth hidden faults & environment
        self.hidden_faults: List[Dict[str, Any]] = scenario_config.get("hidden_faults", [])
        self.environment = scenario_config.get("environment_layout", {})

        # Ambient atmospheric parameters
        env_wind = self.environment.get("wind", {})
        self.wind_speed = float(env_wind.get("speed_mps", 0.6))
        self.wind_dir_deg = float(env_wind.get("direction_deg", 45.0)) # 0 deg = East (+X), 90 deg = South (+Y)
        self.ambient_temp_c = float(self.environment.get("ambient_temp_c", 24.5))

        # Drone State
        self.tick_count = 0
        self.pos_x = 2.0
        self.pos_y = 2.0
        self.pos_z = 1.5
        self.heading_deg = 0.0
        self.speed_mps = 0.0
        self.total_distance_meters = 0.0
        self.is_paused = False

        # Battery Model (3S 2200mAh LiPo)
        self.battery_capacity_ah = 2.2
        self.battery_soc = initial_battery / 100.0 # 0.0 to 1.0
        self.battery_r_internal = 0.045 # Ohms internal pack resistance
        self.battery_pct = initial_battery

        # Sensor Dynamic State (1st-order dynamic lag filters: y_t = y_{t-1} + dt/tau * (u_t - y_{t-1}))
        # Time constants: MQ MOX sensors ~3.0s, Thermal IR ~0.6s, UV ~0.1s
        self.tau_mq4 = 3.0
        self.tau_mq7 = 3.0
        self.tau_thermal = 0.6
        self.tau_uv = 0.15

        self.filter_state = {
            "mq4": 210.0,
            "mq7": 190.0,
            "thermal": self.ambient_temp_c,
            "uv": 1.5
        }

        # Build patrol flight plan (waypoints across the workshop inspection corridors)
        self.waypoints = [
            {"x": 2.0, "y": 2.0, "z": 1.5},
            {"x": 6.0, "y": 2.5, "z": 1.8},
            {"x": 10.0, "y": 3.0, "z": 2.0},
            {"x": 14.0, "y": 4.0, "z": 2.0},
            {"x": 17.0, "y": 7.0, "z": 2.2},
            {"x": 16.0, "y": 12.0, "z": 2.0},
            {"x": 11.0, "y": 12.0, "z": 1.8},
            {"x": 7.0, "y": 10.0, "z": 1.6},
            {"x": 4.0, "y": 8.0, "z": 1.5},
            {"x": 2.0, "y": 4.0, "z": 1.5},
        ]
        self.current_wp_idx = 0
        self.hover_ticks_remaining = 0

    def set_target_waypoint(self, x: float, y: float, z: float = 1.8):
        """Allows trainee manual flight steering or targeted reinspection"""
        self.waypoints.insert(self.current_wp_idx, {"x": x, "y": y, "z": z})
        self.hover_ticks_remaining = 0

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def update_kinematics(self, dt: float = 0.5):
        """Advances drone position toward next waypoint with smooth steering and velocity limits"""
        if self.is_paused:
            self.speed_mps = 0.0
            return

        # Power consumption calculation:
        # Base electronics ~1.2A, Hover ~9.5A, Flight speed adds dynamic load
        max_speed = 1.2
        if self.hover_ticks_remaining > 0:
            self.hover_ticks_remaining -= 1
            self.speed_mps = 0.0
            current_draw_amps = 1.2 + 9.5
        elif not self.waypoints:
            self.speed_mps = 0.0
            current_draw_amps = 1.2 + 9.5
        else:
            target = self.waypoints[self.current_wp_idx]
            dx = target["x"] - self.pos_x
            dy = target["y"] - self.pos_y
            dz = target["z"] - self.pos_z
            dist = math.sqrt(dx*dx + dy*dy + dz*dz)

            if dist < 0.35: # Reached waypoint
                self.current_wp_idx = (self.current_wp_idx + 1) % len(self.waypoints)
                self.hover_ticks_remaining = self.rng.randint(2, 5) # momentary scan pause
                self.speed_mps = 0.0
                current_draw_amps = 1.2 + 9.5
            else:
                self.speed_mps = min(max_speed, dist / dt)
                move_dist = self.speed_mps * dt

                ratio = move_dist / dist
                new_x = self.pos_x + dx * ratio
                new_y = self.pos_y + dy * ratio
                new_z = self.pos_z + dz * ratio

                step_len = math.sqrt((new_x - self.pos_x)**2 + (new_y - self.pos_y)**2 + (new_z - self.pos_z)**2)
                self.total_distance_meters += step_len

                # Heading calculation: 0 deg = East (+X), 90 deg = South (+Y)
                if math.hypot(dx, dy) > 0.05:
                    self.heading_deg = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0

                self.pos_x = round(new_x, 3)
                self.pos_y = round(new_y, 3)
                self.pos_z = round(new_z, 3)

                # Aerodynamic thrust load current
                speed_ratio = min(1.0, self.speed_mps / max_speed)
                current_draw_amps = 1.2 + 9.5 * (1.0 + 0.65 * (speed_ratio ** 2))

        # Battery discharge integration (3S LiPo)
        discharge_ah = (current_draw_amps * (dt / 3600.0))
        self.battery_soc = max(0.0, self.battery_soc - (discharge_ah / self.battery_capacity_ah))

        # Non-linear LiPo OCV voltage curve per cell:
        soc = self.battery_soc
        if soc > 0.8:
            cell_ocv = 3.90 + (soc - 0.8) / 0.2 * (4.20 - 3.90)
        elif soc > 0.2:
            cell_ocv = 3.70 + (soc - 0.2) / 0.6 * (3.90 - 3.70)
        else:
            cell_ocv = 3.20 + (soc / 0.2) * (3.70 - 3.20)

        pack_ocv = cell_ocv * 3.0
        # Throttle sag under load: V_term = V_ocv - I * R_int
        terminal_voltage = pack_ocv - (current_draw_amps * self.battery_r_internal)
        # Approximate fuel gauge percentage
        self.battery_pct = round(max(0.0, min(100.0, soc * 100.0)), 1)

    def _compute_gas_dispersion(self, fault: Dict[str, Any]) -> float:
        """
        Advective-turbulent Gaussian dispersion model with wind vector dependence.
        Produces realistic downwind plume elongation and cross-wind falloff.
        """
        fx = fault.get("x", 0.0)
        fy = fault.get("y", 0.0)
        fz = fault.get("z", 1.5)
        radius = fault.get("radius_meters", 2.5)
        peak = fault.get("peak_intensity", 650.0)

        dx = self.pos_x - fx
        dy = self.pos_y - fy
        dz = abs(self.pos_z - fz)
        dist_xy = math.hypot(dx, dy)

        # Wind direction angle to radians
        w_rad = math.radians(self.wind_dir_deg)
        cos_w = math.cos(w_rad)
        sin_w = math.sin(w_rad)

        # Rotate relative coordinates into wind reference frame
        # x_w: along-wind (positive downwind), y_w: cross-wind
        x_w = dx * cos_w + dy * sin_w
        y_w = -dx * sin_w + dy * cos_w

        u = max(0.05, self.wind_speed)
        
        # 1. Downwind advective Gaussian plume
        # Dispersion parameters expand downwind
        sigma_y0 = max(0.5, radius * 0.4)
        sigma_z0 = max(0.4, radius * 0.3)
        sigma_y = sigma_y0 + 0.15 * max(0.0, x_w)
        sigma_z = sigma_z0 + 0.10 * max(0.0, x_w)

        if x_w >= -0.4:
            # Downwind plume with ground reflection term
            decay_z = math.exp(-(dz**2) / (2.0 * sigma_z**2))
            decay_y = math.exp(-(y_w**2) / (2.0 * sigma_y**2))
            # Downwind dilution factor
            advection_factor = 1.0 / (1.0 + 0.45 * max(0.0, x_w))
            plume_conc = peak * decay_y * decay_z * advection_factor
        else:
            # Upwind exponential back-diffusion
            plume_conc = peak * math.exp(2.5 * x_w) * math.exp(-(dist_xy**2) / (2.0 * sigma_y0**2))

        # 2. Calm indoor isotropic diffusion fallback when wind is low
        sigma_iso = max(0.7, radius * 0.6)
        iso_conc = peak * math.exp(-(dist_xy**2) / (2.0 * sigma_iso**2)) * math.exp(-dz / 1.5)

        # Blend advective plume with isotropic diffusion based on wind speed
        blend = min(1.0, u / 0.8)
        gas_conc = (blend * plume_conc) + ((1.0 - blend) * iso_conc)

        # Add physical micro-turbulence variability
        turb = 1.0 + self.rng.gauss(0, 0.08)
        return max(0.0, gas_conc * turb)

    def _compute_thermal_ir_reading(self, fault: Dict[str, Any]) -> float:
        """
        Conical Field-of-View (FOV 35 deg) nadir surface temperature integration.
        Accounts for spot-size dilution as drone altitude changes (MLX90614 model).
        """
        fx = fault.get("x", 0.0)
        fy = fault.get("y", 0.0)
        fz = fault.get("z", 1.5)
        temp_delta = fault.get("temp_delta_c", 45.0)

        # Vertical distance from sensor to target plane
        h = max(0.2, abs(self.pos_z - fz))
        # 35-degree conical FOV spot diameter on target plane: D = 2 * h * tan(17.5 deg)
        spot_radius = max(0.15, h * math.tan(math.radians(17.5)))
        spot_area = math.pi * (spot_radius ** 2)

        # Target fault surface footprint (estimated 0.3m radius hotspot)
        hotspot_radius = 0.30
        hotspot_area = math.pi * (hotspot_radius ** 2)

        # Lateral deviation from nadir centerline
        dist_lateral = math.hypot(self.pos_x - fx, self.pos_y - fy)

        # Lateral Gaussian profile
        lateral_decay = math.exp(-(dist_lateral ** 2) / (2.0 * (spot_radius + hotspot_radius) ** 2))

        # Area fill factor (spot-size dilution effect)
        fill_factor = min(1.0, hotspot_area / spot_area)
        ir_delta = temp_delta * fill_factor * lateral_decay

        return ir_delta

    def _compute_uv_optical_reading(self, fault: Dict[str, Any]) -> float:
        """
        Inverse-square optical radiation with receptive cone directional falloff.
        """
        fx = fault.get("x", 0.0)
        fy = fault.get("y", 0.0)
        fz = fault.get("z", 1.5)
        uv_flux = fault.get("uv_flux_uw_cm2", 35.0)

        dist_3d = math.sqrt((self.pos_x - fx)**2 + (self.pos_y - fy)**2 + (self.pos_z - fz)**2)
        # Optical attenuation with distance
        irradiance = uv_flux / (1.0 + 2.8 * (dist_3d ** 2))
        return irradiance

    def compute_sensor_readings(self, dt: float = 0.5) -> List[SingleSensorReading]:
        """
        Calculates physical sensor values with first-order dynamic lag (tau),
        noise, drift, and baseline states.
        """
        readings = []

        # Ambient baseline definitions with sensor warm-up settling
        # First 10 seconds of a flight show transient heater stabilization
        warmup_factor = max(0.0, 1.0 - (self.tick_count * dt) / 10.0)
        warmup_offset_gas = warmup_factor * 35.0

        time_drift = (self.tick_count * dt) * self.drift_rate

        target_mq4 = 210.0 + warmup_offset_gas + time_drift * 0.8 + self.rng.gauss(0, 5.0) * self.noise_factor * 10
        target_mq7 = 190.0 + warmup_offset_gas + time_drift * 0.5 + self.rng.gauss(0, 4.0) * self.noise_factor * 10
        target_temp = self.ambient_temp_c + time_drift * 0.02 + self.rng.gauss(0, 0.2) * self.noise_factor
        target_uv = 1.8 + max(0.0, self.rng.gauss(0, 0.3) * self.noise_factor)

        # Calculate influences from hidden faults
        for fault in self.hidden_faults:
            f_type = fault.get("fault_type", "")

            if "gas" in f_type:
                gas_intensity = self._compute_gas_dispersion(fault)
                if fault.get("gas_type") == "co":
                    target_mq7 += gas_intensity
                else:
                    target_mq4 += gas_intensity

            elif "hot_spot" in f_type or "thermal" in f_type:
                temp_delta = self._compute_thermal_ir_reading(fault)
                target_temp += temp_delta

            elif "arc" in f_type or "flame" in f_type:
                uv_delta = self._compute_uv_optical_reading(fault)
                target_uv += uv_delta

        # Apply 1st-order dynamic low-pass response lag: y_t = y_{t-1} + (dt/tau) * (u_t - y_{t-1})
        alpha_mq4 = min(1.0, dt / self.tau_mq4)
        alpha_mq7 = min(1.0, dt / self.tau_mq7)
        alpha_temp = min(1.0, dt / self.tau_thermal)
        alpha_uv = min(1.0, dt / self.tau_uv)

        self.filter_state["mq4"] += alpha_mq4 * (target_mq4 - self.filter_state["mq4"])
        self.filter_state["mq7"] += alpha_mq7 * (target_mq7 - self.filter_state["mq7"])
        self.filter_state["thermal"] += alpha_temp * (target_temp - self.filter_state["thermal"])
        self.filter_state["uv"] += alpha_uv * (target_uv - self.filter_state["uv"])

        # 1. MQ-4 Methane / Natural Gas Sensor
        mq4_raw = round(max(10.0, min(4090.0, self.filter_state["mq4"] + self.rng.gauss(0, 6.0) * self.noise_factor * 10)), 1)
        mq4_calibrated = round(max(0.0, (mq4_raw - 200.0) * 1.8), 1)
        readings.append(SingleSensorReading(
            sensor_type="mq4_gas",
            raw_value=mq4_raw,
            calibrated_value=mq4_calibrated,
            unit="ADC_counts",
            sensor_health="nominal"
        ))

        # 2. MQ-7 Carbon Monoxide Sensor
        mq7_raw = round(max(10.0, min(4090.0, self.filter_state["mq7"] + self.rng.gauss(0, 5.0) * self.noise_factor * 10)), 1)
        mq7_calibrated = round(max(0.0, (mq7_raw - 180.0) * 0.9), 1)
        readings.append(SingleSensorReading(
            sensor_type="mq7_co",
            raw_value=mq7_raw,
            calibrated_value=mq7_calibrated,
            unit="ADC_counts",
            sensor_health="nominal"
        ))

        # 3. Non-contact Thermal IR Sensor
        temp_val = round(self.filter_state["thermal"] + self.rng.gauss(0, 0.2) * self.noise_factor, 1)
        readings.append(SingleSensorReading(
            sensor_type="thermal_ir",
            raw_value=temp_val,
            calibrated_value=temp_val,
            unit="degC",
            sensor_health="nominal"
        ))

        # 4. UV Flame & Arc Sensor
        uv_val = round(max(0.0, self.filter_state["uv"] + self.rng.gauss(0, 0.3) * self.noise_factor), 1)
        readings.append(SingleSensorReading(
            sensor_type="uv_flame",
            raw_value=uv_val,
            calibrated_value=uv_val,
            unit="uW/cm2",
            sensor_health="nominal"
        ))

        return readings

    def tick(self, dt: float = 0.5) -> TelemetryFrame:
        """Executes one simulation step and returns the generated telemetry frame"""
        self.tick_count += 1
        self.update_kinematics(dt)

        # Check simulated communication link
        link_quality = 100.0
        if self.rng.random() < self.comm_drop_prob:
            link_quality = round(self.rng.uniform(15.0, 45.0), 1)

        readings = self.compute_sensor_readings(dt=dt)

        frame = TelemetryFrame(
            session_id=self.session_id,
            sequence_number=self.tick_count,
            timestamp=datetime.utcnow(),
            position={
                "x": self.pos_x,
                "y": self.pos_y,
                "z": self.pos_z,
            },
            heading_deg=round(self.heading_deg, 1),
            speed_mps=round(self.speed_mps, 2),
            battery_pct=round(self.battery_pct, 1),
            sensors=readings,
            is_simulated=True,
            link_quality_pct=link_quality
        )
        return frame
