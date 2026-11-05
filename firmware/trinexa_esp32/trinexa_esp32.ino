// ============================================================================
// TRINEXA – Physical ESP32 Hardware Integration Firmware
// Target: ESP32 Dev Module / ESP-WROOM-32 (CP2102 USB Bridge)
//
// Sensor Pin Assignments:
//   - GPIO 34 : Capacitive Soil Moisture Sensor (Analog ADC1_CH6)
//   - GPIO  4 : DHT22 Temperature & Humidity Sensor (Digital)
//   - GPIO  5 : DS18B20 Waterproof Soil Temperature Sensor (OneWire)
//   - GPIO 16 : Soil pH Sensor UART RX (HardwareSerial 2)
//   - GPIO 17 : Soil pH Sensor UART TX (HardwareSerial 2)
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
#include <time.h>

// Include local configuration (Copy config.h.template to config.h)
#if __has_include("config.h")
  #include "config.h"
#else
  #define WIFI_SSID     "bhat's"
  #define WIFI_PASSWORD "aaayu72985"
  #define BACKEND_HOST  "10.215.237.53"
  #define BACKEND_PORT  3001
  #define DEVICE_ID     "ESP32-01"
  #define TELEMETRY_INTERVAL_MS 5000
  #define SOIL_ADC_DRY  3470
  #define SOIL_ADC_WET  3390
#endif

// ============================================================================
// HARDWARE PIN DEFINITIONS
// ============================================================================
#define SOIL_PIN        34
#define DHT_PIN         4
#define DHT_TYPE        DHT22
#define DS18B20_PIN     5
#define PH_RX_PIN       16
#define PH_TX_PIN       17
#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22

// ============================================================================
// SENSOR INSTANCES
// ============================================================================
DHT dht(DHT_PIN, DHT_TYPE);
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
HardwareSerial PHSerial(2);
BH1750 lightMeter;
WebServer server(80);

// ============================================================================
// SENSOR READING STATE
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
  float phValue = 0.0;

  bool lightValid = false;
  float lightLux = 0.0;
};

SensorData currentReadings;
String phRawBuffer = "";
unsigned long lastWiFiAttempt = 0;
const unsigned long WIFI_RETRY_INTERVAL = 10000;
unsigned long lastSensorReadTime = 0;
unsigned long lastTelemetryPushTime = 0;

// ============================================================================
// HELPER: Format Float Or Null For JSON
// ============================================================================
String formatJsonVal(bool isValid, float value, int precision = 1) {
  if (!isValid || isnan(value)) return "null";
  return String(value, precision);
}

// ============================================================================
// READING ROUTINES
// ============================================================================
void readPHUART() {
  while (PHSerial.available()) {
    char c = PHSerial.read();
    if (c == '\n') {
      phRawBuffer.trim();
      if (phRawBuffer.length() > 0) {
        float parsed = phRawBuffer.toFloat();
        if (parsed > 0.0 && parsed <= 14.0) {
          currentReadings.phValue = parsed;
          currentReadings.phValid = true;
        } else {
          currentReadings.phValid = false;
        }
      }
      phRawBuffer = "";
    } else if (c != '\r') {
      phRawBuffer += c;
      if (phRawBuffer.length() > 64) phRawBuffer = "";
    }
  }
}

void readAllSensors() {
  // 1. Soil Moisture (Capacitive Analog)
  int raw = analogRead(SOIL_PIN);
  currentReadings.soilRaw = raw;
  if (raw > 50 && raw < 4090) { // Valid ADC range
    int dryVal = SOIL_ADC_DRY;
    int wetVal = SOIL_ADC_WET;
    // Lower ADC = wetter soil on capacitive sensors
    float pct = ((float)(dryVal - raw) / (float)(dryVal - wetVal)) * 100.0;
    currentReadings.soilPercent = constrain(pct, 0.0, 100.0);
    currentReadings.soilValid = true;
  } else {
    currentReadings.soilValid = false;
  }

  // 2. DHT22 (Air Temperature & Humidity)
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h) && t >= -40.0 && t <= 80.0 && h >= 0.0 && h <= 100.0) {
    currentReadings.airTemp = t;
    currentReadings.airHumidity = h;
    currentReadings.dhtValid = true;
  } else {
    currentReadings.dhtValid = false;
  }

  // 3. DS18B20 (Soil Temperature)
  ds18b20.requestTemperatures();
  float dsT = ds18b20.getTempCByIndex(0);
  if (dsT != DEVICE_DISCONNECTED_C && dsT > -55.0 && dsT < 125.0) {
    currentReadings.soilTemp = dsT;
    currentReadings.dsValid = true;
  } else {
    currentReadings.dsValid = false;
  }

  // 4. BH1750 (Ambient Light Sensor)
  if (lightMeter.measurementReady(true)) {
    float lux = lightMeter.readLightLevel();
    if (lux >= 0.0 && lux <= 65535.0) {
      currentReadings.lightLux = lux;
      currentReadings.lightValid = true;
    } else {
      currentReadings.lightValid = false;
    }
  }
}

// ============================================================================
// BUILD PAYLOAD JSON STRING
// ============================================================================
String buildSensorJson() {
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"soil_moisture\":" + formatJsonVal(currentReadings.soilValid, currentReadings.soilPercent, 1) + ",";
  json += "\"soil_raw_adc\":" + String(currentReadings.soilRaw) + ",";
  json += "\"soil_ph\":" + formatJsonVal(currentReadings.phValid, currentReadings.phValue, 2) + ",";
  json += "\"soil_temperature\":" + formatJsonVal(currentReadings.dsValid, currentReadings.soilTemp, 1) + ",";
  json += "\"air_temperature\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airTemp, 1) + ",";
  json += "\"air_humidity\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airHumidity, 1) + ",";
  json += "\"light_intensity\":" + formatJsonVal(currentReadings.lightValid, currentReadings.lightLux, 1) + ",";
  json += "\"wifi_rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0) + ",";
  json += "\"uptime_ms\":" + String(millis());
  json += "}";
  return json;
}

// Legacy format compatibility endpoint (/sensors)
String buildLegacyJson() {
  String json = "{";
  json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  json += "\"temp\":" + formatJsonVal(currentReadings.dsValid, currentReadings.soilTemp, 1) + ",";
  json += "\"air_temp\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airTemp, 1) + ",";
  json += "\"humidity\":" + formatJsonVal(currentReadings.dhtValid, currentReadings.airHumidity, 1) + ",";
  json += "\"soil\":" + formatJsonVal(currentReadings.soilValid, currentReadings.soilPercent, 1) + ",";
  json += "\"ph\":" + formatJsonVal(currentReadings.phValid, currentReadings.phValue, 1) + ",";
  json += "\"light\":" + formatJsonVal(currentReadings.lightValid, currentReadings.lightLux, 1) + ",";
  json += "\"wifi_rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  json += "}";
  return json;
}

// ============================================================================
// HTTP POST TELEMETRY TO TRINEXA BACKEND
// ============================================================================
void pushTelemetryToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + "/api/hardware/telemetry";
  
  http.begin(url);
  http.setTimeout(3000); // 3 sec non-blocking timeout
  http.addHeader("Content-Type", "application/json");

  String payload = buildSensorJson();
  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP POST] Sent telemetry to %s (Status: %d)\n", url.c_str(), httpResponseCode);
  } else {
    Serial.printf("[HTTP POST] Failed to %s, error: %s\n", url.c_str(), http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// ============================================================================
// LOCAL WEBSERVER HANDLERS (PORT 80)
// ============================================================================
void handleSensors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Cache-Control", "no-cache");
  server.send(200, "application/json", buildLegacyJson());
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", buildSensorJson());
}

void handleRoot() {
  String html;
  html.reserve(4000);
  html += "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='2'>";
  html += "<title>TRINEXA Real Hardware Monitor</title>";
  html += "<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0d1117;color:#c9d1d9;text-align:center;padding:20px;}";
  html += ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;max-width:800px;margin:20px auto;}";
  html += ".card{background:#161b22;padding:20px;border-radius:12px;border:1px solid #30363d;}";
  html += ".val{font-size:28px;font-weight:bold;color:#58a6ff;margin-top:8px;}";
  html += ".status{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;}</style></head><body>";
  html += "<h1>TRINEXA Physical ESP32 Node</h1>";
  html += "<p class='status'>Device: " + String(DEVICE_ID) + " | WiFi RSSI: " + String(WiFi.RSSI()) + " dBm</p>";
  html += "<div class='grid'>";

  html += "<div class='card'><div>Soil Moisture</div><div class='val'>" + (currentReadings.soilValid ? String(currentReadings.soilPercent, 1) + " %" : "SENSOR ERR") + "</div></div>";
  html += "<div class='card'><div>Soil pH</div><div class='val'>" + (currentReadings.phValid ? String(currentReadings.phValue, 2) : "UNAVAILABLE") + "</div></div>";
  html += "<div class='card'><div>Soil Temp (DS18B20)</div><div class='val'>" + (currentReadings.dsValid ? String(currentReadings.soilTemp, 1) + " &deg;C" : "SENSOR ERR") + "</div></div>";
  html += "<div class='card'><div>Air Temp (DHT22)</div><div class='val'>" + (currentReadings.dhtValid ? String(currentReadings.airTemp, 1) + " &deg;C" : "SENSOR ERR") + "</div></div>";
  html += "<div class='card'><div>Air Humidity (DHT22)</div><div class='val'>" + (currentReadings.dhtValid ? String(currentReadings.airHumidity, 1) + " %" : "SENSOR ERR") + "</div></div>";
  html += "<div class='card'><div>Light (BH1750)</div><div class='val'>" + (currentReadings.lightValid ? String(currentReadings.lightLux, 1) + " lux" : "SENSOR ERR") + "</div></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

// ============================================================================
// WIFI CONNECTION ROUTINE
// ============================================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Connecting to SSID: %s", WIFI_SSID);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected Successfully!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.printf("[WIFI] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("[WIFI] Connection Failed. Will retry non-blockingly.");
  }
}

// ============================================================================
// MAIN SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==============================================");
  Serial.println("  TRINEXA ESP32 REAL SENSOR SYSTEM INITIALIZING");
  Serial.println("==============================================");

  // 1. Initialize ADC resolution
  analogReadResolution(12);

  // 2. Initialize DHT22
  dht.begin();
  Serial.println("[OK] DHT22 Initialized (GPIO 4)");

  // 3. Initialize DS18B20
  ds18b20.begin();
  Serial.println("[OK] DS18B20 Initialized (GPIO 5)");

  // 4. Initialize pH UART
  PHSerial.begin(9600, SERIAL_8N1, PH_RX_PIN, PH_TX_PIN);
  Serial.println("[OK] pH UART Initialized (RX: GPIO 16, TX: GPIO 17)");

  // 5. Initialize I2C & BH1750
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[OK] BH1750 Light Sensor Initialized (I2C 21/22)");
  } else {
    Serial.println("[WARN] BH1750 Init Failed or Not Detected on I2C bus.");
  }

  // 6. Connect to Wi-Fi
  connectWiFi();

  // 7. Configure Web Server Routes
  server.on("/", handleRoot);
  server.on("/sensors", handleSensors);
  server.on("/api/status", handleStatus);
  server.begin();
  Serial.println("[OK] Embedded Web Server started on Port 80");
  Serial.println("==============================================\n");
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // Handle incoming HTTP client requests
  server.handleClient();

  // Continuously ingest any UART characters from pH probe
  readPHUART();

  unsigned long currentMillis = millis();

  // WiFi Reconnection Management
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiAttempt >= WIFI_RETRY_INTERVAL) {
      lastWiFiAttempt = currentMillis;
      Serial.println("[WIFI] Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  // Periodic Sensor Reading (every 2 seconds)
  if (currentMillis - lastSensorReadTime >= 2000) {
    lastSensorReadTime = currentMillis;
    readAllSensors();

    // Serial Monitor Real-Time Diagnostics
    Serial.println("----------------------------------------------");
    Serial.printf("[PHYSICAL ESP32] Soil Moisture: %s (Raw ADC: %d)\n",
      currentReadings.soilValid ? (String(currentReadings.soilPercent, 1) + "%").c_str() : "ERR",
      currentReadings.soilRaw
    );
    Serial.printf("[PHYSICAL ESP32] Soil pH:       %s\n",
      currentReadings.phValid ? String(currentReadings.phValue, 2).c_str() : "UNAVAILABLE"
    );
    Serial.printf("[PHYSICAL ESP32] Soil Temp:     %s C\n",
      currentReadings.dsValid ? String(currentReadings.soilTemp, 1).c_str() : "ERR"
    );
    Serial.printf("[PHYSICAL ESP32] Air Temp/Hum:  %s C / %s %%\n",
      currentReadings.dhtValid ? String(currentReadings.airTemp, 1).c_str() : "ERR",
      currentReadings.dhtValid ? String(currentReadings.airHumidity, 1).c_str() : "ERR"
    );
    Serial.printf("[PHYSICAL ESP32] Light:         %s lux\n",
      currentReadings.lightValid ? String(currentReadings.lightLux, 1).c_str() : "ERR"
    );
    Serial.println("----------------------------------------------");
  }

  // Periodic Telemetry Push to Backend (every TELEMETRY_INTERVAL_MS)
  if (currentMillis - lastTelemetryPushTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryPushTime = currentMillis;
    pushTelemetryToBackend();
  }
}

