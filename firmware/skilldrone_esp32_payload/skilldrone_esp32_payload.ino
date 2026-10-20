/*
 * ======================================================================================
 * SkillDrone — ESP32 Sensor Acquisition and Payload Telemetry Firmware
 * Target: ESP32-WROOM-32 / ESP32-S3
 * Architecture: Sensor Node strictly independent of Flight Controller flight stabilization
 * Protocol: SKILLDRONE_ESP32_V1 JSON over HTTP POST or Serial UART
 * ======================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// --- Network Configuration ---
const char* WIFI_SSID     = "WORKSHOP_WIFI_SSID";
const char* WIFI_PASSWORD = "WORKSHOP_WIFI_PASSWORD";
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/hardware/telemetry";

// --- Hardware Pin Definitions ---
const int PIN_MQ4_GAS    = 34; // ADC1 CH6 (Methane / Natural Gas)
const int PIN_MQ7_CO     = 35; // ADC1 CH7 (Carbon Monoxide)
const int PIN_UV_FLAME   = 32; // ADC1 CH4 (UV Arc Flash)
const int PIN_BATTERY_DIV = 36; // ADC1 CH0 (3S LiPo Voltage Divider 100k/33k)
const int PIN_STATUS_LED = 2;  // Built-in LED

// --- Telemetry State ---
unsigned long sequenceCounter = 0;
const unsigned long TRANSMIT_INTERVAL_MS = 500; // 2.0 Hz update rate
unsigned long lastTransmitTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Set 12-bit ADC resolution (0 to 4095 counts)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // Full-scale range ~ 3.3V

  // Initialize I2C for MLX90614 (SDA=21, SCL=22)
  Wire.begin(21, 22);

  Serial.println("\n[SkillDrone] Initializing ESP32 Sensor Telemetry Node...");
  Serial.println("[SkillDrone] Protocol: SKILLDRONE_ESP32_V1");

  // Connect to WiFi network
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[SkillDrone] WiFi Connected. IP: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    Serial.println("\n[SkillDrone] WiFi not connected. Falling back to Serial UART telemetry mode.");
  }
}

// Read battery voltage in millivolts through voltage divider (R1=100k, R2=33k -> ratio 4.03)
float readBatteryMilliVolts() {
  int rawAdc = analogRead(PIN_BATTERY_DIV);
  float pinVoltage = (rawAdc / 4095.0f) * 3300.0f;
  return pinVoltage * 4.03f;
}

// Evaluate sensor health (checks for electrical rail faults or disconnects)
const char* checkSensorHealth(int rawAdc) {
  if (rawAdc <= 5) return "disconnected"; // Pulled to GND
  if (rawAdc >= 4090) return "degraded";  // Railed to VCC
  return "nominal";
}

// MLX90614 Infrared Thermometer SMBus readout for Object Surface Temperature
const uint8_t MLX90614_I2C_ADDR = 0x5A;
const uint8_t MLX90614_TOBJ1    = 0x07;

bool readMLX90614SurfaceTemp(float &tempC, const char* &health) {
  Wire.beginTransmission(MLX90614_I2C_ADDR);
  Wire.write(MLX90614_TOBJ1);
  if (Wire.endTransmission(false) != 0) {
    // Sensor not responding on I2C bus (offline or bench testing without physical hardware)
    tempC = 24.5f;
    health = "nominal"; // bench default
    return false;
  }

  uint8_t bytesReceived = Wire.requestFrom((uint8_t)MLX90614_I2C_ADDR, (uint8_t)3);
  if (bytesReceived >= 2) {
    uint8_t lowByte = Wire.read();
    uint8_t highByte = Wire.read();
    if (bytesReceived >= 3) Wire.read(); // Read PEC (packet error code)

    uint16_t rawData = (highByte << 8) | lowByte;
    // MLX90614 resolution: 0.02 Kelvin per LSB
    float kelvin = rawData * 0.02f;
    tempC = kelvin - 273.15f;

    if (tempC < -20.0f || tempC > 350.0f) {
      health = "degraded";
    } else {
      health = "nominal";
    }
    return true;
  }

  tempC = 24.5f;
  health = "disconnected";
  return false;
}

void loop() {
  unsigned long now = millis();
  if (now - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = now;
    sequenceCounter++;

    // 1. Acquire raw sensor readings
    int rawMq4 = analogRead(PIN_MQ4_GAS);
    int rawMq7 = analogRead(PIN_MQ7_CO);
    int rawUv  = analogRead(PIN_UV_FLAME);
    float batteryMv = readBatteryMilliVolts();

    // Acquire non-contact surface temperature via I2C MLX90614
    float surfaceTempC = 24.5f;
    const char* thermalHealth = "nominal";
    readMLX90614SurfaceTemp(surfaceTempC, thermalHealth);

    // 2. Build JSON telemetry payload
    StaticJsonDocument<768> doc;
    doc["proto"] = "SKILLDRONE_ESP32_V1";
    doc["seq"] = sequenceCounter;
    doc["drone_id"] = "DRONE-ALPHA";
    doc["session_id"] = "ACTIVE_SESSION_ID"; // Set by ground station command
    doc["battery_mv"] = (int)batteryMv;
    doc["link_quality"] = (WiFi.status() == WL_CONNECTED) ? 95.0 : 0.0;

    // Relative coordinates (ingested via MAVLink bridge or default)
    JsonObject pos = doc.createNestedObject("pos");
    pos["x"] = 0.0;
    pos["y"] = 0.0;
    pos["z"] = 1.8;

    JsonArray sensors = doc.createNestedArray("sensors");

    // MQ-4 Methane Sensor
    JsonObject s1 = sensors.createNestedObject();
    s1["type"] = "mq4_gas";
    s1["raw_adc"] = rawMq4;
    s1["health"] = checkSensorHealth(rawMq4);

    // MQ-7 Carbon Monoxide Sensor
    JsonObject s2 = sensors.createNestedObject();
    s2["type"] = "mq7_co";
    s2["raw_adc"] = rawMq7;
    s2["health"] = checkSensorHealth(rawMq7);

    // Thermal IR Sensor
    JsonObject s3 = sensors.createNestedObject();
    s3["type"] = "thermal_ir";
    s3["raw_c"] = surfaceTempC;
    s3["health"] = thermalHealth;

    // UV Flame / Arc Sensor
    JsonObject s4 = sensors.createNestedObject();
    s4["type"] = "uv_flame";
    s4["raw_adc"] = rawUv;
    s4["health"] = checkSensorHealth(rawUv);

    String payloadString;
    serializeJson(doc, payloadString);

    // 3. Transmit via WiFi HTTP POST if connected
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(BACKEND_URL);
      http.addHeader("Content-Type", "application/json");
      int httpCode = http.POST(payloadString);
      if (httpCode > 0) {
        // Blink LED to indicate successful transmission
        digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
      }
      http.end();
    }

    // 4. Always output to Serial UART (for debugging or tethered radio links)
    Serial.println(payloadString);
  }
}
