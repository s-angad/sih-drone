# SkillDrone ESP32 Sensor Telemetry Firmware

## Overview
This firmware runs on an ESP32 microcontroller mounted to the inspection drone as an **auxiliary sensor payload node**. 
It samples combustible gas (MQ-4), carbon monoxide (MQ-7), non-contact infrared temperature (MLX90614), and UV arc radiation, formatting and streaming JSON frames to the SkillDrone backend.

> **CRITICAL SAFETY DIRECTIVE:**
> The ESP32 is strictly a telemetry payload processor. All drone flight stabilization, attitude control, rotor mixing, and emergency failsafes MUST remain isolated on the certified flight controller (e.g., PX4 / ArduPilot). The ESP32 must not control flight surfaces or motor PWMs.

---

## Required Hardware Components
1. **ESP32 Development Board** (ESP32-WROOM-32D / ESP32-S3)
2. **MQ-4 Gas Sensor Module** (Methane / Natural Gas)
3. **MQ-7 Gas Sensor Module** (Carbon Monoxide)
4. **MLX90614 Non-contact Infrared Thermometer** (I2C)
5. **UVM-30A UV Sensor** (Arc flash detection)
6. **5V 3A UBEC DC-DC Step-Down Regulator** (Dedicated heater power)
7. **Voltage Divider Resistors** (100kΩ & 33kΩ for 3S LiPo battery monitoring)

---

## Wiring & Pinout
| Sensor / Peripheral | ESP32 Pin | Interface | Power Rail |
|---------------------|-----------|-----------|------------|
| MQ-4 Analog Out     | GPIO 34   | ADC1 CH6  | 5V (from UBEC) |
| MQ-7 Analog Out     | GPIO 35   | ADC1 CH7  | 5V (from UBEC) |
| UV Sensor Out       | GPIO 32   | ADC1 CH4  | 3.3V       |
| Battery Voltage Div | GPIO 36   | ADC1 CH0  | LiPo (max 12.6V) |
| MLX90614 SDA        | GPIO 21   | I2C SDA   | 3.3V       |
| MLX90614 SCL        | GPIO 22   | I2C SCL   | 3.3V       |
| Status LED          | GPIO 2    | Digital   | Internal   |

---

## Flashing Instructions (Arduino IDE)
1. Install **ESP32 Board Support** via Arduino Board Manager (`https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`).
2. Install **ArduinoJson** library (v6 or v7) by Benoit Blanchon.
3. Open `skilldrone_esp32_payload.ino`.
4. Update `WIFI_SSID`, `WIFI_PASSWORD`, and `BACKEND_URL` to match your local network.
5. Connect ESP32 via Micro-USB, select board **"ESP32 Dev Module"**, and upload at 115200 baud.
