import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import http from 'http';
import { runHardwareAIAnalysis, HardwareTelemetry, AIAnalysisResult, SensorAlert } from './aiEngine';
import { initDatabase, db as appDb } from './database';
import { notificationRouter, registerNotificationWs, triggerNotification } from './notifications';
import { marketRouter } from './market';
import { expenseRouter } from './expenses';
import { virtualFarmRouter } from './virtualFarm';
import { reportRouter } from './reports';

// ============================================================================
// ENVIRONMENT & CONFIGURATION
// ============================================================================
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || '0.0.0.0';
const HARDWARE_TIMEOUT_MS = process.env.HARDWARE_TIMEOUT_MS ? parseInt(process.env.HARDWARE_TIMEOUT_MS, 10) : 15000;

// Database setup (SQLite in-memory or file-backed via env)
const DB_PATH = process.env.DB_PATH || ':memory:';
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL, area REAL, crop TEXT, created_at INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, farm_id TEXT, amount REAL, category TEXT, note TEXT, date INTEGER)`);
  
  // Insert default farm if empty
  db.run(`INSERT OR IGNORE INTO farms (id, name, lat, lon, area, crop, created_at) VALUES ('farm-default', 'Green Valley Farm', 18.5204, 73.8567, 120, 'Wheat', ?)`, [Date.now()]);

  db.run(`CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone TEXT,
    moisture REAL,
    ph REAL,
    nitrogen REAL,
    phosphorus REAL,
    potassium REAL,
    temperature REAL,
    timestamp INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS risk_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone TEXT,
    severity TEXT,
    parameter TEXT,
    message TEXT,
    timestamp INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    text TEXT,
    timestamp INTEGER
  )`);

  // Physical ESP32 Hardware Registered Devices Table
  db.run(`CREATE TABLE IF NOT EXISTS hardware_devices (
    device_id TEXT PRIMARY KEY,
    name TEXT,
    status TEXT,
    last_seen INTEGER,
    wifi_rssi INTEGER,
    first_registered INTEGER
  )`);

  // Physical ESP32 Hardware Readings Table
  db.run(`CREATE TABLE IF NOT EXISTS hardware_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    soil_moisture REAL,
    soil_raw_adc INTEGER,
    soil_ph REAL,
    ph_status TEXT DEFAULT 'VALID',
    air_temperature REAL,
    air_humidity REAL,
    soil_temperature REAL,
    light_intensity REAL,
    light_source TEXT DEFAULT 'PH_MODULE_L_RAW',
    light_unit TEXT DEFAULT 'raw',
    wifi_rssi INTEGER,
    uptime_ms INTEGER,
    timestamp INTEGER,
    received_at TEXT
  )`);
  db.run(`ALTER TABLE hardware_readings ADD COLUMN ph_status TEXT DEFAULT 'VALID'`, () => {});
  db.run(`ALTER TABLE hardware_readings ADD COLUMN light_source TEXT DEFAULT 'PH_MODULE_L_RAW'`, () => {});
  db.run(`ALTER TABLE hardware_readings ADD COLUMN light_unit TEXT DEFAULT 'raw'`, () => {});

  // Hardware AI Insights History Table
  db.run(`CREATE TABLE IF NOT EXISTS hardware_ai_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    overall_score INTEGER,
    soil_status TEXT,
    water_requirement TEXT,
    fungal_disease_risk TEXT,
    photosynthesis_efficiency TEXT,
    insights_json TEXT,
    prescriptions_json TEXT,
    timestamp INTEGER
  )`);

  // Hardware Active Alerts Table
  db.run(`CREATE TABLE IF NOT EXISTS hardware_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    parameter TEXT,
    severity TEXT,
    message TEXT,
    recommendation TEXT,
    resolved INTEGER DEFAULT 0,
    timestamp INTEGER
  )`);

  // Telemetry Central Operating Mode (LIVE vs SIMULATED)
  db.run(`CREATE TABLE IF NOT EXISTS telemetry_mode (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'LIVE',
    updated_at INTEGER NOT NULL
  )`);
  db.run(`INSERT OR IGNORE INTO telemetry_mode (id, mode, updated_at) VALUES (1, 'LIVE', ?)`, [Date.now()]);

  // Simulation Readings Table (separate from genuine physical readings)
  db.run(`CREATE TABLE IF NOT EXISTS simulation_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moisture REAL,
    ph REAL,
    soil_temperature REAL,
    air_temperature REAL,
    air_humidity REAL,
    light_intensity REAL,
    nitrogen REAL,
    phosphorus REAL,
    potassium REAL,
    timestamp INTEGER
  )`);

  // Clean any legacy negative readings if present
  db.run(`UPDATE telemetry SET phosphorus = 55.0 WHERE phosphorus < 0`);
});

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database & seed default data
initDatabase().then(() => {
  console.log('[TRINEXA-AI] SQLite Database & Seed Data Initialized');
}).catch(err => {
  console.error('[TRINEXA-AI] Failed to init database:', err);
});

// Register WebSocket notification dispatcher
registerNotificationWs((notification) => {
  const payload = JSON.stringify({
    type: 'NOTIFICATION_NEW',
    payload: notification
  });
  clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(payload);
    }
  });
});

// Mount database-backed feature routers
app.use('/api/notifications', notificationRouter);
app.use('/api/reports', reportRouter);
app.use('/api/market', marketRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/farms', virtualFarmRouter);
app.use('/api/crops', virtualFarmRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

let clients: WebSocket[] = [];
wss.on('connection', (ws) => {
  clients.push(ws);
  sendFullState(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Centralized Two-Mode Telemetry Architecture
export type TelemetryMode = 'LIVE' | 'SIMULATED';
let currentMode: TelemetryMode = 'LIVE';

// Read initial telemetry mode from database
db.get('SELECT mode FROM telemetry_mode WHERE id = 1', (err, row: any) => {
  if (!err && row?.mode) {
    currentMode = row.mode as TelemetryMode;
    console.log(`[TRINEXA-AI] Loaded Telemetry Mode from DB: ${currentMode}`);
  }
});

export interface SimulationState {
  moisture: number;
  ph: number;
  soil_temperature: number;
  air_temperature: number;
  air_humidity: number;
  light_intensity: number;
  nitrate: number;
  sodium: number;
  potassium: number;
  nitrogen?: number;
  phosphorus?: number;
  last_updated: number;
}

const DEFAULT_SIMULATION_STATE: SimulationState = {
  moisture: 58.5,
  ph: 6.8,
  soil_temperature: 24.5,
  air_temperature: 27.2,
  air_humidity: 65.0,
  light_intensity: 450.0,
  nitrate: 71.7,
  sodium: 45.0,
  potassium: 70.0,
  nitrogen: 71.7,
  phosphorus: 45.0,
  last_updated: Date.now()
};

let simulationState: SimulationState = { ...DEFAULT_SIMULATION_STATE };
const serverStartTime = Date.now();

// Telemetry State
export interface ZoneState {
  id: string;
  name: string;
  moisture: number | null;
  ph: number | null;
  nitrate: number | null;
  sodium: number | null;
  potassium: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  temperature: number | null;
  healthScore: number;
  condition: string;
}

export interface HardwareStatus {
  mode: TelemetryMode;
  npk_available: boolean;
  npk_provenance: 'simulation';
  online: boolean;
  device_id: string | null;
  last_seen: number | null;
  timeout_ms: number;
  data: (HardwareTelemetry & {
    temp?: number | null;
    humidity?: number | null;
    soil?: number | null;
    ph?: number | null;
    light?: number | null;
    nitrate?: number;
    sodium?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    npk_provenance?: 'simulation';
  }) | null;
  ai_analysis: AIAnalysisResult | null;
}

let lastHardwareData: HardwareTelemetry | null = null;
let lastHardwareTimestamp = 0;
let lastAIAnalysis: AIAnalysisResult | null = null;

function getHardwareStatus(): HardwareStatus {
  if (currentMode === 'SIMULATED') {
    const simTelemetry: HardwareTelemetry = {
      device_id: 'ESP32-01',
      soil_moisture: simulationState.moisture,
      soil_raw_adc: Math.round(3470 - (simulationState.moisture / 100) * (3470 - 3370)),
      soil_ph: simulationState.ph,
      soil_temperature: simulationState.soil_temperature,
      air_temperature: simulationState.air_temperature,
      air_humidity: simulationState.air_humidity,
      light_intensity: simulationState.light_intensity,
      wifi_rssi: -45,
      uptime_ms: Date.now() - serverStartTime,
      timestamp: simulationState.last_updated
    };

    const simAI = runHardwareAIAnalysis(simTelemetry, 'SIMULATED', {
      nitrogen: simulationState.nitrogen,
      phosphorus: simulationState.phosphorus,
      potassium: simulationState.potassium,
      provenance: 'simulation'
    });

    return {
      mode: 'SIMULATED',
      npk_available: true,
      npk_provenance: 'simulation',
      online: true,
      device_id: 'ESP32-01',
      last_seen: simulationState.last_updated,
      timeout_ms: HARDWARE_TIMEOUT_MS,
      data: {
        ...simTelemetry,
        temp: simulationState.soil_temperature,
        humidity: simulationState.air_humidity,
        soil: simulationState.moisture,
        ph: simulationState.ph,
        light: simulationState.light_intensity,
        nitrate: simulationState.nitrate,
        sodium: simulationState.sodium,
        potassium: simulationState.potassium,
        nitrogen: simulationState.nitrate,
        phosphorus: simulationState.sodium,
        npk_provenance: 'simulation'
      },
      ai_analysis: simAI
    };
  }

  // LIVE MODE: Genuine physical ESP32 data + centralized simulated NPK (Hybrid Mode)
  const isOnline = lastHardwareData !== null && (Date.now() - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);

  let compatibleData = null;
  if (lastHardwareData) {
    compatibleData = {
      ...lastHardwareData,
      temp: lastHardwareData.soil_temperature ?? lastHardwareData.air_temperature,
      humidity: lastHardwareData.air_humidity,
      soil: lastHardwareData.soil_moisture,
      ph: lastHardwareData.ph_status === 'VALID' ? lastHardwareData.soil_ph : null,
      ph_status: lastHardwareData.ph_status || (lastHardwareData.soil_ph !== null ? 'VALID' : 'UNAVAILABLE'),
      light: lastHardwareData.light_intensity,
      light_intensity: lastHardwareData.light_intensity,
      light_source: lastHardwareData.light_source || 'PH_MODULE_L_RAW',
      light_unit: lastHardwareData.light_unit || 'raw',
      nitrate: simulationState.nitrate,
      sodium: simulationState.sodium,
      potassium: simulationState.potassium,
      nitrogen: simulationState.nitrogen ?? simulationState.nitrate,
      phosphorus: simulationState.phosphorus ?? simulationState.sodium,
      npk_provenance: 'simulation' as const
    };
  }

  // Prevent stale sensor readings from being presented as fresh readings when device has timed out
  const liveData = isOnline ? compatibleData : (compatibleData ? {
    ...compatibleData,
    soil_ph: null,
    ph: null,
    ph_status: 'UNAVAILABLE' as const,
    light_intensity: null,
    light: null,
    soil_moisture: null,
    soil: null,
    soil_temperature: null,
    temp: null,
    air_temperature: null,
    air_humidity: null,
    humidity: null
  } : null);

  return {
    mode: 'LIVE',
    npk_available: true,
    npk_provenance: 'simulation',
    online: isOnline,
    device_id: lastHardwareData?.device_id || (lastHardwareTimestamp > 0 ? "ESP32-01" : null),
    last_seen: lastHardwareTimestamp > 0 ? lastHardwareTimestamp : null,
    timeout_ms: HARDWARE_TIMEOUT_MS,
    data: liveData,
    ai_analysis: isOnline ? lastAIAnalysis : null
  };
}

let zones: ZoneState[] = [
  { id: 'zone-a', name: 'Zone A (Physical ESP32 Node)', moisture: null, ph: null, nitrate: 71.7, sodium: 45.0, potassium: 70.0, nitrogen: 71.7, phosphorus: 45.0, temperature: null, healthScore: 0, condition: 'Waiting for Telemetry' },
  { id: 'zone-b', name: 'Zone B - South Orchard', moisture: 70.0, ph: 6.7, nitrate: 65.0, sodium: 42.0, potassium: 72.0, nitrogen: 65.0, phosphorus: 42.0, temperature: 27.0, healthScore: 92, condition: 'Healthy' },
  { id: 'zone-c', name: 'Zone C - East Greenhouse', moisture: 68.0, ph: 7.0, nitrate: 62.0, sodium: 48.0, potassium: 68.0, nitrogen: 62.0, phosphorus: 48.0, temperature: 25.0, healthScore: 88, condition: 'Healthy' }
];

function syncZoneA() {
  const zoneA = zones.find(z => z.id === 'zone-a');
  if (!zoneA) return;

  // Rule: Nitrate, Sodium and Potassium always use the centralized estimated nutrient data source in both modes
  zoneA.nitrate = simulationState.nitrate;
  zoneA.sodium = simulationState.sodium;
  zoneA.potassium = simulationState.potassium;
  zoneA.nitrogen = simulationState.nitrogen ?? simulationState.nitrate;
  zoneA.phosphorus = simulationState.phosphorus ?? simulationState.sodium;

  if (currentMode === 'LIVE') {
    const isOnline = lastHardwareData !== null && (Date.now() - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);
    if (isOnline && lastHardwareData) {
      zoneA.moisture = lastHardwareData.soil_moisture;
      zoneA.ph = (lastHardwareData.ph_status === 'VALID' || (!lastHardwareData.ph_status && lastHardwareData.soil_ph !== null)) 
        ? lastHardwareData.soil_ph 
        : null;
      zoneA.temperature = lastHardwareData.soil_temperature;

      const liveAi = runHardwareAIAnalysis(
        lastHardwareData,
        'LIVE',
        {
          nitrogen: simulationState.nitrogen,
          phosphorus: simulationState.phosphorus,
          potassium: simulationState.potassium,
          provenance: 'simulation'
        }
      );
      lastAIAnalysis = liveAi;
      zoneA.healthScore = liveAi.overall_score;
      zoneA.condition = liveAi.soil_status;
    } else {
      // Disconnected / Offline ESP32: physical sensors drop to null, but simulated NPK remains active
      zoneA.moisture = null;
      zoneA.ph = null;
      zoneA.temperature = null;
      zoneA.healthScore = 0;
      zoneA.condition = 'Hardware Offline';
    }
  } else {
    // SIMULATED mode
    zoneA.moisture = simulationState.moisture;
    zoneA.ph = simulationState.ph;
    zoneA.temperature = simulationState.soil_temperature;

    const simAI = runHardwareAIAnalysis({
      device_id: 'ESP32-01',
      soil_moisture: simulationState.moisture,
      soil_ph: simulationState.ph,
      soil_temperature: simulationState.soil_temperature,
      air_temperature: simulationState.air_temperature,
      air_humidity: simulationState.air_humidity,
      light_intensity: simulationState.light_intensity,
      wifi_rssi: -45,
      timestamp: simulationState.last_updated
    }, 'SIMULATED', {
      nitrogen: simulationState.nitrogen,
      phosphorus: simulationState.phosphorus,
      potassium: simulationState.potassium,
      provenance: 'simulation'
    });

    zoneA.healthScore = simAI.overall_score;
    zoneA.condition = simAI.soil_status;
  }
}

let demoModeActive = false;
let cycleCount = 0;
let events: any[] = [];
let activities: any[] = [
  { type: 'system', text: 'SoilMatrix Engine initialized. Listening for ESP32 physical telemetry.', timestamp: Date.now() - 60000 }
];

const logActivity = (type: string, text: string) => {
  const ts = Date.now();
  activities.unshift({ type, text, timestamp: ts });
  if (activities.length > 50) activities.pop();
  db.run('INSERT INTO activity_events (type, text, timestamp) VALUES (?, ?, ?)', [type, text, ts]);
};

// ============================================================================
// HARDWARE TELEMETRY INGESTION ENDPOINT
// POST /api/hardware/telemetry
// ============================================================================
app.post('/api/hardware/telemetry', (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Malformed request: payload must be a valid JSON object' });
    }

    const device_id = String(body.device_id || 'ESP32-01').trim();
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // Strict physical validation: null preserved when sensors are disconnected/failing
    const parseBounded = (val: any, min: number, max: number): number | null => {
      if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
      const num = Number(val);
      return (num >= min && num <= max) ? Number(num.toFixed(2)) : null;
    };

    // pH Status and numerical validation
    let ph_status: 'VALID' | 'AIR' | 'UNAVAILABLE' = 'UNAVAILABLE';
    const explicitStatus = body.ph_status ? String(body.ph_status).toUpperCase().trim() : null;
    const rawPhInput = body.soil_ph !== undefined ? body.soil_ph : body.ph;
    const numPh = (rawPhInput !== null && rawPhInput !== undefined && rawPhInput !== '' && !isNaN(Number(rawPhInput)))
      ? Number(Number(rawPhInput).toFixed(2))
      : null;

    if (explicitStatus === 'AIR' || (numPh !== null && numPh > 14)) {
      ph_status = 'AIR';
    } else if (explicitStatus === 'UNAVAILABLE' || (numPh === null && explicitStatus !== 'VALID')) {
      ph_status = 'UNAVAILABLE';
    } else if (numPh !== null && numPh >= 0 && numPh <= 14) {
      ph_status = 'VALID';
    } else {
      ph_status = explicitStatus === 'VALID' ? 'VALID' : 'UNAVAILABLE';
    }

    // Prevent AIR or unavailable pH readings from being stored as valid numeric soil pH
    const soil_ph = (ph_status === 'VALID' && numPh !== null && numPh >= 0 && numPh <= 14)
      ? numPh
      : null;

    const soil_moisture = parseBounded(body.soil_moisture ?? body.soil, 0, 100);
    const soil_raw_adc = (body.soil_raw_adc !== undefined && body.soil_raw_adc !== null) ? parseInt(body.soil_raw_adc, 10) : null;
    const soil_temperature = parseBounded(body.soil_temperature ?? body.temp, -55, 125);
    const air_temperature = parseBounded(body.air_temperature ?? body.air_temp, -40, 80);
    const air_humidity = parseBounded(body.air_humidity ?? body.humidity, 0, 100);

    // Light fields: comes from pH module L: field
    const light_source = body.light_source ? String(body.light_source).trim() : 'PH_MODULE_L_RAW';
    const light_unit = body.light_unit ? String(body.light_unit).trim() : 'raw';
    
    // Light intensity: actual received value, no fabricated lux conversion; null preserved when missing
    const rawLight = body.light_intensity !== undefined ? body.light_intensity : body.light;
    const light_intensity = (rawLight !== null && rawLight !== undefined && rawLight !== '' && !isNaN(Number(rawLight)))
      ? Math.max(0, Math.round(Number(rawLight)))
      : null;

    const wifi_rssi = (body.wifi_rssi !== undefined && body.wifi_rssi !== null) ? parseInt(body.wifi_rssi, 10) : null;
    const uptime_ms = (body.uptime_ms !== undefined && body.uptime_ms !== null) ? parseInt(body.uptime_ms, 10) : null;
    
    // Server-side timestamps
    const serverTimestamp = Date.now();
    const serverIso = new Date(serverTimestamp).toISOString();

    const telemetryRecord: HardwareTelemetry = {
      device_id,
      soil_moisture,
      soil_raw_adc,
      soil_ph,
      ph_status,
      soil_temperature,
      air_temperature,
      air_humidity,
      light_intensity,
      light_source,
      light_unit,
      wifi_rssi,
      uptime_ms,
      timestamp: serverTimestamp
    };

    const wasOnline = lastHardwareData !== null && (Date.now() - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);
    lastHardwareData = telemetryRecord;
    lastHardwareTimestamp = serverTimestamp;

    // Trigger device reconnection alert if device was previously offline
    if (!wasOnline) {
      triggerNotification({
        farm_id: 'farm-default',
        category: 'DEVICE_RECONNECT',
        severity: 'INFO',
        title: 'ESP32 Sensor Node Connected',
        message: `Physical node ${device_id} is online and transmitting real-time telemetry.`,
        metadata: { device_id, wifi_rssi }
      }).catch(() => {});
    }

    // 1. Persist hardware device entry
    db.run(
      `INSERT INTO hardware_devices (device_id, name, status, last_seen, wifi_rssi, first_registered)
       VALUES (?, ?, 'online', ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         status = 'online',
         last_seen = excluded.last_seen,
         wifi_rssi = excluded.wifi_rssi`,
      [device_id, `Sensor Node ${device_id}`, serverTimestamp, wifi_rssi, serverTimestamp]
    );

    // 2. Persist in hardware_readings database table
    db.run(
      `INSERT INTO hardware_readings (
        device_id, soil_moisture, soil_raw_adc, soil_ph, ph_status, air_temperature,
        air_humidity, soil_temperature, light_intensity, light_source, light_unit, wifi_rssi, uptime_ms, timestamp, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device_id, soil_moisture, soil_raw_adc, soil_ph, ph_status, air_temperature,
        air_humidity, soil_temperature, light_intensity, light_source, light_unit, wifi_rssi, uptime_ms, serverTimestamp, serverIso
      ]
    );

    // 3. Execute Real-Time AI Hardware Analysis (Hybrid: Real Sensors + Simulated NPK)
    const aiResult = runHardwareAIAnalysis(telemetryRecord, currentMode, {
      nitrogen: simulationState.nitrogen,
      phosphorus: simulationState.phosphorus,
      potassium: simulationState.potassium,
      provenance: 'simulation'
    });
    lastAIAnalysis = aiResult;

    // Persist AI insights
    db.run(
      `INSERT INTO hardware_ai_insights (
        device_id, overall_score, soil_status, water_requirement,
        fungal_disease_risk, photosynthesis_efficiency, insights_json, prescriptions_json, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device_id, aiResult.overall_score, aiResult.soil_status, aiResult.water_requirement,
        aiResult.fungal_disease_risk, aiResult.photosynthesis_efficiency,
        JSON.stringify(aiResult.explainable_insights), JSON.stringify(aiResult.actionable_prescriptions), serverTimestamp
      ]
    );

    // Persist any critical alerts generated by AI and trigger system notifications
    aiResult.alerts.forEach(alert => {
      db.run(
        `INSERT INTO hardware_alerts (device_id, parameter, severity, message, recommendation, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [alert.device_id, alert.parameter, alert.severity, alert.message, alert.recommendation, alert.timestamp]
      );
      if (alert.severity === 'critical' || alert.severity === 'warning') {
        events.unshift({
          zone: 'zone-a',
          severity: alert.severity,
          parameter: alert.parameter,
          message: alert.message,
          timestamp: alert.timestamp
        });

        triggerNotification({
          farm_id: 'farm-default',
          category: alert.parameter === 'ph' ? 'PH_ALERT' : (alert.parameter === 'soil_moisture' ? 'SOIL_MOISTURE' : 'AI_RECOMMENDATION'),
          severity: alert.severity === 'critical' ? 'CRITICAL' : 'WARNING',
          title: `${alert.parameter.toUpperCase()} Alert: ${device_id}`,
          message: alert.message,
          metadata: { recommendation: alert.recommendation }
        }).catch(() => {});
      }
    });

    // 4. Update Zone A state
    syncZoneA();

    logActivity('hardware', `Physical telemetry received from ${device_id}: Moisture=${soil_moisture ?? 'ERR'}%, pH=${ph_status === 'AIR' ? 'AIR' : (soil_ph ?? 'ERR')}, Temp=${soil_temperature ?? 'ERR'}°C, Light=${light_intensity ?? 'ERR'} (${light_unit})`);

    // Broadcast instant update to all WebSocket clients
    broadcastState();

    return res.status(200).json({
      success: true,
      device_id,
      message: 'Telemetry received',
      received_at: serverIso,
      ai_insights_count: aiResult.explainable_insights.length,
      alerts_count: aiResult.alerts.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal processing error: ' + err.message });
  }
});

// GET /api/hardware/status
app.get('/api/hardware/status', (req, res) => {
  res.json(getHardwareStatus());
});

// GET /api/hardware/latest (dual-format compatibility)
app.get('/api/hardware/latest', (req, res) => {
  const status = getHardwareStatus();
  if (!status.data) {
    return res.status(404).json({ error: 'No hardware readings recorded yet' });
  }
  res.json(status.data);
});

// GET /api/hardware/history
app.get('/api/hardware/history', (req, res) => {
  const limit = Math.min(500, parseInt(req.query.limit as string, 10) || 50);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  
  db.all('SELECT * FROM hardware_readings ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: rows.length, limit, offset, readings: rows });
  });
});

// GET /api/hardware/devices
app.get('/api/hardware/devices', (req, res) => {
  db.all('SELECT * FROM hardware_devices ORDER BY last_seen DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Dynamically annotate online state
    const now = Date.now();
    const annotated = rows.map((r: any) => ({
      ...r,
      online: (now - r.last_seen) <= HARDWARE_TIMEOUT_MS
    }));
    res.json(annotated);
  });
});

// GET /api/hardware/ai-insights
app.get('/api/hardware/ai-insights', (req, res) => {
  if (!lastAIAnalysis) {
    return res.json({
      status: 'standby',
      message: 'Awaiting physical ESP32 telemetry packets for real AI inference'
    });
  }
  res.json(lastAIAnalysis);
});

// GET /api/hardware/alerts
app.get('/api/hardware/alerts', (req, res) => {
  db.all('SELECT * FROM hardware_alerts ORDER BY timestamp DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ============================================================================
// CENTRALIZED TWO-MODE TELEMETRY ARCHITECTURE ENDPOINTS
// ============================================================================
// GET /api/telemetry/mode
app.get('/api/telemetry/mode', (req, res) => {
  res.json({
    mode: currentMode,
    npk_available: true,
    npk_provenance: 'simulation',
    description: currentMode === 'LIVE'
      ? 'Hybrid Live Mode: Physical readings for installed sensors (moisture, pH, temp, light) and centralized simulated NPK.'
      : 'Centralized simulation mode: All parameters including NPK use the simulation engine.'
  });
});

// POST /api/telemetry/mode
app.post('/api/telemetry/mode', (req, res) => {
  const { mode } = req.body || {};
  if (mode !== 'LIVE' && mode !== 'SIMULATED') {
    return res.status(400).json({ error: 'Mode must be either LIVE or SIMULATED' });
  }

  currentMode = mode;
  const now = Date.now();
  db.run(
    'INSERT INTO telemetry_mode (id, mode, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at',
    [currentMode, now]
  );

  logActivity('system', `Telemetry mode switched to [${currentMode} MODE]`);
  syncZoneA();
  broadcastState();

  res.json({
    success: true,
    mode: currentMode,
    npk_available: true,
    npk_provenance: 'simulation',
    updated_at: now
  });
});

// ============================================================================
// SIMULATION ENGINE ENDPOINTS
// ============================================================================
// GET /api/simulation/state
app.get('/api/simulation/state', (req, res) => {
  res.json({
    mode: currentMode,
    state: simulationState
  });
});

// POST /api/simulation/control
app.post('/api/simulation/control', (req, res) => {
  const body = req.body || {};

  // Relative keyboard shortcut delta adjustments:
  // Moisture (Q: +1%, A: -1%)
  if (typeof body.deltaMoisture === 'number') {
    simulationState.moisture = Math.max(0, Math.min(100, Number((simulationState.moisture + body.deltaMoisture).toFixed(1))));
  }
  // Soil Temperature (W: +0.5°C, S: -0.5°C)
  if (typeof body.deltaTemp === 'number') {
    simulationState.soil_temperature = Math.max(-10, Math.min(60, Number((simulationState.soil_temperature + body.deltaTemp).toFixed(1))));
  }
  // Soil pH (E: +0.1, D: -0.1)
  if (typeof body.deltaPh === 'number') {
    simulationState.ph = Math.max(3.0, Math.min(11.0, Number((simulationState.ph + body.deltaPh).toFixed(2))));
  }

  // Absolute overrides:
  if (typeof body.moisture === 'number') {
    simulationState.moisture = Math.max(0, Math.min(100, Number(body.moisture.toFixed(1))));
  }
  if (typeof body.ph === 'number') {
    simulationState.ph = Math.max(3.0, Math.min(11.0, Number(body.ph.toFixed(2))));
  }
  if (typeof body.soil_temperature === 'number') {
    simulationState.soil_temperature = Math.max(-10, Math.min(60, Number(body.soil_temperature.toFixed(1))));
  }
  if (typeof body.air_temperature === 'number') {
    simulationState.air_temperature = Math.max(-20, Math.min(60, Number(body.air_temperature.toFixed(1))));
  }
  if (typeof body.air_humidity === 'number') {
    simulationState.air_humidity = Math.max(0, Math.min(100, Number(body.air_humidity.toFixed(1))));
  }
  if (typeof body.light_intensity === 'number') {
    simulationState.light_intensity = Math.max(0, Math.min(65535, Number(body.light_intensity.toFixed(1))));
  }
  if (typeof body.nitrogen === 'number') {
    simulationState.nitrogen = Math.max(0, Math.min(200, Number(body.nitrogen.toFixed(1))));
  }
  if (typeof body.phosphorus === 'number') {
    simulationState.phosphorus = Math.max(0, Math.min(200, Number(body.phosphorus.toFixed(1))));
  }
  if (typeof body.potassium === 'number') {
    simulationState.potassium = Math.max(0, Math.min(200, Number(body.potassium.toFixed(1))));
  }

  simulationState.last_updated = Date.now();

  // Persist into simulation_readings
  db.run(
    `INSERT INTO simulation_readings (moisture, ph, soil_temperature, air_temperature, air_humidity, light_intensity, nitrogen, phosphorus, potassium, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      simulationState.moisture, simulationState.ph, simulationState.soil_temperature,
      simulationState.air_temperature, simulationState.air_humidity, simulationState.light_intensity,
      simulationState.nitrogen, simulationState.phosphorus, simulationState.potassium, simulationState.last_updated
    ]
  );

  syncZoneA();
  broadcastState();

  res.json({
    success: true,
    mode: currentMode,
    simulation: simulationState,
    zoneA: zones.find(z => z.id === 'zone-a')
  });
});

// POST /api/simulation/reset
app.post('/api/simulation/reset', (req, res) => {
  simulationState = { ...DEFAULT_SIMULATION_STATE, last_updated: Date.now() };
  logActivity('system', 'Simulation state reset to baseline.');
  syncZoneA();
  broadcastState();
  res.json({ success: true, simulation: simulationState });
});

app.post('/api/demo/reset', (req, res) => {
  zones = [
    { id: 'zone-a', name: 'Zone A (Physical ESP32 Node)', moisture: null, ph: null, nitrogen: null, phosphorus: null, potassium: null, temperature: null, healthScore: 0, condition: 'Waiting for Telemetry' },
    { id: 'zone-b', name: 'Zone B - South Orchard', moisture: 70.0, ph: 6.7, nitrogen: 75.0, phosphorus: 58.0, potassium: 70.0, temperature: 27.0, healthScore: 88, condition: 'Healthy' },
    { id: 'zone-c', name: 'Zone C - East Greenhouse', moisture: 68.0, ph: 7.0, nitrogen: 60.0, phosphorus: 40.0, potassium: 65.0, temperature: 25.0, healthScore: 85, condition: 'Healthy' }
  ];
  events = [];
  cycleCount = 0;
  activities = [];
  
  db.run('DELETE FROM telemetry');
  db.run('DELETE FROM activity_events');

  syncZoneA();
  logActivity('system', 'Demo scenario reset to baseline');
  broadcastState();
  res.json({ success: true });
});

app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM telemetry ORDER BY timestamp ASC LIMIT 1000', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/farms', (req, res) => {
  db.all('SELECT * FROM farms ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/farms', (req, res) => {
  const { id, name, lat, lon, area, crop } = req.body;
  const farmId = id || `farm-${Date.now()}`;
  db.run('INSERT INTO farms (id, name, lat, lon, area, crop, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [farmId, name, lat, lon, area, crop, Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: farmId });
  });
});

app.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/expenses', (req, res) => {
  const { farm_id, amount, category, note } = req.body;
  const id = `exp-${Date.now()}`;
  db.run('INSERT INTO expenses (id, farm_id, amount, category, note, date) VALUES (?, ?, ?, ?, ?, ?)', 
    [id, farm_id, amount, category, note, Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id });
  });
});

app.delete('/api/expenses/:id', (req, res) => {
  db.run('DELETE FROM expenses WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/weather', async (req, res) => {
  try {
    const lat = req.query.lat || 18.52;
    const lon = req.query.lon || 73.85;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&hourly=temperature_2m,precipitation_probability,rain&daily=uv_index_max,precipitation_probability_max&timezone=auto`);
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

let prevHardwareOnline = false;

// Periodic Simulation Loop (Runs every 3 seconds)
setInterval(() => {
  cycleCount++;
  const timestamp = Date.now();

  const isHwOnlineNow = lastHardwareData !== null && (timestamp - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);
  if (prevHardwareOnline && !isHwOnlineNow) {
    triggerNotification({
      farm_id: 'farm-default',
      category: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      title: 'ESP32 Sensor Node Offline',
      message: `Hardware device ${lastHardwareData?.device_id || 'ESP32-01'} has timed out and stopped transmitting telemetry.`,
      metadata: { timeout_ms: HARDWARE_TIMEOUT_MS }
    }).catch(() => {});
  }
  prevHardwareOnline = isHwOnlineNow;

  // Realistic gradual drift for simulated nutrients (Active in both modes)
  simulationState.nitrate = Number(Math.max(50, Math.min(100, (simulationState.nitrate ?? 71.7) + (Math.random() - 0.5) * 0.08)).toFixed(1));
  simulationState.sodium = Number(Math.max(30, Math.min(70, (simulationState.sodium ?? 45.0) + (Math.random() - 0.5) * 0.05)).toFixed(1));
  simulationState.potassium = Number(Math.max(50, Math.min(100, (simulationState.potassium ?? 70.0) + (Math.random() - 0.5) * 0.08)).toFixed(1));
  simulationState.nitrogen = simulationState.nitrate;
  simulationState.phosphorus = simulationState.sodium;
  simulationState.last_updated = timestamp;

  // Always keep Zone A synchronized strictly according to operating mode (LIVE vs SIMULATED)
  syncZoneA();

  zones.forEach(z => {
    // Only simulate background fluctuations for uninstrumented zones (Zone B & C)
    if (z.id === 'zone-a') {
      // In LIVE mode: Zone A strictly reports real hardware values or nulls if offline.
      // In SIMULATED mode: Zone A is driven by simulationState and keyboard shortcuts.
      return;
    }

    z.temperature = Number(((z.temperature ?? 26.0) + (Math.random() - 0.5) * 0.2).toFixed(1));
    z.ph = Number(((z.ph ?? 6.8) + (Math.random() - 0.5) * 0.02).toFixed(2));

    if (demoModeActive && z.id === 'zone-b') {
      z.moisture = Number(Math.max(40, Math.min(85, (z.moisture ?? 70.0) - 0.2)).toFixed(1));
      z.temperature = Number(((z.temperature ?? 26.0) + 0.05).toFixed(1));
    } else if (demoModeActive && z.id === 'zone-c') {
      z.phosphorus = Number(Math.max(40, Math.min(80, (z.phosphorus ?? 55.0) - 0.1)).toFixed(1));
      z.moisture = Number(((z.moisture ?? 68.0) + (Math.random() - 0.5) * 0.1).toFixed(1));
    } else {
      z.moisture = Number(((z.moisture ?? 65.0) + (Math.random() - 0.5) * 0.1).toFixed(1));
    }

    z.moisture = Math.max(0, Math.min(100, z.moisture ?? 65.0));
    z.ph = Math.max(4.0, Math.min(9.0, z.ph ?? 6.8));
    z.temperature = Math.max(10, Math.min(45, z.temperature ?? 26.0));
    z.phosphorus = Math.max(35.0, Math.min(85.0, z.phosphorus ?? 45.0));
    z.nitrogen = Math.max(45.0, Math.min(110.0, z.nitrogen ?? 71.7));
    z.potassium = Math.max(45.0, Math.min(110.0, z.potassium ?? 70.0));

    const calcHealth = () => {
      let score = 100;
      if (z.moisture !== null && z.moisture < 60) score -= (60 - z.moisture) * 1.5;
      if (z.moisture !== null && z.moisture < 40) score -= 10;
      if (z.ph !== null && (z.ph < 6.0 || z.ph > 7.5)) score -= 5;
      if (z.temperature !== null && z.temperature > 30) score -= (z.temperature - 30) * 1.5;
      if (z.phosphorus !== null && z.phosphorus < 50) score -= (50 - z.phosphorus) * 0.6;
      if (z.nitrogen !== null && z.nitrogen < 50) score -= (50 - z.nitrogen) * 0.6;
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    z.healthScore = calcHealth();
    if (z.healthScore >= 90) z.condition = 'Healthy';
    else if (z.healthScore >= 75) z.condition = 'Moderate Risk';
    else z.condition = 'Critical Risk';

    // Risk Engine Triggers
    if (z.id === 'zone-b' && z.moisture !== null && z.moisture <= 60 && z.moisture > 59.4) {
      logActivity('alert', `Zone B moisture dropped below 60%. Risk of Moisture Stress.`);
      events.unshift({ zone: z.id, severity: 'warning', parameter: 'moisture', message: 'Moisture Stress', timestamp });
    }
    if (z.id === 'zone-c' && z.phosphorus !== null && z.phosphorus <= 45 && z.phosphorus > 44.6) {
      logActivity('alert', `Zone C detected rapid phosphorus depletion.`);
      events.unshift({ zone: z.id, severity: 'warning', parameter: 'phosphorus', message: 'Nutrient Imbalance', timestamp });
    }

    // DB Insert
    db.run('INSERT INTO telemetry (zone, moisture, ph, nitrogen, phosphorus, potassium, temperature, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [z.id, z.moisture, z.ph, z.nitrogen, z.phosphorus, z.potassium, z.temperature, timestamp]
    );
  });

  broadcastState();
}, 3000);

function broadcastState() {
  const payload = JSON.stringify({
    type: 'TELEMETRY_UPDATE',
    payload: {
      mode: currentMode,
      zones,
      events,
      activities,
      hardware: getHardwareStatus(),
      simulation: simulationState,
      timestamp: Date.now()
    }
  });
  clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(payload);
    }
  });
}

function sendFullState(ws: WebSocket) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'TELEMETRY_UPDATE',
      payload: {
        mode: currentMode,
        zones,
        events,
        activities,
        hardware: getHardwareStatus(),
        simulation: simulationState,
        timestamp: Date.now()
      }
    }));
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[TRINEXA-AI] Backend Engine running on http://${HOST}:${PORT}`);
  console.log(`[TRINEXA-AI] Hardware Telemetry Endpoint: POST http://${HOST}:${PORT}/api/hardware/telemetry`);
});
