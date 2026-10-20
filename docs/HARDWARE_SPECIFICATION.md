# SkillDrone Hardware Specification & Validation Plan

## 1. Hardware Architecture Overview
The SkillDrone physical hardware implementation employs a **two-tier architecture**:

1. **Flight-Critical Stabilization Tier:**
   - Dedicated commercial off-the-shelf (COTS) flight controller (Pixhawk / SpeedyBee F405 / Matek).
   - Runs PX4, ArduPilot, or Betaflight.
   - Responsible for IMU attitude estimation, motor mixing, barometer altitude hold, optical flow velocity hold, and radio failsafes.
   - **Independence:** The vocational training web application has NO direct control over low-level motor PWMs or stability loops.

2. **Diagnostic Sensor Payload Tier:**
   - ESP32-WROOM-32 microcontroller node.
   - Interfaces with MQ-4 (methane), MQ-7 (CO), MLX90614 (non-contact IR temperature), and UV flame sensors.
   - Formats telemetry into the `SKILLDRONE_ESP32_V1` JSON schema.
   - Streams payloads to the ground station over WiFi (UDP/HTTP) or 915MHz telemetry UART.

---

## 2. Flight Controller MAVLink Telemetry Bridge
To correlate sensor anomalies with drone position $(x, y, z)$, the ESP32 can receive MAVLink position packets from the flight controller's `TELEM2` port:

- **Protocol:** MAVLink v2
- **Message IDs:**
  - `#32 LOCAL_POSITION_NED`: Supplies optical flow or indoor relative coordinates $(x, y, z)$ and velocities $(v_x, v_y, v_z)$.
  - `#147 BATTERY_STATUS`: Supplies total battery voltage and consumed mAh.
- **Hardware Connection:**
  - Flight Controller `TELEM2 TX` $\rightarrow$ ESP32 `GPIO 16 (RX2)`
  - Flight Controller `TELEM2 RX` $\leftarrow$ ESP32 `GPIO 17 (TX2)`
  - Common Ground (`GND`)

---

## 3. Sensor Specifications & Operational Limitations

### A. MQ-4 Combustible Gas Sensor
- **Target Gas:** Methane ($CH_4$), Natural Gas, Hydrocarbons.
- **Sensing Element:** Tin Dioxide ($SnO_2$) semiconductor.
- **Output:** Analog voltage proportional to surface resistance variation $R_s / R_0$.
- **Response Time:** $t_{90} \approx 5$ to $10$ seconds.
- **Known Limitations:**
  - *Heater Warm-up Time:* Requires a minimum of 3 to 5 minutes of preheating before readings stabilize.
  - *Lack of Factory Multi-point Calibration:* Raw 12-bit ADC values ($0-4095$) should **NOT** be represented as certified parts-per-million ($ppm$) without controlled gas chamber calibration curves.
  - *Cross-sensitivity:* Also responds to high concentrations of ethanol vapor and LPG.

### B. MLX90614 Non-Contact Infrared Thermometer
- **Target Measurement:** Surface infrared emission (8 to 14 µm wavelength).
- **Field of View (FOV):** 35° (DCI gradient model) or 90° standard.
- **Accuracy:** $\pm 0.5^\circ\text{C}$ in ambient range.
- **Interface:** I2C (SMBus compatible) at 100 kHz.
- **Limitation:** Emissivity varies across polished metal pipes vs painted cast iron. Trainees are taught to perform hover scans at perpendicular angles.

---

## 4. Bill of Materials (BOM)

| Item | Component Description | Recommended Model | Approx. Price (USD) |
|---|---|---|---|
| 1 | Microcontroller Module | ESP32-WROOM-32D 38-Pin Dev Board | \$5.50 |
| 2 | Combustible Gas Sensor | MQ-4 Gas Detection Module | \$3.20 |
| 3 | Carbon Monoxide Sensor | MQ-7 Carbon Monoxide Module | \$3.50 |
| 4 | Infrared Temperature Sensor | MLX90614-DCI Non-contact Thermometer | \$14.00 |
| 5 | UV Spectral Radiation Sensor | UVM-30A / Guva-S12SD Photodiode Module | \$6.80 |
| 6 | Auxiliary Power Regulator | 5V 3A UBEC DC-DC Step-Down | \$4.00 |
| 7 | Passive Resistors & Wiring | 100kΩ / 33kΩ metal film resistors, JST-GH cables | \$2.00 |
| **Total** | **Auxiliary Payload Package** | | **~\$39.00** |

---

## 5. Hardware Validation & Calibration Plan

1. **Step 1: Electrical Bench Verification**
   - Connect ESP32 to 5V bench power supply.
   - Verify 5.0V heater rail and 3.3V logic rail voltages with a digital multimeter.
   - Monitor current consumption (expected ~ 320 to 400 mA with both MQ heaters active).

2. **Step 2: ADC Zero-Baseline Validation**
   - Place sensors in ambient clean air for 10 minutes.
   - Verify baseline raw ADC readings hover between 150 and 280 counts.
   - Confirm standard deviation $\sigma < 15$ counts.

3. **Step 3: Controlled Source Response Test**
   - Introduce low-concentration butane/methane test stream at 0.5m distance.
   - Confirm immediate slew rate exceedance and transition from `nominal` to `suspected`.
   - Verify persistence filter requires 2 consecutive elevated frames before emitting `critical`.

4. **Step 4: Tethered Flight Vibration & Prop-Wash Test**
   - Mount sensor payload to drone airframe under prop wash.
   - Run motors at 40% hover throttle.
   - Verify mechanical vibrations do not induce electrical rail disconnection errors or ADC saturation.
