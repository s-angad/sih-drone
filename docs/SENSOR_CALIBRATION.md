# SkillDrone Sensor Calibration & Health Heuristics

This guide details calibration characteristics, voltage transfer functions, and real-time electrical health validation implemented for the SkillDrone multi-sensor diagnostic payload.

---

## 1. Supported Sensors & Specifications

| Sensor ID | Measured Physical Quantity | Sensing Mechanism | Range | Interface |
|---|---|---|---|---|
| **MQ-4** | Methane / Natural Gas ($CH_4$) | $\text{SnO}_2$ Metal Oxide Semiconductor | $300 - 10,000\text{ ppm}$ | Analog 12-bit ADC |
| **MQ-7** | Carbon Monoxide ($CO$) | High/Low Temperature Cycle MOX | $20 - 2,000\text{ ppm}$ | Analog 12-bit ADC |
| **MLX90614** | Non-Contact Surface Temp | Thermopile with low-noise ASIC | $-70^\circ\text{C} \text{ to } +380^\circ\text{C}$ | I2C SMBus ($0\times 5\text{A}$) |
| **UV Sensor** | UV Spectral Radiance | GaN / SiC Photodiode | $200 - 370\text{ nm}$ | Analog 12-bit ADC |
| **Batt Div** | 3S LiPo Pack Voltage | $100\text{k}\Omega / 33\text{k}\Omega$ Divider | $10.0 - 13.0\text{V}$ | Analog 12-bit ADC |

---

## 2. Indicative Vocational Calibration Transfer Functions

> [!IMPORTANT]
> Raw analog ADC counts from unheated or uncompensated MOX sensors cannot be treated as life-safety compliance ppm without laboratory gas calibration chambers. In SkillDrone, readings are clearly designated as **Vocational Diagnostic Indicators**.

### 2.1 MQ-4 (Methane)
- ESP32 ADC: 12-bit ($0 \text{ to } 4095$ counts, attenuation 11dB for $0 - 3.3\text{V}$).
- Baseline Ambient: $210 \pm 15$ ADC counts in clean workshop air.
- Linear indicative estimate:
  $$\text{ppm}_{est} = \max(0.0, (\text{ADC} - 200.0) \times 1.8)$$

### 2.2 MQ-7 (Carbon Monoxide)
- Baseline Ambient: $190 \pm 12$ ADC counts in clean workshop air.
- Indicative estimate:
  $$\text{ppm}_{est} = \max(0.0, (\text{ADC} - 180.0) \times 0.9)$$

### 2.3 MLX90614 (Object Temperature)
- I2C register $0\times 07$ returns raw 16-bit word at $0.02\text{ Kelvin/LSB}$:
  $$T_{\text{Celsius}} = (\text{RawWord} \times 0.02) - 273.15$$

### 2.4 Battery Voltage Divider
- Divider Ratio: $R_1 = 100\text{k}\Omega$, $R_2 = 33\text{k}\Omega \implies \text{Multiplier} = \frac{100 + 33}{33} = 4.03$.
- Pack Voltage in mV:
  $$V_{pack} = \frac{\text{ADC}}{4095} \times 3300\text{ mV} \times 4.03$$

---

## 3. Real-Time Electrical Health Heuristics

The `HazardDetectionEngine.evaluate_sensor_health()` module validates every reading before running diagnostic threshold rules:

```
                          [ Raw ADC Input ]
                                  |
                +-----------------+-----------------+
                |                                   |
           ADC <= 5.0                          ADC >= 4090.0
                |                                   |
         [ DISCONNECTED ]                      [ DEGRADED ]
      (GND Rail Short / Open)             (VCC Rail Short / Saturated)
                |                                   |
                +-----------------+-----------------+
                                  |
                           5.0 < ADC < 4090.0
                                  |
                    |raw - prev| > max_physical_slew?
                         /                 \
                      YES                   NO
                       |                     |
                   [ NOISY ]            [ NOMINAL ]
                (Spike Filtered)     (Healthy Sample)
```

1. **Disconnected Check**: An input reading $\le 5$ ADC counts indicates a disconnected sensor pin or floating pull-down.
2. **Degraded / Saturation Check**: A reading $\ge 4090$ ADC counts indicates an ADC railed to $3.3\text{V}$, power short, or extreme chemical saturation.
3. **Noisy Slew-Rate Limiter**: Plausible physical delta is capped at $350\text{ counts/second}$ for gas and $40^\circ\text{C}/\text{second}$ for thermometry. Sudden single-sample impulses are flagged as `noisy`.
4. **Sensor Warm-Up State**: During the initial 10 seconds post-boot, the MOX internal heater element stabilizes. Readings during warm-up show an exponential settling transient ($+35\text{ ADC}$ decaying to 0).
