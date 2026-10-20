"use client";

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function HardwareGuidePage() {
  const [activeTab, setActiveTab] = useState<"protocol" | "wiring" | "bom" | "firmware">("protocol");

  const sampleJsonPayload = `{
  "proto": "SKILLDRONE_ESP32_V1",
  "seq": 1042,
  "drone_id": "DRONE-ALPHA-01",
  "battery_mv": 12150,
  "pos": { "x": 6.5, "y": 3.0, "z": 1.8 },
  "heading_deg": 90.0,
  "speed_mps": 0.75,
  "sensors": [
    {
      "type": "mq4_gas",
      "raw_adc": 580,
      "health": "nominal"
    },
    {
      "type": "thermal_ir",
      "raw_c": 34.2,
      "health": "nominal"
    },
    {
      "type": "uv_flame",
      "raw_adc": 18,
      "health": "nominal"
    }
  ]
}`;

  const firmwareCodeSnippet = `// SkillDrone ESP32 Sensor Telemetry Payload Firmware
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WORKSHOP_WIFI";
const char* password = "SECURITY_KEY";
const char* serverUrl = "http://192.168.1.100:8000/api/hardware/telemetry";

const int PIN_MQ4 = 34;       // Analog ADC1 CH6
const int PIN_MQ7 = 35;       // Analog ADC1 CH7
const int PIN_BATTERY = 36;   // Voltage Divider (100k/33k)

unsigned long seqNumber = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // 12-bit ADC (0 to 4095)
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected. SkillDrone Payload Ready.");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["proto"] = "SKILLDRONE_ESP32_V1";
    doc["seq"] = ++seqNumber;
    doc["session_id"] = "ACTIVE_SESSION_ID";
    doc["battery_mv"] = analogRead(PIN_BATTERY) * (3300.0 / 4095.0) * 4.0;

    JsonArray sensors = doc.createNestedArray("sensors");
    
    // MQ-4 Methane
    JsonObject s1 = sensors.createNestedObject();
    s1["type"] = "mq4_gas";
    s1["raw_adc"] = analogRead(PIN_MQ4);
    s1["health"] = (s1["raw_adc"] < 10 || s1["raw_adc"] > 4080) ? "degraded" : "nominal";

    // Non-contact Thermal IR (e.g. MLX90614 I2C reading)
    JsonObject s2 = sensors.createNestedObject();
    s2["type"] = "thermal_ir";
    s2["raw_c"] = 28.5; // read from I2C
    s2["health"] = "nominal";

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    http.end();
  }
  delay(500); // 2.0 Hz Transmission rate
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-industrial-900 border border-industrial-800">
        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-tech-cyan/20 text-tech-cyan border border-tech-cyan/30">
          HARDWARE ABSTRACTION LAYER (HAL)
        </span>
        <h1 className="text-xl font-bold text-slate-100 mt-1">ESP32 & Drone Integration Guide</h1>
        <p className="text-xs text-slate-400">
          Documented interfaces, firmware sketches, pinout schematics, and Bill of Materials for physical prototype deployment.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-xl bg-tech-amber/10 border border-tech-amber/30 text-xs font-mono text-tech-amber flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold uppercase tracking-wider">Flight Controller Safety Independence</h4>
          <p className="mt-1 leading-relaxed text-slate-300">
            Keep flight stabilization, IMU attitude control, and failsafes strictly on the flight controller
            (e.g., PX4 / ArduPilot / Betaflight). The ESP32 acts solely as an auxiliary diagnostic payload node and
            MUST NEVER intercept flight-critical motor signals.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-industrial-800 gap-2">
        {[
          { id: "protocol", label: "Telemetry Protocol (JSON)" },
          { id: "wiring", label: "ESP32 Pinout & Wiring" },
          { id: "bom", label: "Bill of Materials (BOM)" },
          { id: "firmware", label: "Arduino C++ Firmware" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-mono uppercase transition border-b-2 ${
              activeTab === tab.id
                ? "border-tech-cyan text-tech-cyan font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Protocol */}
      {activeTab === "protocol" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 text-xs font-mono">
            <h3 className="text-sm font-bold text-slate-100 uppercase mb-2">
              Standard Telemetry Ingestion Payload Specification
            </h3>
            <p className="text-slate-400 text-[11px] mb-3">
              POST JSON frames to <code className="text-tech-cyan bg-industrial-950 px-1 py-0.5 rounded">/api/hardware/telemetry</code> or stream directly over WebSocket at 2.0 Hz.
            </p>

            <pre className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 text-tech-cyan text-xs overflow-x-auto leading-relaxed">
              {sampleJsonPayload}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Wiring */}
      {activeTab === "wiring" && (
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4 text-xs font-mono">
          <h3 className="text-sm font-bold text-slate-100 uppercase mb-2">
            ESP32 Pinout Configuration & Power Distribution
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 space-y-2">
              <span className="font-bold text-tech-cyan block uppercase">Sensor Connections</span>
              <ul className="space-y-1.5 text-slate-300 text-[11px]">
                <li>• <strong className="text-slate-100">GPIO 34 (ADC1 CH6):</strong> MQ-4 Methane Sensor Analog Out (AOUT)</li>
                <li>• <strong className="text-slate-100">GPIO 35 (ADC1 CH7):</strong> MQ-7 Carbon Monoxide Analog Out (AOUT)</li>
                <li>• <strong className="text-slate-100">GPIO 21 (SDA) & GPIO 22 (SCL):</strong> MLX90614 Non-contact Thermal IR</li>
                <li>• <strong className="text-slate-100">GPIO 36 (ADC1 CH0):</strong> Voltage Divider for 3S LiPo Telemetry</li>
                <li>• <strong className="text-slate-100">GPIO 16 (RX2) & GPIO 17 (TX2):</strong> Flight Controller TELEM2 MAVLink bridge</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 space-y-2">
              <span className="font-bold text-tech-amber block uppercase">Power Conditioning Rules</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                MQ-series sensors incorporate internal 5V heaters requiring up to 150-180 mA each.
                Power heaters via a dedicated 5V 3A UBEC step-down regulator connected to the drone battery.
                Do not power MQ sensor heaters directly from the ESP32 3.3V LDO regulator to prevent thermal shutdown.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: BOM */}
      {activeTab === "bom" && (
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4 text-xs font-mono">
          <h3 className="text-sm font-bold text-slate-100 uppercase mb-2">
            Hardware Prototype Bill of Materials (BOM)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] text-slate-400 uppercase border-b border-industrial-800 bg-industrial-950">
                <tr>
                  <th className="p-2.5">Component</th>
                  <th className="p-2.5">Part / Model</th>
                  <th className="p-2.5">Function</th>
                  <th className="p-2.5">Interface</th>
                  <th className="p-2.5">Est. Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-800">
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">Microcontroller</td>
                  <td className="p-2.5 text-slate-300">ESP32-WROOM-32D</td>
                  <td className="p-2.5 text-slate-400">Sensor acquisition & WiFi/Serial bridge</td>
                  <td className="p-2.5 text-slate-300">ADC / I2C / UART</td>
                  <td className="p-2.5 text-tech-cyan">$5.50</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">Combustible Gas Sensor</td>
                  <td className="p-2.5 text-slate-300">MQ-4 Module</td>
                  <td className="p-2.5 text-slate-400">Methane & natural gas qualitative detection</td>
                  <td className="p-2.5 text-slate-300">Analog Voltage</td>
                  <td className="p-2.5 text-tech-cyan">$3.20</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">Carbon Monoxide Sensor</td>
                  <td className="p-2.5 text-slate-300">MQ-7 Module</td>
                  <td className="p-2.5 text-slate-400">CO detection in welding exhaust corridors</td>
                  <td className="p-2.5 text-slate-300">Analog Voltage</td>
                  <td className="p-2.5 text-tech-cyan">$3.50</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">Non-contact Infrared Sensor</td>
                  <td className="p-2.5 text-slate-300">MLX90614-DCI</td>
                  <td className="p-2.5 text-slate-400">Localized equipment thermal hotspot detection</td>
                  <td className="p-2.5 text-slate-300">I2C (SMBus)</td>
                  <td className="p-2.5 text-tech-cyan">$14.00</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">UV Flame Sensor</td>
                  <td className="p-2.5 text-slate-300">UVM-30A / R2868</td>
                  <td className="p-2.5 text-slate-400">Arc flash and UV radiation detection</td>
                  <td className="p-2.5 text-slate-300">Analog ADC</td>
                  <td className="p-2.5 text-tech-cyan">$6.80</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-100">Auxiliary BEC Regulator</td>
                  <td className="p-2.5 text-slate-300">5V 3A UBEC</td>
                  <td className="p-2.5 text-slate-400">Isolated 5V power for MQ heaters</td>
                  <td className="p-2.5 text-slate-300">DC Step-down</td>
                  <td className="p-2.5 text-tech-cyan">$4.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Firmware */}
      {activeTab === "firmware" && (
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4 text-xs font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 uppercase">
              ESP32 Arduino C++ Firmware Sketch
            </h3>
            <span className="text-[10px] text-tech-cyan px-2 py-0.5 rounded bg-industrial-950 border border-industrial-800">
              skilldrone_esp32_payload.ino
            </span>
          </div>

          <pre className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-200 text-xs overflow-x-auto leading-relaxed">
            {firmwareCodeSnippet}
          </pre>
        </div>
      )}
    </div>
  );
}
