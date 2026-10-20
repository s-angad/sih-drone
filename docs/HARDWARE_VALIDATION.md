# SkillDrone ESP32 Payload Wiring & Hardware Validation

This guide outlines physical pinouts, wiring schematics, I2C bus setup, and Hardware-in-the-Loop (HIL) test verification for the SkillDrone ESP32 payload acquisition node.

---

## 1. Hardware Architecture & Safety Separation

SkillDrone strictly isolates **flight-critical avionics** from **payload sensor acquisition**:

- **Flight Controller (Pixhawk / PX4 / SpeedyBee)**: Handles attitude control, motor ESC mixing, gyro stabilization, and failsafe return-to-launch (RTL).
- **ESP32 Sensor Node (ESP32-WROOM-32)**: Handles gas sensing, thermopile I2C reads, telemetry serialization, and ground station communication.

```
       +------------------------------------+
       |   Pixhawk / Flight Controller      |
       |  (Attitude, Gyros, ESCs, GPS)      |
       +-----------------+------------------+
                         | MAVLink / Optical Flow (Position x, y, z)
                         v
       +-----------------+------------------+
       |       ESP32 Payload Node           |
       |  (Sensor Acquisition & Telemetry)  |
       +--------+--------+--------+---------+
                |        |        |
             MQ-4     MQ-7    MLX90614
            (ADC)    (ADC)      (I2C)
```

---

## 2. ESP32 Pin Allocation Map

| ESP32 Pin | Function | Peripheral / Channel | Target Sensor |
|---|---|---|---|
| **GPIO 34** | Analog In | ADC1 CH6 | MQ-4 Methane Sensor (AOUT) |
| **GPIO 35** | Analog In | ADC1 CH7 | MQ-7 Carbon Monoxide (AOUT) |
| **GPIO 32** | Analog In | ADC1 CH4 | UV Flame / Arc Sensor (AOUT) |
| **GPIO 36** | Analog In | ADC1 CH0 | LiPo Voltage Divider ($100\text{k}/33\text{k}$) |
| **GPIO 21** | Digital I/O | I2C SDA (Wire) | MLX90614 Non-Contact IR SDA |
| **GPIO 22** | Digital Out | I2C SCL (Wire) | MLX90614 Non-Contact IR SCL |
| **GPIO 2**  | Digital Out | GPIO Output | Status Indicator LED |

> [!NOTE]
> Only **ADC1** pins (GPIO 32–39) are used. ADC2 is disabled on ESP32 whenever WiFi is active.

---

## 3. Hardware-in-the-Loop (HIL) Framework

For testing without physical hardware, SkillDrone provides the `HardwareInTheLoopSimulator` (`backend/app/services/hil_simulator.py`).

### Running HIL Validation Sequence:
```python
from app.services.hil_simulator import hil_simulator

# Runs 20 frame packet validation against hardware adapter
result = hil_simulator.run_validation_sequence(num_frames=20)
print(result)
# {'total_tested': 20, 'valid_frames': 20, 'success_rate_pct': 100.0, 'errors': []}
```

### Injected Fault Modes Supported:
- `nominal`: Clean baseline signals with healthy sensors
- `gas_leak`: Elevated MQ-4 ADC counts ($820 \pm 25$)
- `co_hazard`: Elevated MQ-7 ADC counts ($760 \pm 20$)
- `thermal_hotspot`: Elevated MLX90614 surface temperature ($84^\circ\text{C}$)
- `sensor_disconnect`: Pin pulled to ground ($\text{ADC} = 2$) $\to$ triggers `disconnected`
- `sensor_saturation`: ADC railed to $3.3\text{V}$ ($\text{ADC} = 4094$) $\to$ triggers `degraded`
