import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import http from 'http';
import { runHardwareAIAnalysis, HardwareTelemetry, AIAnalysisResult, SensorAlert } from './aiEngine';

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
    air_temperature REAL,
    air_humidity REAL,
    soil_temperature REAL,
    light_intensity REAL,
    wifi_rssi INTEGER,
    uptime_ms INTEGER,
    timestamp INTEGER,
    received_at TEXT
  )`);

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
});

const app = express();
app.use(cors());
app.use(express.json());

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

// Telemetry State
export interface ZoneState {
  id: string;
  name: string;
  moisture: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  healthScore: number;
  condition: string;
}

export interface HardwareStatus {
  online: boolean;
  device_id: string | null;
  last_seen: number | null;
  timeout_ms: number;
  data: (HardwareTelemetry & {
    // Legacy TRINEXA-CORE field mappings for complete backward compatibility
    temp?: number | null;
    humidity?: number | null;
    soil?: number | null;
    ph?: number | null;
    light?: number | null;
  }) | null;
  ai_analysis: AIAnalysisResult | null;
}

let lastHardwareData: HardwareTelemetry | null = null;
let lastHardwareTimestamp = 0;
let lastAIAnalysis: AIAnalysisResult | null = null;

function getHardwareStatus(): HardwareStatus {
  const isOnline = lastHardwareData !== null && (Date.now() - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);
  
  let compatibleData = null;
  if (lastHardwareData) {
    compatibleData = {
      ...lastHardwareData,
      // Compatibility mappings for older TRINEXA-CORE widgets
      temp: lastHardwareData.soil_temperature ?? lastHardwareData.air_temperature,
      humidity: lastHardwareData.air_humidity,
      soil: lastHardwareData.soil_moisture,
      ph: lastHardwareData.soil_ph,
      light: lastHardwareData.light_intensity
    };
  }

  return {
    online: isOnline,
    device_id: lastHardwareData?.device_id || (lastHardwareTimestamp > 0 ? "ESP32-01" : null),
    last_seen: lastHardwareTimestamp > 0 ? lastHardwareTimestamp : null,
    timeout_ms: HARDWARE_TIMEOUT_MS,
    data: compatibleData,
    ai_analysis: lastAIAnalysis
  };
}

let zones: ZoneState[] = [
  { id: 'zone-a', name: 'Zone A (Physical ESP32)', moisture: 72, ph: 6.8, nitrogen: 80, phosphorus: 60, potassium: 75, temperature: 26, healthScore: 92, condition: 'Healthy' },
  { id: 'zone-b', name: 'Zone B', moisture: 70, ph: 6.7, nitrogen: 75, phosphorus: 58, potassium: 70, temperature: 27, healthScore: 88, condition: 'Healthy' },
  { id: 'zone-c', name: 'Zone C', moisture: 68, ph: 7.0, nitrogen: 60, phosphorus: 40, potassium: 65, temperature: 25, healthScore: 85, condition: 'Healthy' }
];

let demoModeActive = true;
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

    const soil_moisture = parseBounded(body.soil_moisture ?? body.soil, 0, 100);
    const soil_raw_adc = (body.soil_raw_adc !== undefined && body.soil_raw_adc !== null) ? parseInt(body.soil_raw_adc, 10) : null;
    const soil_ph = parseBounded(body.soil_ph ?? body.ph, 0, 14);
    const soil_temperature = parseBounded(body.soil_temperature ?? body.temp, -55, 125);
    const air_temperature = parseBounded(body.air_temperature ?? body.air_temp, -40, 80);
    const air_humidity = parseBounded(body.air_humidity ?? body.humidity, 0, 100);
    const light_intensity = parseBounded(body.light_intensity ?? body.light, 0, 65535);
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
      soil_temperature,
      air_temperature,
      air_humidity,
      light_intensity,
      wifi_rssi,
      uptime_ms,
      timestamp: serverTimestamp
    };

    lastHardwareData = telemetryRecord;
    lastHardwareTimestamp = serverTimestamp;

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
        device_id, soil_moisture, soil_raw_adc, soil_ph, air_temperature,
        air_humidity, soil_temperature, light_intensity, wifi_rssi, uptime_ms, timestamp, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device_id, soil_moisture, soil_raw_adc, soil_ph, air_temperature,
        air_humidity, soil_temperature, light_intensity, wifi_rssi, uptime_ms, serverTimestamp, serverIso
      ]
    );

    // 3. Execute Real-Time AI Hardware Analysis
    const aiResult = runHardwareAIAnalysis(telemetryRecord);
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

    // Persist any critical alerts generated by AI
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
      }
    });

    // 4. Directly override Zone A with real physical telemetry
    const zoneA = zones.find(z => z.id === 'zone-a');
    if (zoneA) {
      if (soil_moisture !== null) zoneA.moisture = soil_moisture;
      if (soil_ph !== null) zoneA.ph = soil_ph;
      if (soil_temperature !== null) zoneA.temperature = soil_temperature;
      zoneA.healthScore = aiResult.overall_score;
      zoneA.condition = aiResult.soil_status;
    }

    logActivity('hardware', `Physical telemetry received from ${device_id}: Moisture=${soil_moisture ?? 'ERR'}%, pH=${soil_ph ?? 'ERR'}, Temp=${soil_temperature ?? 'ERR'}°C, Light=${light_intensity ?? 'ERR'} lux`);

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

app.post('/api/demo/reset', (req, res) => {
  zones = [
    { id: 'zone-a', name: 'Zone A (Physical ESP32)', moisture: 72, ph: 6.8, nitrogen: 80, phosphorus: 60, potassium: 75, temperature: 26, healthScore: 92, condition: 'Healthy' },
    { id: 'zone-b', name: 'Zone B', moisture: 70, ph: 6.7, nitrogen: 75, phosphorus: 58, potassium: 70, temperature: 27, healthScore: 88, condition: 'Healthy' },
    { id: 'zone-c', name: 'Zone C', moisture: 68, ph: 7.0, nitrogen: 60, phosphorus: 40, potassium: 65, temperature: 25, healthScore: 85, condition: 'Healthy' }
  ];
  events = [];
  cycleCount = 0;
  activities = [];
  
  db.run('DELETE FROM telemetry');
  db.run('DELETE FROM activity_events');

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

// Periodic Simulation Loop (Runs every 3 seconds)
setInterval(() => {
  cycleCount++;
  const timestamp = Date.now();
  const hardwareOnline = lastHardwareData !== null && (timestamp - lastHardwareTimestamp <= HARDWARE_TIMEOUT_MS);

  zones.forEach(z => {
    // If Zone A is physically bound and ESP32 is online, DO NOT simulate moisture/pH/temp!
    if (z.id === 'zone-a' && hardwareOnline && lastHardwareData) {
      if (lastHardwareData.soil_moisture !== null) z.moisture = lastHardwareData.soil_moisture;
      if (lastHardwareData.soil_ph !== null) z.ph = lastHardwareData.soil_ph;
      if (lastHardwareData.soil_temperature !== null) z.temperature = lastHardwareData.soil_temperature;
    } else {
      // Normal simulation fluctuations for uninstrumented zones (Zone B & C, or fallback Zone A if hardware offline)
      z.temperature += (Math.random() - 0.5) * 0.2;
      z.ph += (Math.random() - 0.5) * 0.02;

      if (demoModeActive && z.id === 'zone-b') {
        z.moisture -= 0.6; 
        z.temperature += 0.15;
      } else if (demoModeActive && z.id === 'zone-c') {
        z.phosphorus -= 0.4;
        z.moisture += (Math.random() - 0.5) * 0.1;
      } else {
        z.moisture += (Math.random() - 0.5) * 0.1;
      }
    }

    z.moisture = Math.max(0, Math.min(100, z.moisture));
    z.ph = Math.max(0, Math.min(14, z.ph));
    z.temperature = Math.max(-10, Math.min(50, z.temperature));

    const calcHealth = () => {
      let score = 100;
      if (z.moisture < 60) score -= (60 - z.moisture) * 1.5;
      if (z.moisture < 40) score -= 10;
      if (z.ph < 6.0 || z.ph > 7.5) score -= 5;
      if (z.temperature > 30) score -= (z.temperature - 30) * 1.5;
      if (z.phosphorus < 50) score -= (50 - z.phosphorus) * 0.6;
      if (z.nitrogen < 50) score -= (50 - z.nitrogen) * 0.6;
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    if (z.id !== 'zone-a' || !hardwareOnline || !lastAIAnalysis) {
      z.healthScore = calcHealth();
      if (z.healthScore >= 90) z.condition = 'Healthy';
      else if (z.healthScore >= 75) z.condition = 'Moderate Risk';
      else z.condition = 'Critical Risk';
    }

    // Risk Engine Triggers
    if (z.id === 'zone-b' && z.moisture <= 60 && z.moisture > 59.4) {
      logActivity('alert', `Zone B moisture dropped below 60%. Risk of Moisture Stress.`);
      events.unshift({ zone: z.id, severity: 'warning', parameter: 'moisture', message: 'Moisture Stress', timestamp });
    }
    if (z.id === 'zone-c' && z.phosphorus <= 45 && z.phosphorus > 44.6) {
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
      zones,
      events,
      activities,
      hardware: getHardwareStatus(),
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
        zones,
        events,
        activities,
        hardware: getHardwareStatus(),
        timestamp: Date.now()
      }
    }));
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[TRINEXA-AI] Backend Engine running on http://${HOST}:${PORT}`);
  console.log(`[TRINEXA-AI] Hardware Telemetry Endpoint: POST http://${HOST}:${PORT}/api/hardware/telemetry`);
});
