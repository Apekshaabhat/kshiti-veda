import React, { createContext, useContext, useEffect, useState } from 'react';

export type TelemetryMode = 'LIVE' | 'SIMULATED';

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

export interface ActivityEvent {
  type: string;
  text: string;
  timestamp: number;
}

export interface RiskEvent {
  zone: string;
  severity: string;
  parameter: string;
  message: string;
  timestamp: number;
}

export interface HardwareTelemetry {
  device_id: string;
  soil_moisture: number | null;
  soil_raw_adc?: number | null;
  soil_ph: number | null;
  ph_status?: 'VALID' | 'AIR' | 'UNAVAILABLE';
  soil_temperature: number | null;
  air_temperature: number | null;
  air_humidity: number | null;
  light_intensity: number | null;
  light_source?: string;
  light_unit?: string;
  wifi_rssi: number | null;
  uptime_ms?: number | null;
  timestamp: number;
}

export interface HardwareStatus {
  mode: TelemetryMode;
  npk_available: boolean;
  npk_provenance: 'simulation';
  online: boolean;
  device_id: string | null;
  last_seen: number | null;
  data: (HardwareTelemetry & {
    temp?: number | null;
    humidity?: number | null;
    soil?: number | null;
    ph?: number | null;
    ph_status?: 'VALID' | 'AIR' | 'UNAVAILABLE';
    light?: number | null;
    light_source?: string;
    light_unit?: string;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    npk_provenance?: 'simulation';
  }) | null;
}

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

interface TelemetryData {
  mode?: TelemetryMode;
  zones: ZoneState[];
  events: RiskEvent[];
  activities: ActivityEvent[];
  hardware?: HardwareStatus;
  simulation?: SimulationState;
  timestamp: number;
}

interface TelemetryContextType {
  data: TelemetryData;
  connected: boolean;
  hardware: HardwareStatus;
  mode: TelemetryMode;
  simulation: SimulationState;
  setMode: (mode: TelemetryMode) => Promise<void>;
  controlSimulation: (control: {
    deltaMoisture?: number;
    deltaTemp?: number;
    deltaPh?: number;
    moisture?: number;
    soil_temperature?: number;
    ph?: number;
  }) => Promise<void>;
  resetDemo: () => Promise<void>;
  refreshHardware: () => Promise<void>;
}

const INITIAL_ZONES: ZoneState[] = [
  { id: 'zone-a', name: 'Zone A (Physical ESP32 Node)', moisture: null, ph: null, nitrate: 52.4, sodium: 26.8, potassium: 74.2, nitrogen: 52.4, phosphorus: 26.8, temperature: null, healthScore: 0, condition: 'Waiting for Telemetry' },
  { id: 'zone-b', name: 'Zone B - South Orchard', moisture: 68.5, ph: 6.5, nitrate: 56.0, sodium: 24.5, potassium: 70.0, nitrogen: 56.0, phosphorus: 24.5, temperature: 25.8, healthScore: 92, condition: 'Optimal' },
  { id: 'zone-c', name: 'Zone C - East Greenhouse', moisture: 74.1, ph: 6.7, nitrate: 58.2, sodium: 22.0, potassium: 75.0, nitrogen: 58.2, phosphorus: 22.0, temperature: 24.2, healthScore: 95, condition: 'Optimal' }
];

const INITIAL_ACTIVITIES: ActivityEvent[] = [
  { type: 'telemetry', text: 'Telemetry architecture initialized in LIVE HYBRID mode. Physical sensors & simulated nutrients ready.', timestamp: Date.now() - 60000 },
  { type: 'system', text: 'ESP32 ingestion active. Nitrate, Sodium & Potassium sourced from centralized demonstration baseline.', timestamp: Date.now() - 30000 }
];

const DEFAULT_HARDWARE: HardwareStatus = {
  mode: 'LIVE',
  npk_available: true,
  npk_provenance: 'simulation',
  online: false,
  device_id: null,
  last_seen: null,
  data: null
};

const DEFAULT_SIMULATION: SimulationState = {
  moisture: 58.5,
  ph: 6.8,
  soil_temperature: 24.5,
  air_temperature: 27.2,
  air_humidity: 65.0,
  light_intensity: 450.0,
  nitrate: 52.4,
  sodium: 26.8,
  potassium: 74.2,
  nitrogen: 52.4,
  phosphorus: 26.8,
  last_updated: Date.now()
};

const DEFAULT_DATA: TelemetryData = {
  mode: 'LIVE',
  zones: INITIAL_ZONES,
  events: [],
  activities: INITIAL_ACTIVITIES,
  hardware: DEFAULT_HARDWARE,
  simulation: DEFAULT_SIMULATION,
  timestamp: Date.now()
};

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

const getBackendHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};
const getApiBase = () => `http://${getBackendHost()}:3001`;
const getWsUrl = () => `${(typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:'}//${getBackendHost()}:3001/ws`;

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<TelemetryData>(DEFAULT_DATA);
  const [hardware, setHardware] = useState<HardwareStatus>(DEFAULT_HARDWARE);
  const [mode, setModeState] = useState<TelemetryMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trinexa_telemetry_mode');
      if (saved === 'LIVE' || saved === 'SIMULATED') return saved;
    }
    return 'LIVE';
  });
  const [simulation, setSimulation] = useState<SimulationState>(DEFAULT_SIMULATION);
  const [connected, setConnected] = useState(false);

  const fetchHardwareStatus = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/hardware/status`);
      if (res.ok) {
        const hw: HardwareStatus = await res.json();
        setHardware(hw);
        if (hw.mode && !localStorage.getItem('trinexa_telemetry_mode')) {
          setModeState(hw.mode);
        }
      }
    } catch {
      // Backend not running yet or unreachable
    }
  };

  const fetchMode = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/telemetry/mode`);
      if (res.ok) {
        const json = await res.json();
        if (json.mode && !localStorage.getItem('trinexa_telemetry_mode')) {
          setModeState(json.mode);
        }
      }
    } catch {
      // Backend unreachable
    }
  };

  const setMode = async (newMode: TelemetryMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trinexa_telemetry_mode', newMode);
    }
    try {
      const res = await fetch(`${getApiBase()}/api/telemetry/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        const json = await res.json();
        setModeState(json.mode);
        fetchHardwareStatus();
      }
    } catch (e) {
      console.warn("Failed to update telemetry mode on backend:", e);
    }
  };

  const controlSimulation = async (control: {
    deltaMoisture?: number;
    deltaTemp?: number;
    deltaPh?: number;
    moisture?: number;
    soil_temperature?: number;
    ph?: number;
  }) => {
    try {
      const res = await fetch(`${getApiBase()}/api/simulation/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(control)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.simulation) setSimulation(json.simulation);
      }
    } catch (e) {
      console.warn("Failed to dispatch simulation control:", e);
    }
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;
    let hardwarePollTimer: NodeJS.Timeout;

    fetchHardwareStatus();
    fetchMode();

    const connect = () => {
      try {
        ws = new WebSocket(getWsUrl());

        ws.onopen = () => {
          setConnected(true);
          fetchHardwareStatus();
          fetchMode();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TELEMETRY_UPDATE' && msg.payload?.zones) {
              setData(msg.payload);
              if (msg.payload.mode) setModeState(msg.payload.mode);
              if (msg.payload.hardware) setHardware(msg.payload.hardware);
              if (msg.payload.simulation) setSimulation(msg.payload.simulation);
            }
          } catch (e) {
            console.error("Failed to parse telemetry message", e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (e) {
        setConnected(false);
      }
    };

    connect();

    // Periodic hardware status & mode sync (every 3 seconds)
    hardwarePollTimer = setInterval(() => {
      fetchHardwareStatus();
    }, 3000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(hardwarePollTimer);
      if (ws) ws.close();
    };
  }, []);

  const resetDemo = async () => {
    try {
      await fetch(`${getApiBase()}/api/demo/reset`, { method: 'POST' });
    } catch {
      console.log("Demo reset (client fallback)");
      setData(DEFAULT_DATA);
    }
  };

  const safeData = (data && data.zones && data.zones.length > 0) ? data : DEFAULT_DATA;

  return (
    <TelemetryContext.Provider value={{
      data: safeData,
      connected,
      hardware,
      mode,
      simulation,
      setMode,
      controlSimulation,
      resetDemo,
      refreshHardware: fetchHardwareStatus
    }}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
