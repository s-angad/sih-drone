# SkillDrone V2 — Physics & Sensor Simulation Models

This document details the mathematical and physical formulations implemented in the SkillDrone simulation engine (`backend/app/services/simulation_engine.py`).

---

## 1. Atmospheric Gas Dispersion Model

### 1.1 Coordinate System & Wind Reference Frame
Let the workshop floor be the horizontal plane $(x, y) \in [0, W] \times [0, L]$, with vertical elevation $z \ge 0$.
The wind vector $\vec{w}$ is defined by wind speed $u_{wind} \ge 0$ (m/s) and wind direction $\theta_w$ (degrees from $+x$ East toward $+y$ South):
$$w_x = u_{wind} \cos(\theta_w), \quad w_y = u_{wind} \sin(\theta_w)$$

For a gas release source at $\vec{r}_0 = (x_0, y_0, z_0)$, any observation point $\vec{r} = (x, y, z)$ is transformed into along-wind ($x_w$) and cross-wind ($y_w$) components:
$$x_w = (x - x_0)\cos(\theta_w) + (y - y_0)\sin(\theta_w)$$
$$y_w = -(x - x_0)\sin(\theta_w) + (y - y_0)\cos(\theta_w)$$
$$z_w = |z - z_0|$$

### 1.2 Downwind Advective Gaussian Dispersion
When wind velocity $u_{wind} > 0.05\text{ m/s}$, advection dominates. The plume width expands downwind according to atmospheric dispersion coefficients:
$$\sigma_y(x_w) = \sigma_{y0} + k_y \max(0, x_w)$$
$$\sigma_z(x_w) = \sigma_{z0} + k_z \max(0, x_w)$$
where $\sigma_{y0} = 0.4 \cdot r_{source}$, $\sigma_{z0} = 0.3 \cdot r_{source}$, $k_y = 0.15$, $k_z = 0.10$.

For $x_w \ge -0.4\text{ m}$ (downwind cone):
$$C_{plume}(x_w, y_w, z) = Q_{peak} \cdot \frac{1}{1 + 0.45 x_w} \cdot \exp\left(-\frac{y_w^2}{2\sigma_y^2}\right) \cdot \exp\left(-\frac{(z - z_0)^2}{2\sigma_z^2}\right)$$

For $x_w < -0.4\text{ m}$ (upwind back-diffusion):
$$C_{plume} = Q_{peak} \cdot \exp(2.5 x_w) \cdot \exp\left(-\frac{y_w^2}{2\sigma_{y0}^2}\right)$$

### 1.3 Calm Air Isotropic Diffusion Fallback
In stagnant indoor workshop air ($u_{wind} \to 0$):
$$C_{iso}(r, z) = Q_{peak} \cdot \exp\left(-\frac{r_{xy}^2}{2\sigma_{iso}^2}\right) \cdot \exp\left(-\frac{|z - z_0|}{1.5}\right)$$
The final concentration blends advective plume and isotropic diffusion smoothly:
$$\alpha = \min\left(1.0, \frac{u_{wind}}{0.8}\right)$$
$$C_{ambient} = \alpha C_{plume} + (1 - \alpha) C_{iso}$$

### 1.4 Dynamic Sensor Response Lag (First-Order Filter)
Metal Oxide Semiconductor (MOX) gas sensors (MQ-4, MQ-7) exhibit chemical desorption and heating lag. They cannot track instantaneous concentration steps. SkillDrone models this using an RC low-pass filter:
$$y_t = y_{t-1} + \frac{\Delta t}{\tau} (u_t - y_{t-1})$$
where $\tau = 3.0\text{ s}$ for MOX sensors, $\Delta t = 0.5\text{ s}$.

---

## 2. Non-Contact Infrared Thermometry Model (MLX90614)

### 2.1 Conical Field of View (FOV) Projection
The MLX90614 thermopile has a conical FOV of $2\theta = 35^\circ$ ($\theta = 17.5^\circ$).
For a drone at height $h = |z_{drone} - z_{target}|$ above the inspected surface, the ground spot footprint diameter is:
$$D_{spot} = 2 \cdot h \cdot \tan(17.5^\circ)$$
$$A_{spot} = \pi \left(\frac{D_{spot}}{2}\right)^2$$

### 2.2 Spot-Size Dilution & Area Fill Factor
For a localized hotspot of area $A_{target} = \pi r_{target}^2$ ($r_{target} \approx 0.30\text{ m}$), the fraction of the optical sensor FOV covered by the hotspot is:
$$\eta = \min\left(1.0, \frac{A_{target}}{A_{spot}}\right)$$

The measured surface temperature integrates ambient and target temperatures:
$$T_{meas} = T_{amb} + \Delta T_{max} \cdot \eta \cdot \exp\left(-\frac{d_{xy}^2}{2(r_{spot} + r_{target})^2}\right)$$
At low altitudes ($h = 0.8\text{ m}$), $\eta \approx 1.0$ and peak temperature is registered. At higher altitudes ($h = 3.0\text{ m}$), $A_{spot}$ expands, diluting the measured temperature as observed on real thermopiles.

Thermopile response lag is modeled with $\tau = 0.6\text{ s}$.

---

## 3. Optical Ultraviolet Radiation (UV Flame / Arc Sensor)

### 3.1 Inverse-Square Radiation
UV optical radiation from welding arcs or electrical flashovers attenuates according to the inverse-square law:
$$I_{uv} = \frac{I_0}{1 + 2.8 \cdot d_{3D}^2}$$
where $d_{3D} = \sqrt{(x - x_0)^2 + (y - y_0)^2 + (z - z_0)^2}$.

UV photodiode response lag is fast ($\tau = 0.15\text{ s}$).

---

## 4. Non-Linear 3S LiPo Battery Model

### 4.1 Open Circuit Voltage (OCV) Discharge Curve
For a 3-cell Lithium Polymer battery ($11.1\text{V}$ nominal, $12.6\text{V}$ fully charged, $10.5\text{V}$ cutoff), State of Charge ($SoC \in [0.0, 1.0]$) relates non-linearly to cell OCV:
$$V_{cell}(SoC) = \begin{cases} 
3.90 + \frac{SoC - 0.8}{0.2}(4.20 - 3.90) & SoC > 0.8 \\
3.70 + \frac{SoC - 0.2}{0.6}(3.90 - 3.70) & 0.2 \le SoC \le 0.8 \\
3.20 + \frac{SoC}{0.2}(3.70 - 3.20) & SoC < 0.2 
\end{cases}$$
$$V_{OCV} = 3 \cdot V_{cell}(SoC)$$

### 4.2 Dynamic Current Draw & Throttle Sag
Total electrical load current accounts for avionics baseline and motor thrust:
$$I_{load} = I_{base} + I_{hover} \cdot \left[1 + 0.65 \left(\frac{v}{v_{max}}\right)^2\right]$$
where $I_{base} = 1.2\text{ A}$, $I_{hover} = 9.5\text{ A}$, $v_{max} = 1.2\text{ m/s}$.

Internal cell resistance causes voltage sag under throttle:
$$V_{terminal} = V_{OCV} - I_{load} \cdot R_{int}$$
where $R_{int} = 0.045\,\Omega$.

Energy depletion integrates over time:
$$\Delta SoC = \frac{I_{load} \cdot \Delta t}{C_{batt} \cdot 3600\text{ s}}$$
where $C_{batt} = 2.2\text{ Ah}$ (2200 mAh).
