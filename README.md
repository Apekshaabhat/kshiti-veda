# TRINEXA: Real-Time Physical IoT & Soil Intelligence Platform

TRINEXA is an agricultural intelligence platform that bridges **physical ESP32 field sensors**, **real-time telemetry processing**, and an **explainable AI reasoning engine** to monitor and optimize soil health, microclimate conditions, and crop yield.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHYSICAL ESP32 HARDWARE NODE                         │
│  - Capacitive Soil Moisture Sensor (GPIO 34 ADC1_CH6)                  │
│  - 4-in-1 TTL UART Soil pH Sensor (HardwareSerial2 RX 16 / TX 17)      │
│  - DS18B20 Waterproof Soil Temperature Sensor (GPIO 5 OneWire)         │
│  - DHT22 Air Temperature & Humidity Sensor (GPIO 4 Digital)            │
│  - BH1750 Ambient Solar Irradiance Sensor (I2C SDA 21 / SCL 22)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP POST (every 5s over Wi-Fi)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TRINEXA-AI BACKEND ENGINE (:3001)                    │
│  - Ingestion: POST /api/hardware/telemetry                             │
│  - SQLite Database: `hardware_readings`, `simulation_readings`,        │
│    `hardware_devices`, `hardware_ai_insights`, `telemetry_mode`        │
│  - Real-Time AI Diagnostics: Soil hydration, pH root cation exchange,  │
│    fungal risk index, and sensor electrical health checks              │
│  - Centralized Nutrient Modeling: Nitrate, Sodium & Potassium          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ WebSocket Real-Time Broadcast & REST
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TRINEXA-CORE FRONTEND (:5173)                      │
│  - Live Sensor Matrix: Primary sensor node & Soil Macronutrient profile│
│  - Two Operating Modes: Genuine Live Hardware Mode & Simulated Mode    │
│  - Hidden Dot Switch: Subtle top-right mode toggle (persists reloads)  │
│  - Soil Intelligence Dashboard: Soil Health index & Water Intelligence │
│  - Digital Twin (Virtual Farm) & Crop Diagnostic Engine                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Physical Hardware Configuration & Pin Mapping

Target: **ESP32 Dev Module / ESP-WROOM-32** (CP2102 USB Bridge)

| Sensor | ESP32 GPIO | Interface / Bus | Electrical & Wiring Requirements |
| :--- | :--- | :--- | :--- |
| **Capacitive Soil Moisture** | **GPIO 34** | Analog (ADC1_CH6) | Powered by 3.3V. Input-only pin on ADC1 (operates concurrently with active Wi-Fi). |
| **DHT22 (Air Temp & Humidity)** | **GPIO 4** | Digital Single-Wire | Powered by 3.3V. Requires a 4.7kΩ pull-up resistor between VCC and DATA. |
| **DS18B20 (Soil Temperature)** | **GPIO 5** | OneWire Bus | Waterproof probe. Requires a 4.7kΩ pull-up resistor to 3.3V. *(Note: GPIO 5 is strapping pin MTDO. If boot hangs on your board, wire to **GPIO 18**)*. |
| **4-in-1 Soil pH Sensor** | **RX: 16, TX: 17** | UART (HardwareSerial2)| 9600 baud, 8N1 serial protocol. **Level shifter / voltage divider required** if module logic is 5V. |
| **BH1750 (Ambient Light)** | **SDA: 21, SCL: 22**| I2C (`Wire`) | Powered by 3.3V. Internal/external pull-ups to 3.3V on SDA/SCL. |

> [!IMPORTANT]
> **Electrical Safety Precautions for 4-in-1 pH Module**:
> The 4-in-1 pH sensor module operates on a 5V supply. Verify the module's UART TX logic voltage before connecting to the ESP32. ESP32 GPIO pins are strictly 3.3V tolerant. If the module outputs 5V TTL on its TX line, insert a bidirectional logic level shifter or a resistive voltage divider (1kΩ and 2kΩ) between the module's TX pin and ESP32 GPIO 16 to protect the microcontroller.

---

## 3. 4-in-1 pH Sensor Integration

### A. UART Interface (Primary Acquisition Method)
The firmware uses ESP32 `HardwareSerial2` configured as follows:
```cpp
PHSerial.begin(9600, SERIAL_8N1, 16, 17);
PHSerial.setTimeout(100);
```

### B. Supported Packet Formats & Robust Parsing
The firmware parser supports both major physical output formats:
1. **Labelled format**: `pH:7.20,L:45,T:26.5,W:1` (or `PH:7.20...`)
2. **Unlabelled CSV format**: `7.20,45,26.5,1`

**Parser Safeguards:**
- Reads complete `\n`-delimited lines and trims whitespace.
- Checks numeric validity before conversion (never calls `String.toFloat()` on raw packets).
- Validates the pH reading against the physical range ($0.00 \le \text{pH} \le 14.00$).
- Disconnection & Stale Timeout: If no valid packet arrives within `PH_TIMEOUT_MS` (5000ms), `currentReadings.phValid` is set to `false`, and `null` is transmitted to the backend.
- Auxiliary fields (`L:` light, `T:` temperature, `W:` water) from the 4-in-1 sensor are extracted into diagnostic variables for the Serial Monitor and **never overwrite** the primary BH1750, DHT22, or DS18B20 readings.

### C. Alternative D5 Analog Interface (Reference)
If using the module's analog pin (D5) instead of UART:
- Measure actual voltage range with a multimeter.
- ESP32 ADC uses 12-bit resolution ($0 - 4095$).
- Two-point buffer calibration: Measure ADC in pH 7.0 buffer ($V_7$) and pH 4.0 buffer ($V_4$).
- Calculate calibration slope: $m = \frac{7.0 - 4.0}{V_7 - V_4}$ and offset: $b = 7.0 - (m \times V_7)$.
- Conversion: $\text{pH} = m \times V_{\text{ADC}} + b$.

---

## 4. Capacitive Soil Moisture Calibration

Previous arbitrary calibration constants (2400 and 720) have been replaced with observed physical baseline values:
- **Dry Air Baseline**: $\approx 3470$ ADC counts ($0.0\%$ moisture)
- **Saturated Soil Baseline**: $\approx 3370$ ADC counts ($100.0\%$ moisture)

```cpp
#define SOIL_ADC_DRY 3470
#define SOIL_ADC_WET 3370
#define MOISTURE_SAMPLE_COUNT 10
```

### Filtering & Inversion:
- Capacitive sensors exhibit an **inverse relationship**: higher water content increases dielectric permittivity, lowering the measured ADC counts.
- **10-Sample Moving Average**: Dampens transient power supply ripple and RF noise.
- **Formula**:
  $$\text{Moisture } \% = \left(\frac{\text{SOIL\_ADC\_DRY} - \text{Raw\_ADC}}{\text{SOIL\_ADC\_DRY} - \text{SOIL\_ADC\_WET}}\right) \times 100$$
- **Safeguards**: Clamped between $0.0\%$ and $100.0\%$. Division-by-zero protection is enforced if $|\text{dry} - \text{wet}| < 10$.
- **Saturated Soil vs. Immersion**: Saturated agronomic topsoil typically reads 3370–3390 ADC counts. Immersion in pure tap water may produce 3350 ADC counts due to mineral conductivity differences.

---

## 5. Other Physical Sensor Validation

- **DHT22 (Air Temp & Humidity)**: Rejects `NaN` readings and bounds checking ($-40^\circ\text{C}$ to $+80^\circ\text{C}$, $0\%$ to $100\%$ RH).
- **DS18B20 (Soil Temperature)**: Rejects `DEVICE_DISCONNECTED_C` ($-127^\circ\text{C}$) and DS18B20 uninitialized reset state ($+85.0^\circ\text{C}$).
- **BH1750 (Ambient Light)**: Validates I2C communication via `measurementReady(true)`. Rejects readings exceeding $65,535\text{ lux}$.
- **Independent Sensor Validity**: Every sensor maintains an independent validity flag. In Live Mode, failing or disconnected sensors transmit `null` to the backend rather than synthetic replacement values.

---

## 6. Two-Mode Operating Architecture

The platform provides a centralized two-mode architecture:

```
                  ┌──────────────────────┐
                  │ TELEMETRY OPERATING  │
                  │        MODE          │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │    LIVE MODE    │               │ SIMULATED MODE  │
   │ (Genuine ESP32) │               │ (Digital Twin)  │
   └─────────────────┘               └─────────────────┘
```

### A. Live Hardware Mode
- Receives physical readings from the ESP32 via `POST /api/hardware/telemetry`.
- Preserves genuine null values when a physical sensor is disconnected.
- If the ESP32 disconnects or a sensor is unavailable, the sensor card displays:
  **`Sensor Error / Disconnected`** along with the last active timestamp.
- Displays the **`LIVE TELEMETRY`** badge on the primary sensor node header.

### B. Simulated Mode (Digital Twin)
- Driven by the centralized simulation engine.
- Generates realistic, gradual, and calibrated farm average readings across all sensors.
- Hardware disconnection errors and "Sensor Error / Disconnected" messages are **never** shown in simulated mode.
- The `LIVE TELEMETRY` indicator is **hidden**.
- No visible "Simulation Mode" label is displayed, preserving identical UI design.

### C. Hidden Dot Mode Switch
- Located at the top-right of the `Sensors` page as a subtle small dot.
- Functions as an interactive toggle button between **Live Mode** and **Simulated Mode**.
- Retains its discreet design without intrusive text or large switches.
- Persists user selection across page reloads via `localStorage` (`trinexa_telemetry_mode`) and backend synchronization.

---

## 7. Keyboard-Controlled Simulation

Keyboard shortcuts operate **exclusively in Simulated Mode** and are disabled in Live Mode:

| Key | Action | Adjustment | Description |
| :--- | :--- | :--- | :--- |
| **`M`** | Increase Moisture | **+1.0%** | Simulates rainfall or drip irrigation |
| **`Shift + M`** | Decrease Moisture | **-1.0%** | Simulates evapotranspiration and drought deficit |
| **`T`** | Increase Temperature | **+0.5°C** | Simulates solar heating of topsoil |
| **`Shift + T`** | Decrease Temperature | **-0.5°C** | Simulates nocturnal cooling |
| **`P`** | Increase Soil pH | **+0.1 pH** | Simulates alkaline amendment (lime) |
| **`Shift + P`** | Decrease Soil pH | **-0.1 pH** | Simulates acidification (sulfur/organic matter) |

- **Safeguards**: Keyboard shortcuts are automatically suppressed when typing inside form inputs, textareas, selects, or editable fields.
- **Discreet**: Shortcuts are not visibly printed on the dashboard.

---

## 8. Nutrient Estimates (Nitrate, Sodium, Potassium)

Because the dev hardware does not feature physical optical/ion-selective NPK electrodes, nutrient metrics are modeled as **estimated demonstration baselines** in both modes:

1. **Nitrate ($\text{NO}_3^-$)**: Baseline $\approx 52.4\text{ mg/kg}$ (Healthy vegetative range: $40 - 70\text{ mg/kg}$). Labeled as **Nitrate (Estimated)**, not total nitrogen.
2. **Sodium ($\text{Na}^+$)**: Baseline $\approx 26.8\text{ mg/kg}$ (Safe non-sodic range: $15 - 40\text{ mg/kg}$). Labeled as **Sodium (Estimated)**, not confused with phosphorus.
3. **Potassium ($\text{K}^+$)**: Baseline $\approx 74.2\text{ mg/kg}$ (Optimal stomatal range: $60 - 90\text{ mg/kg}$). Labeled as **Potassium (Estimated)**.
4. **SAR & Salinity Index**: Estimated baseline $\approx 1.8\text{ SAR}$ (Optimal cation balance $< 3.0$).

---

## 9. Zone Aggregation & Digital Twin

The secondary section on the `Sensors` page focuses on:
- **Soil Macronutrient Profile**: Dedicated cards for Nitrate, Sodium, Potassium, and SAR Index.
- **Multi-Zone Digital Twin**: Health scores and agronomic conditions for Zone A (ESP32 Node), Zone B (South Orchard), and Zone C (East Greenhouse).
- **Clean Layout**: Redundant duplicated moisture, temperature, and pH cards have been removed from the lower section.

---

## 10. API Endpoints

### Hardware Ingestion
- `POST /api/hardware/telemetry`: Ingests real-time sensor packets from physical ESP32.

### Hardware Status & Diagnostics
- `GET /api/hardware/status`: Returns current operating mode, connection state (`online`/`offline`), last seen time, and sensor reading frame.
- `GET /api/hardware/latest`: Returns latest valid reading payload.
- `GET /api/hardware/history?limit=50&offset=0`: Historical database records from `hardware_readings`.
- `GET /api/hardware/devices`: Registered physical hardware nodes.
- `GET /api/hardware/ai-insights`: Real-time AI soil health score, moisture stress, fungal risk, and explainable prescriptions.

### Operating Mode & Simulation Engine
- `GET /api/telemetry/mode`: Returns active telemetry operating mode (`LIVE` or `SIMULATED`).
- `POST /api/telemetry/mode`: Updates active mode (`{ "mode": "LIVE" | "SIMULATED" }`).
- `GET /api/simulation/state`: Returns current state of the simulation engine.
- `POST /api/simulation/control`: Receives delta or absolute adjustments (`deltaMoisture`, `deltaTemp`, `deltaPh`).
- `POST /api/simulation/reset`: Resets simulated values to baseline.

### Notification Management System
- `GET /api/notifications`: Returns paginated notifications with filters for `unread_only`, `category`, and `severity`.
- `GET /api/notifications/count`: Returns count of unread notifications for navbar badge.
- `POST /api/notifications`: Dispatches a new notification with alert deduplication and cooldown.
- `POST /api/notifications/:id/read`: Marks a single notification as read.
- `POST /api/notifications/mark-all-read`: Marks all pending notifications as read.
- `DELETE /api/notifications/:id`: Removes a notification record.
- `GET /api/notifications/preferences`: Retrieves user alert delivery preferences.
- `PUT /api/notifications/preferences`: Updates alert delivery preferences.

### Agricultural Report Management
- `GET /api/reports`: Lists all generated farm reports.
- `GET /api/reports/:id`: Retrieves report summary and data payload.
- `POST /api/reports/generate`: Generates an official report across 13 agronomic categories (Daily, Weekly, Monthly, Soil Health, Sensor Performance, Crop Monitoring, Irrigation, Expenses, AI Insights).
- `GET /api/reports/:id/download?format=pdf`: Formatted printable HTML/PDF report.
- `GET /api/reports/:id/download?format=csv`: Standard CSV dataset export.

### Agricultural Market Price System
- `GET /api/market/prices`: Real-time Agmarknet commodity prices across APMC mandis.
- `GET /api/market/compare?commodity_id=...`: Compares commodity modal realization across mandis.
- `GET /api/market/history?commodity_id=...&days=30`: 30-day historical modal price trendline.
- `GET /api/market/watchlist`: Returns user's monitored commodity watchlist.
- `POST /api/market/watchlist`: Adds a commodity to the watchlist.
- `DELETE /api/market/watchlist/:commodity_id`: Removes a commodity from the watchlist.
- `POST /api/market/alerts`: Configures target-price notification triggers.

### Expense & Financial Management System
- `GET /api/expenses?farm_id=...`: Returns ledger of expenditures with category breakdowns.
- `GET /api/expenses/summary?farm_id=...`: Total spend, monthly expenditure, category share, and payment statuses (`PAID`, `PENDING`, `OVERDUE`).
- `POST /api/expenses`: Records new farm expenditure with strictly positive amount validation.
- `PUT /api/expenses/:id`: Updates an existing expense record.
- `DELETE /api/expenses/:id`: Removes an expense from the ledger.
- `GET /api/expenses/budgets?farm_id=...`: Retrieves farm category budgets with overrun thresholds.
- `POST /api/expenses/budgets`: Sets or updates budget limits with automated notification triggers.

### Virtual Farm Management System
- `GET /api/farms`: Lists all farms registered to the user.
- `GET /api/farms/:id`: Retrieves farm profile, zones, and active crops.
- `GET /api/farms/:id/overview`: Executive KPI dashboard (area, zones, active crops, upcoming activities, monthly expenses).
- `GET /api/farms/:id/zones`: Multi-zone management.
- `POST /api/farms/:id/zones`: Creates a new zone with soil type and irrigation configuration.
- `GET /api/farms/:id/activities`: Track scheduled agronomic activities (Sowing, Irrigation, Fertilization, Spraying, Harvest).
- `POST /api/farms/:id/activities`: Schedules a new farm operation.
- `GET /api/farms/:id/calendar`: Categorizes upcoming, completed, and overdue farm events.

---

## 11. Interactive Demonstration Keyboard Shortcuts

To keep the user interface clean, presentation shortcuts are operated silently in the background when the system is in **Simulated Mode**:

| Shortcut Key | Parameter | Adjustment Step | Bounds |
| :--- | :--- | :--- | :--- |
| **`m`** / **`M`** | Soil Moisture | `+1.0%` | Clamped to `[0%, 100%]` |
| **`Shift + M`** | Soil Moisture | `-1.0%` | Clamped to `[0%, 100%]` |
| **`t`** / **`T`** | Soil Temperature | `+0.5°C` | Clamped to `[-10°C, 60°C]` |
| **`Shift + T`** | Soil Temperature | `-0.5°C` | Clamped to `[-10°C, 60°C]` |
| **`p`** / **`P`** | Soil pH | `+0.1 pH` | Clamped to `[0.0, 14.0]` |
| **`Shift + P`** | Soil pH | `-0.1 pH` | Clamped to `[0.0, 14.0]` |

*(Note: Keyboard shortcuts are inactive when typing inside input forms or text areas).*

---

---

## 11. Prerequisites & Required Libraries

### Node.js & System
- Node.js v18.0.0+
- npm v9.0.0+

### Arduino IDE Libraries
Install via **Tools > Manage Libraries**:
1. `DHT sensor library` by Adafruit (v1.4.6+)
2. `Adafruit Unified Sensor` by Adafruit (v1.1.14+)
3. `DallasTemperature` by Miles Burton (v3.9.0+)
4. `OneWire` by Paul Stoffregen (v2.3.8+)
5. `BH1750` by Christopher Laws (v1.3.0+)

---

## 12. Complete Startup Instructions

### Step 1: Install Dependencies
```powershell
# Navigate to project directory
cd "c:\Users\apeks\Desktop\trinexa_ai-main\trinexa_ai-main"

# Install dependencies
npm install
```

### Step 2: Configure ESP32 Firmware
1. Open `firmware/trinexa_esp32/trinexa_esp32.ino` in Arduino IDE.
2. Copy `firmware/trinexa_esp32/config.h.template` to `config.h` in the same directory:
   ```powershell
   Copy-Item firmware/trinexa_esp32/config.h.template firmware/trinexa_esp32/config.h
   ```
3. Update `config.h` with your Wi-Fi credentials and your computer's local IP address:
   ```cpp
   #define WIFI_SSID     "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
   #define BACKEND_HOST  "192.168.1.50"   // IPv4 from `ipconfig`
   #define BACKEND_PORT  3001
   ```
4. Flash the ESP32: Select **ESP32 Dev Module**, choose the COM port, and upload.

### Step 3: Clear Ports & Start the Application
To ensure ports `3001` and `5173` are clear and launch the dev servers:
```powershell
# Clear any lingering processes on ports 3001 and 5173
$ports = @(3001, 5173); foreach ($p in $ports) { Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }

# Start both TRINEXA-CORE frontend and TRINEXA-AI backend
npm run dev
```

### Step 4: Access Dashboard
- **Local Access**: [http://localhost:5173/sensors](http://localhost:5173/sensors)
- **Local Network (LAN)**: `http://<YOUR_IP>:5173/sensors`
- **Dashboard**: [http://localhost:5173/dashboard](http://localhost:5173/dashboard)

---

## 13. Running Automated Tests

Run the full Vitest suite:
```powershell
npm test
```
All 12 automated unit tests verify:
1. Valid telemetry processing without errors
2. Disconnected sensor / null-handling safety
3. Drought stress detection and irrigation alert generation
4. Acidic pH detection and agricultural lime recommendation
5. Fungal pathogen microclimate risk detection
6. Hardware ADC short-circuit and open-pin anomaly detection
7. Centralized nutrient modeling in Live Hybrid mode
8. Nitrate, Sodium, and Potassium evaluation without metric confusion
9. Capacitive soil moisture narrow-delta calibration and division-by-zero protection
10. 4-in-1 pH UART packet parsing algorithm (labelled and CSV formats, out-of-range rejection)
11. Keyboard simulation controls (`M`, `Shift+M`, `T`, `Shift+T`, `P`, `Shift+P`) and bounds
12. Application health and routing tests

---

## 14. License

This project is licensed under the MIT License.
