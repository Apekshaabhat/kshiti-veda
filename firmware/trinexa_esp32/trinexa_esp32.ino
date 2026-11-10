// ============================================================================
// TRINEXA – Physical ESP32 Hardware Integration Firmware
// Target: ESP32 Dev Module / ESP-WROOM-32 (CP2102 USB Bridge)
//
// Sensor Pin Assignments:
//   - GPIO 34 : Capacitive Soil Moisture Sensor (Analog ADC1_CH6)
//   - GPIO  4 : DHT22 Temperature & Humidity Sensor (Digital)
//   - GPIO  5 : DS18B20 Soil Temp (OneWire) [Strapping pin MTDO; fallback: GPIO 18]
//   - GPIO 16 : Soil pH Sensor UART RX (ESP32 HardwareSerial 2 RX2)
//   - GPIO 17 : Soil pH Sensor UART TX (ESP32 HardwareSerial 2 TX2)
//   - GPIO 21 : BH1750 Ambient Light Sensor SDA (I2C)
//   - GPIO 22 : BH1750 Ambient Light Sensor SCL (I2C)
// ============================================================================

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <BH1750.h>
#include <math.h>

// ============================================================================
// CONFIGURATION & DEFAULTS
// ============================================================================
#if __has_include("config.h")
  #include "config.h"
#else
  #define WIFI_SSID               "bhat's"
  #define WIFI_PASSWORD           "aaayu72985"
  #define BACKEND_HOST            "10.81.139.53"
  #define BACKEND_PORT            3001
  #define DEVICE_ID               "ESP32-01"
  #define TELEMETRY_INTERVAL_MS   5000
  #define SOIL_ADC_DRY            2557
  #define SOIL_ADC_WET            750
  #define MOISTURE_SAMPLE_COUNT   10
  #define PH_TIMEOUT_MS           5000
  #define PH_CALIBRATION_SLOPE    1.000
  #define PH_CALIBRATION_OFFSET   0.000
#endif

#ifndef TELEMETRY_INTERVAL_MS
  #define TELEMETRY_INTERVAL_MS 5000
#endif

#ifndef MOISTURE_SAMPLE_COUNT
  #define MOISTURE_SAMPLE_COUNT 10
#endif

#ifndef PH_TIMEOUT_MS
  #define PH_TIMEOUT_MS 5000
#endif

#ifndef PH_CALIBRATION_SLOPE
  #define PH_CALIBRATION_SLOPE 1.000
#endif

#ifndef PH_CALIBRATION_OFFSET
  #define PH_CALIBRATION_OFFSET 0.000
#endif

#ifndef SOIL_ADC_DRY
  #define SOIL_ADC_DRY 2557
#endif

#ifndef SOIL_ADC_WET
  #define SOIL_ADC_WET 750
#endif

// ============================================================================
// PIN DEFINITIONS
// ============================================================================
#define SOIL_PIN          34
#define DHT_PIN           4
#define DHT_TYPE          DHT22

#define DS18B20_PIN       5      // Note: GPIO 5 is strapping pin MTDO. If boot hangs, use GPIO 18.
#define DS18B20_PIN_ALT   18     // Documented safe alternative pin

#define PH_RX_PIN         16     // 4-in-1 pH Sensor UART RX (ESP32 RX2)
#define PH_TX_PIN         17     // 4-in-1 pH Sensor UART TX (ESP32 TX2)
#define PH_BAUD_RATE      9600 // Verified working baud rate from the received PH/L/T/W packets
#define PH_PACKET_IDLE_MS 150
#define PH_BUFFER_MAX     256

// ============================================================================
// SENSOR INSTANCES
// ============================================================================
DHT dht(DHT_PIN, DHT_TYPE);
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
HardwareSerial PHSerial(2);
WebServer server(80);

// ============================================================================
// SENSOR DATA STRUCTURE
// ============================================================================
struct SensorData {
  bool soilValid = false;
  int soilRaw = 0;
  float soilPercent = 0.0;

  bool dhtValid = false;
  float airTemp = 0.0;
  float airHumidity = 0.0;

  bool dsValid = false;
  float soilTemp = 0.0;

  bool phValid = false;
  bool phAir = false;
  float phValue = 0.0;

  bool lightValid = false;
  float lightLux = 0.0;
};

SensorData currentReadings;

// ============================================================================
// GLOBAL STATE & DIAGNOSTICS
// ============================================================================
String phRawBuffer = "";
String lastPHRawPacket = "";
unsigned long lastPHByteTime = 0;
unsigned long lastWiFiAttempt = 0;
unsigned long lastSensorReadTime = 0;
unsigned long lastTelemetryPushTime = 0;
unsigned long lastPHPacketTime = 0;

const unsigned long WIFI_RETRY_INTERVAL = 10000;

float lastValidPH = -1.0;

// Separate auxiliary diagnostic values from the 4-in-1 module
float phModuleAuxLight = -1.0;
bool phLightFieldSeen = false;
bool parsedPHAir = false;
float phModuleAuxTemp = -1.0;
float phModuleAuxWater = -1.0;

// Soil moisture moving average buffer
int moistureSamples[MOISTURE_SAMPLE_COUNT] = {0};
int moistureSampleIdx = 0;
bool moistureBufferFilled = false;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
String formatJsonVal(bool valid, float value, int precision = 1) {
  if (!valid || !isfinite(value)) {
    return "null";
  }
  return String(value, precision);
}

bool isNumericFloat(const String& str) {
  if (str.length() == 0) return false;
  int dotCount = 0;
  int startIdx = (str.charAt(0) == '-' || str.charAt(0) == '+') ? 1 : 0;
  if (startIdx >= str.length()) return false;

  for (int i = startIdx; i < str.length(); i++) {
    char c = str.charAt(i);
    if (c == '.') {
      dotCount++;
      if (dotCount > 1) return false;
    } else if (c < '0' || c > '9') {
      return false;
    }
  }
  return true;
}

// ============================================================================
// SCIENTIFIC pH CLASSIFICATION
// Standard thresholds:
//   0.0 - 3.0       : Strongly acidic
//   Above 3.0 - 6.5 : Acidic
//   Exactly 7.00    : Neutral
//   Above 6.5 - 7.5 : Near neutral
//   Above 7.5 - 10.0: Alkaline
//   Above 10.0 - 14 : Strongly alkaline
// ============================================================================
const char* getPHClassification(float ph) {
  if (!isfinite(ph) || ph < 0.0 || ph > 14.0) {
    return "INVALID";
  }
  if (ph <= 3.0) {
    return "STRONGLY ACIDIC";
  }
  if (ph <= 6.5) {
    return "ACIDIC";
  }
  if (fabs(ph - 7.00) < 0.05) {
    return "NEUTRAL";
  }
  if (ph <= 7.5) {
    return "NEAR NEUTRAL";
  }
  if (ph <= 10.0) {
    return "ALKALINE";
  }
  return "STRONGLY ALKALINE";
}

// ============================================================================
// pH UART PACKET PARSER
// Supports:
//   1. Labelled format:   "pH:7.20,L:45,T:26.5,W:1" or "PH:6.80"
//   2. Comma-separated:   "7.20,45,26.5,1"
//   3. Single value:      "7.20"
// Extracts pre-calculated UART float without analog conversion formulas.
// ============================================================================
bool extractPHValue(String packet, float &ph) {
  packet.trim();
  if (packet.length() == 0) return false;

  String upperPacket = packet;
  upperPacket.toUpperCase();
  String phToken = "";

  // Each packet must provide its own light field; never reuse stale data.
  phLightFieldSeen = false;
  parsedPHAir = false;
  phModuleAuxLight = -1.0;

  int phIndex = upperPacket.indexOf("PH:");
  if (phIndex >= 0) {
    int start = phIndex + 3;
    int end = packet.indexOf(',', start);
    if (end < 0) end = packet.length();
    phToken = packet.substring(start, end);

    int lIndex = upperPacket.indexOf("L:");
    if (lIndex >= 0) {
      int lEnd = packet.indexOf(',', lIndex + 2);
      if (lEnd < 0) lEnd = packet.length();
      String lTok = packet.substring(lIndex + 2, lEnd);
      lTok.trim();
      if (isNumericFloat(lTok)) {
        float lightValue = lTok.toFloat();
        if (isfinite(lightValue) && lightValue >= 0.0 && lightValue <= 65535.0) {
          phModuleAuxLight = lightValue;
          phLightFieldSeen = true;
        }
      }
    }

    int tIndex = upperPacket.indexOf("T:");
    if (tIndex >= 0) {
      int tEnd = packet.indexOf(',', tIndex + 2);
      if (tEnd < 0) tEnd = packet.length();
      String tTok = packet.substring(tIndex + 2, tEnd);
      tTok.trim();
      if (isNumericFloat(tTok)) phModuleAuxTemp = tTok.toFloat();
    }

    int wIndex = upperPacket.indexOf("W:");
    if (wIndex >= 0) {
      int wEnd = packet.indexOf(',', wIndex + 2);
      if (wEnd < 0) wEnd = packet.length();
      String wTok = packet.substring(wIndex + 2, wEnd);
      wTok.trim();
      if (isNumericFloat(wTok)) phModuleAuxWater = wTok.toFloat();
    }
  } else {
    int comma = packet.indexOf(',');
    phToken = (comma >= 0) ? packet.substring(0, comma) : packet;
  }

  phToken.trim();
  if (!isNumericFloat(phToken)) return false;

  float rawValue = phToken.toFloat();
  if (!isfinite(rawValue) || rawValue < 0.0) return false;

  // The module reports >14 when its probe is exposed to air.
  // Treat that as a state, not as a valid soil pH measurement.
  if (rawValue > 14.0) {
    parsedPHAir = true;
    return true;
  }

  float calibratedValue = (rawValue * (float)PH_CALIBRATION_SLOPE) + (float)PH_CALIBRATION_OFFSET;
  if (!isfinite(calibratedValue) || calibratedValue < 0.0 || calibratedValue > 14.0) return false;
  ph = calibratedValue;
  return true;
}

// ============================================================================
// PROCESS pH PACKET & PRINT SERIAL MONITOR DIAGNOSTICS
// ============================================================================
void processPHPacket() {
  phRawBuffer.trim();
  if (phRawBuffer.length() == 0) return;

  lastPHRawPacket = phRawBuffer;
  float parsedPH = NAN;
  bool packetValid = extractPHValue(phRawBuffer, parsedPH);

  // Light is sourced from the pH module's L: field.
  currentReadings.lightValid = phLightFieldSeen;
  if (phLightFieldSeen) currentReadings.lightLux = phModuleAuxLight; // Raw module scale; not verified lux.

  if (packetValid && parsedPHAir) {
    currentReadings.phValid = false;
    currentReadings.phAir = true;
    lastPHPacketTime = millis();
    Serial.printf("[PH] Probe state: AIR (raw PH field: %s)\n", lastPHRawPacket.c_str());
    if (phLightFieldSeen) Serial.printf("[LIGHT] Module raw intensity: %.1f\n", currentReadings.lightLux);
  } else if (packetValid) {
    currentReadings.phValue = parsedPH;
    currentReadings.phValid = true;
    currentReadings.phAir = false;
    lastValidPH = parsedPH;
    lastPHPacketTime = millis();
    Serial.printf("[PH] Reading: %.2f | Classification: %s\n", parsedPH, getPHClassification(parsedPH));
    if (phLightFieldSeen) Serial.printf("[LIGHT] Module raw intensity: %.1f\n", currentReadings.lightLux);
  } else {
    Serial.printf("[PH ERROR] Invalid packet: %s\n", lastPHRawPacket.c_str());
  }

  phRawBuffer = "";
}

// ============================================================================
// READ pH UART STREAM (ESP32 HardwareSerial 2 on GPIO 16/17)
// ============================================================================
// ============================================================================
// READ pH UART STREAM
// Supports CR/LF terminated packets and packets without line terminators.
// Uses a short idle gap to detect the end of a packet.
// ============================================================================

void readPHUART() {

  while (PHSerial.available() > 0) {

    char c = (char)PHSerial.read();
    
    lastPHByteTime = millis();

    // Process packet on normal line terminator
    if (c == '\n' || c == '\r') {

      if (phRawBuffer.length() > 0) {
        processPHPacket();
      }

      continue;
    }

    // Ignore null bytes and non-printable control characters
    if (c == '\0') {
      continue;
    }

    // Accept printable ASCII characters
    if (c >= 32 && c <= 126) {

      if (phRawBuffer.length() < PH_BUFFER_MAX) {
        phRawBuffer += c;
      } else {

        Serial.println("[PH ERROR] Packet exceeded maximum buffer size.");

        phRawBuffer = "";
      }
    }
  }

  // If the module does not send a newline, process after an idle gap.
  if (phRawBuffer.length() > 0 &&
      lastPHByteTime > 0 &&
      millis() - lastPHByteTime >= PH_PACKET_IDLE_MS) {

    Serial.println("[PH INFO] Packet completed using UART idle detection.");

    processPHPacket();
  }
}

// ============================================================================
// READ ALL PHYSICAL SENSORS
// ============================================================================
void readAllSensors() {
  // 1. pH SENSOR TIMEOUT CHECK
  if (lastPHPacketTime == 0 || millis() - lastPHPacketTime > PH_TIMEOUT_MS) {
    if (currentReadings.phValid) {
      Serial.println("[PH WARN] pH sensor UART timeout (>5000ms). Marking unavailable.");
    }
    currentReadings.phValid = false;
    currentReadings.phAir = false;
    currentReadings.lightValid = false; // No fresh L: field without a live UART packet.
  }

  // 2. CAPACITIVE SOIL MOISTURE (10-sample moving average)
  int rawInstant = analogRead(SOIL_PIN);
  moistureSamples[moistureSampleIdx] = rawInstant;
  moistureSampleIdx = (moistureSampleIdx + 1) % MOISTURE_SAMPLE_COUNT;
  if (moistureSampleIdx == 0) {
    moistureBufferFilled = true;
  }

  int count = moistureBufferFilled ? MOISTURE_SAMPLE_COUNT : moistureSampleIdx;
  if (count > 0) {
    long sum = 0;
    for (int i = 0; i < count; i++) {
      sum += moistureSamples[i];
    }
    int rawAvg = sum / count;
    currentReadings.soilRaw = rawAvg;

    int dryVal = SOIL_ADC_DRY;
    int wetVal = SOIL_ADC_WET;
    int delta = dryVal - wetVal;

    // Safety guard against division-by-zero or degenerate ADC calibration
    if (rawAvg > 50 && rawAvg < 4090 && abs(delta) >= 10) {
      // Lower ADC = wetter soil on capacitive analog sensors
      float pct = ((float)(dryVal - rawAvg) / (float)delta) * 100.0;
      currentReadings.soilPercent = constrain(pct, 0.0, 100.0);
      currentReadings.soilValid = true;
    } else {
      currentReadings.soilValid = false;
    }
  }

  // 3. DHT22 (Air Temperature & Relative Humidity)
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isfinite(t) && isfinite(h) && t >= -40.0 && t <= 80.0 && h >= 0.0 && h <= 100.0) {
    currentReadings.airTemp = t;
    currentReadings.airHumidity = h;
    currentReadings.dhtValid = true;
  } else {
    currentReadings.dhtValid = false;
  }

  // 4. DS18B20 (Submerged Soil Temperature Probe)
  ds18b20.requestTemperatures();
  float dsT = ds18b20.getTempCByIndex(0);

  if (dsT != DEVICE_DISCONNECTED_C && isfinite(dsT) && dsT > -55.0 && dsT < 125.0 && fabs(dsT - 85.0) > 0.05) {
    currentReadings.soilTemp = dsT;
    currentReadings.dsValid = true;
  } else {
    currentReadings.dsValid = false;
  }

  // Light intensity is updated from the pH module L: field in processPHPacket().
}

// ============================================================================
// BUILD PRIMARY TELEMETRY JSON
// ============================================================================
String buildSensorJson() {
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"soil_moisture\":" + formatJsonVal(currentReadings.soilValid, currentReadings.soilPercent, 1) + ",";
  json += "\"soil_raw_adc\":" + String(currentReadings.soilRaw) + ",";
  json += "\"soil_ph\":" + formatJsonVal(currentReadings.phValid, currentReadings.phValue, 2) + ",";
  json += "\"ph_status\":\"" + String(currentReadings.phAir ? "AIR" : (currentReadings.phValid ? "VALID" : "UNAVAILABLE")) + "\",";
  json += "\"soil_temperature\":" + formatJsonVal(currentReadings.dsValid, currentReadings.soilTemp, 1) + ",";
  json += "\"air_temperature\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airTemp, 1) + ",";
  json += "\"air_humidity\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airHumidity, 1) + ",";
  json += "\"light_intensity\":" + formatJsonVal(currentReadings.lightValid, currentReadings.lightLux, 1) + ",";
  json += "\"light_source\":\"PH_MODULE_L_RAW\",";
  json += "\"light_unit\":\"raw\",";
  json += "\"wifi_rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0) + ",";
  json += "\"uptime_ms\":" + String(millis());
  json += "}";
  return json;
}

// ============================================================================
// BUILD LEGACY TELEMETRY JSON
// ============================================================================
String buildLegacyJson() {
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"temp\":" + formatJsonVal(currentReadings.dsValid, currentReadings.soilTemp, 1) + ",";
  json += "\"air_temp\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airTemp, 1) + ",";
  json += "\"humidity\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airHumidity, 1) + ",";
  json += "\"soil\":" + formatJsonVal(currentReadings.soilValid, currentReadings.soilPercent, 1) + ",";
  json += "\"ph\":" + formatJsonVal(currentReadings.phValid, currentReadings.phValue, 2) + ",";
  json += "\"ph_status\":\"" + String(currentReadings.phAir ? "AIR" : (currentReadings.phValid ? "VALID" : "UNAVAILABLE")) + "\",";
  json += "\"light\":" + formatJsonVal(currentReadings.lightValid, currentReadings.lightLux, 1) + ",";
  json += "\"wifi_rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  json += "}";
  return json;
}

// ============================================================================
// PUSH TELEMETRY TO BACKEND (POST /api/hardware/telemetry)
// ============================================================================
void pushTelemetryToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + "/api/hardware/telemetry";

  http.begin(url);
  http.setTimeout(3000);
  http.addHeader("Content-Type", "application/json");

  String payload = buildSensorJson();
  int responseCode = http.POST(payload);

  if (responseCode > 0) {
    Serial.printf("[HTTP POST] Telemetry sent to %s. Status: %d\n", url.c_str(), responseCode);
  } else {
    Serial.printf("[HTTP POST ERROR] Failed to send telemetry: %s\n", http.errorToString(responseCode).c_str());
  }

  http.end();
}

// ============================================================================
// LOCAL ESP32 WEB SERVER HANDLERS
// ============================================================================
void handleSensors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-cache");
  server.send(200, "application/json", buildLegacyJson());
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-cache");
  server.send(200, "application/json", buildSensorJson());
}

void handleRoot() {
  String html;
  html.reserve(4000);

  html += "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='2'>";
  html += "<title>TRINEXA Hardware Monitor</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;background:#0d1117;color:#c9d1d9;text-align:center;padding:20px;}";
  html += ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;max-width:800px;margin:20px auto;}";
  html += ".card{background:#161b22;padding:20px;border-radius:12px;border:1px solid #30363d;}";
  html += ".val{font-size:28px;font-weight:bold;color:#58a6ff;margin-top:8px;}";
  html += ".status{font-size:12px;text-transform:uppercase;color:#8b949e;margin-top:4px;}";
  html += "</style></head><body>";
  html += "<h1>TRINEXA Physical ESP32 Node (" + String(DEVICE_ID) + ")</h1>";
  html += "<p style='color:#8b949e;'>Port 80 Diagnostic Server · IP: " + WiFi.localIP().toString() + "</p>";
  html += "<div class='grid'>";

  html += "<div class='card'>Soil Moisture<div class='val'>";
  html += currentReadings.soilValid ? String(currentReadings.soilPercent, 1) + "%" : "ERROR";
  html += "</div><div class='status'>Raw ADC: " + String(currentReadings.soilRaw) + "</div></div>";

  html += "<div class='card'>Soil pH<div class='val'>";
  html += currentReadings.phAir ? "AIR" : (currentReadings.phValid ? String(currentReadings.phValue, 2) : "UNAVAILABLE");
  html += "</div><div class='status'>" + String(currentReadings.phAir ? "PROBE EXPOSED TO AIR" : (currentReadings.phValid ? getPHClassification(currentReadings.phValue) : "SENSOR ERROR / DISCONNECTED")) + "</div></div>";

  html += "<div class='card'>Soil Temperature<div class='val'>";
  html += currentReadings.dsValid ? String(currentReadings.soilTemp, 1) + " °C" : "ERROR";
  html += "</div><div class='status'>DS18B20 OneWire</div></div>";

  html += "<div class='card'>Air Temperature<div class='val'>";
  html += currentReadings.dhtValid ? String(currentReadings.airTemp, 1) + " °C" : "ERROR";
  html += "</div><div class='status'>DHT22 Microclimate</div></div>";

  html += "<div class='card'>Air Humidity<div class='val'>";
  html += currentReadings.dhtValid ? String(currentReadings.airHumidity, 1) + "%" : "ERROR";
  html += "</div><div class='status'>Relative Humidity</div></div>";

  html += "<div class='card'>Ambient Light<div class='val'>";
  html += currentReadings.lightValid ? String(currentReadings.lightLux, 1) : "UNAVAILABLE";
  html += "</div><div class='status'>pH module raw light intensity (unit unverified)</div></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

// ============================================================================
// WI-FI CONNECTION ROUTINE
// ============================================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected successfully!");
    Serial.print("[WIFI] ESP32 Assigned IP: ");
    Serial.println(WiFi.localIP());
    Serial.printf("[WIFI] Signal Strength RSSI: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("[WIFI] Connection failed. Background auto-retry enabled.");
  }
}

// ============================================================================
// ARDUINO SETUP ROUTINE
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println(" TRINEXA ESP32 AGRICULTURAL INTELLIGENCE SYSTEM");
  Serial.println("==================================================");

  // 1. ADC Configuration for Capacitive Soil Moisture Sensor
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(SOIL_PIN, INPUT);
  Serial.println("[OK] Soil Moisture ADC1_CH6 GPIO 34");

  // 2. DHT22 Digital Sensor
  dht.begin();
  Serial.println("[OK] DHT22 Temperature & Humidity GPIO 4");

  // 3. DS18B20 OneWire Sensor
  ds18b20.begin();
  Serial.println("[OK] DS18B20 Soil Temperature GPIO 5");

  // 4. Soil pH Sensor HardwareSerial 2
  PHSerial.begin(PH_BAUD_RATE, SERIAL_8N1, PH_RX_PIN, PH_TX_PIN);
  PHSerial.setTimeout(100);
  Serial.printf("[OK] 4-in-1 pH Sensor HardwareSerial2 RX=%d TX=%d Baud=%d\n", PH_RX_PIN, PH_TX_PIN, PH_BAUD_RATE);

  // Light intensity is received from the pH module UART L: field.

  // 6. Wi-Fi Ingestion
  connectWiFi();

  // 7. Local HTTP Web Server
  server.on("/", handleRoot);
  server.on("/sensors", handleSensors);
  server.on("/api/status", handleStatus);
  server.on("/api/hardware/status", handleStatus);
  server.begin();
  Serial.println("[OK] Embedded Diagnostic Server Port 80");

  Serial.println("==================================================");
  Serial.println("System initialization completed successfully.");
  Serial.println("==================================================");
}

// ============================================================================
// ARDUINO MAIN LOOP
// ============================================================================
void loop() {
  // 1. Handle incoming local HTTP web requests
  server.handleClient();

  // 2. Continuous non-blocking pH UART reception
  readPHUART();

  unsigned long currentMillis = millis();

  // 3. Wi-Fi reconnection handling
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiAttempt >= WIFI_RETRY_INTERVAL) {
      lastWiFiAttempt = currentMillis;
      Serial.println("[WIFI] Link lost. Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  // 4. Sensor reading every 2000ms
  if (currentMillis - lastSensorReadTime >= 2000) {
    lastSensorReadTime = currentMillis;
    readAllSensors();

    Serial.println();
    Serial.println("--------------------------------------------------");
    Serial.printf("[SOIL] Moisture: %s | Raw ADC: %d\n",
      currentReadings.soilValid ? (String(currentReadings.soilPercent, 1) + "%").c_str() : "ERROR",
      currentReadings.soilRaw
    );

    if (currentReadings.phValid) {
      Serial.printf("[PH] Reading: %.2f | Classification: %s\n",
        currentReadings.phValue,
        getPHClassification(currentReadings.phValue)
      );
    } else {
      Serial.println("[PH] Status: UNAVAILABLE / AWAITING PACKET");
    }

    Serial.printf("[DS18B20] Soil Temperature: %s °C\n",
      currentReadings.dsValid ? String(currentReadings.soilTemp, 1).c_str() : "ERROR"
    );

    Serial.printf("[DHT22] Air Temp: %s °C | Humidity: %s %%\n",
      currentReadings.dhtValid ? String(currentReadings.airTemp, 1).c_str() : "ERROR",
      currentReadings.dhtValid ? String(currentReadings.airHumidity, 1).c_str() : "ERROR"
    );

    Serial.printf("[PH MODULE] Light intensity (raw): %s\n",
      currentReadings.lightValid ? String(currentReadings.lightLux, 1).c_str() : "UNAVAILABLE"
    );
    Serial.println("--------------------------------------------------");
  }

  // 5. Push telemetry to backend every TELEMETRY_INTERVAL_MS (5000ms)
  if (currentMillis - lastTelemetryPushTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryPushTime = currentMillis;
    pushTelemetryToBackend();
  }
}
