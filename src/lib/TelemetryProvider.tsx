import React, { createContext, useContext, useEffect, useState } from 'react';

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
  soil_temperature: number | null;
  air_temperature: number | null;
  air_humidity: number | null;
  light_intensity: number | null;
  wifi_rssi: number | null;
  uptime_ms?: number | null;
  timestamp: number;
}

export interface HardwareStatus {
  online: boolean;
  device_id: string | null;
  last_seen: number | null;
  data: HardwareTelemetry | null;
}

interface TelemetryData {
  zones: ZoneState[];
  events: RiskEvent[];
  activities: ActivityEvent[];
  hardware?: HardwareStatus;
  timestamp: number;
}

interface TelemetryContextType {
  data: TelemetryData;
  connected: boolean;
  hardware: HardwareStatus;
  resetDemo: () => Promise<void>;
  refreshHardware: () => Promise<void>;
}

const INITIAL_ZONES: ZoneState[] = [
  { id: 'zone-a', name: 'Zone A (Physical ESP32)', moisture: 54.2, ph: 6.8, nitrogen: 72.0, phosphorus: 42.5, potassium: 65.0, temperature: 26.4, healthScore: 78, condition: 'Moisture Warning' },
  { id: 'zone-b', name: 'Zone B - South Orchard', moisture: 68.5, ph: 6.5, nitrogen: 88.0, phosphorus: 54.0, potassium: 70.0, temperature: 25.8, healthScore: 92, condition: 'Optimal' },
  { id: 'zone-c', name: 'Zone C - East Greenhouse', moisture: 74.1, ph: 6.7, nitrogen: 91.5, phosphorus: 58.2, potassium: 75.0, temperature: 24.2, healthScore: 95, condition: 'Optimal' }
];

const INITIAL_ACTIVITIES: ActivityEvent[] = [
  { type: 'irrigation', text: 'Auto-irrigation started in Zone A (15 min scheduled)', timestamp: Date.now() - 120000 },
  { type: 'telemetry', text: 'Telemetry pulse sync: All Zone Nodes and ESP32 interface ready', timestamp: Date.now() - 300000 },
  { type: 'analysis', text: 'AI Digital Twin recalculated crop stress index: 88/100', timestamp: Date.now() - 600000 }
];

const DEFAULT_HARDWARE: HardwareStatus = {
  online: false,
  device_id: null,
  last_seen: null,
  data: null
};

const DEFAULT_DATA: TelemetryData = {
  zones: INITIAL_ZONES,
  events: [],
  activities: INITIAL_ACTIVITIES,
  hardware: DEFAULT_HARDWARE,
  timestamp: Date.now()
};

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<TelemetryData>(DEFAULT_DATA);
  const [hardware, setHardware] = useState<HardwareStatus>(DEFAULT_HARDWARE);
  const [connected, setConnected] = useState(false);

  const fetchHardwareStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/hardware/status');
      if (res.ok) {
        const hw: HardwareStatus = await res.json();
        setHardware(hw);
      }
    } catch {
      // Backend not running yet or unreachable
    }
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;
    let simulationTimer: NodeJS.Timeout;
    let hardwarePollTimer: NodeJS.Timeout;
    let isWsAvailable = false;

    // Simulation for uninstrumented demo zones when WS is not streaming
    const runSimulation = () => {
      setData((prev) => {
        const zones = prev.zones.map((z) => {
          // If Zone A is physically reporting, leave moisture, pH, temp to hardware
          if (z.id === 'zone-a' && hardware.online && hardware.data) {
            return {
              ...z,
              moisture: hardware.data.soil_moisture ?? z.moisture,
              ph: hardware.data.soil_ph ?? z.ph,
              temperature: hardware.data.soil_temperature ?? z.temperature
            };
          }

          const mDelta = (Math.random() - 0.48) * 0.4;
          const moisture = Math.max(30, Math.min(95, z.moisture + mDelta));
          const ph = Math.max(5.5, Math.min(8.0, z.ph + (Math.random() - 0.5) * 0.02));
          const nitrogen = Math.max(40, Math.min(150, z.nitrogen + (Math.random() - 0.5) * 0.3));
          const phosphorus = Math.max(30, Math.min(100, z.phosphorus + (Math.random() - 0.5) * 0.2));
          const potassium = Math.max(40, Math.min(120, z.potassium + (Math.random() - 0.5) * 0.2));
          const temperature = Math.max(18, Math.min(38, z.temperature + (Math.random() - 0.5) * 0.1));

          let healthScore = 95;
          let condition = 'Optimal';

          if (moisture < 60) {
            healthScore -= 15;
            condition = 'Moisture Warning';
          }
          if (phosphorus < 50) {
            healthScore -= 10;
            condition = condition === 'Optimal' ? 'Low Phosphorus' : condition + ' + Low P';
          }

          return {
            ...z,
            moisture: Number(moisture.toFixed(1)),
            ph: Number(ph.toFixed(2)),
            nitrogen: Number(nitrogen.toFixed(1)),
            phosphorus: Number(phosphorus.toFixed(1)),
            potassium: Number(potassium.toFixed(1)),
            temperature: Number(temperature.toFixed(1)),
            healthScore: Math.max(40, healthScore),
            condition
          };
        });

        return {
          ...prev,
          zones,
          timestamp: Date.now()
        };
      });
    };

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:3001/ws');

        ws.onopen = () => {
          setConnected(true);
          isWsAvailable = true;
          fetchHardwareStatus();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TELEMETRY_UPDATE' && msg.payload?.zones) {
              setData(msg.payload);
              if (msg.payload.hardware) {
                setHardware(msg.payload.hardware);
              }
            }
          } catch (e) {
            console.error("Failed to parse telemetry", e);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          isWsAvailable = false;
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

    // Fallback simulation timer for standalone front-end preview
    simulationTimer = setInterval(() => {
      if (!isWsAvailable) {
        runSimulation();
      }
    }, 3000);

    // Periodic hardware status polling (every 4 seconds)
    hardwarePollTimer = setInterval(() => {
      fetchHardwareStatus();
    }, 4000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(simulationTimer);
      clearInterval(hardwarePollTimer);
      if (ws) ws.close();
    };
  }, []);

  const resetDemo = async () => {
    try {
      await fetch('http://localhost:3001/api/demo/reset', { method: 'POST' });
    } catch {
      console.log("Demo reset (client fallback)");
      setData(DEFAULT_DATA);
    }
  };

  const safeData = (data && data.zones && data.zones.length > 0) ? data : DEFAULT_DATA;

  return (
    <TelemetryContext.Provider value={{ data: safeData, connected, hardware, resetDemo, refreshHardware: fetchHardwareStatus }}>
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
