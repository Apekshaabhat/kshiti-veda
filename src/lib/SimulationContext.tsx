/**
 * SimulationContext.tsx
 * 
 * A lightweight simulation context used by CropAI and other pages
 * that prefer a simple activity-log API over the full TelemetryProvider.
 * Internally delegates to TelemetryProvider when available.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTelemetry } from './TelemetryProvider';

export interface ActivityEntry {
  time: string;
  type: string;
  text: string;
}

export interface SensorEntry {
  id: string;
  name: string;
  value: number | string;
  unit: string;
  status: string;
  icon: string;
  trend: number;
  color: string;
}

interface SimulationContextType {
  sensors: SensorEntry[];
  activities: ActivityEntry[];
  logActivity: (entry: ActivityEntry) => void;
  updateSensor: (id: string, patch: Partial<SensorEntry>) => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pull live zone data from TelemetryProvider if available
  let telemetry: ReturnType<typeof useTelemetry> | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    telemetry = useTelemetry();
  } catch {
    telemetry = undefined;
  }

  const buildSensors = useCallback((): SensorEntry[] => {
    const hw = telemetry?.hardware?.data;
    if (telemetry?.data?.zones?.length) {
      const zones = telemetry.data.zones;
      const avg = (key: keyof typeof zones[0]) =>
        Number((zones.reduce((acc, z) => acc + (z[key] as number), 0) / zones.length).toFixed(1));
      const min = (key: keyof typeof zones[0]) =>
        Math.min(...zones.map(z => z[key] as number));

      // Prefer real physical sensor readings if available
      const moistureVal = hw?.soil_moisture !== null && hw?.soil_moisture !== undefined ? hw.soil_moisture : avg('moisture');
      const phVal = hw?.soil_ph !== null && hw?.soil_ph !== undefined ? hw.soil_ph : avg('ph');
      const tempVal = hw?.soil_temperature !== null && hw?.soil_temperature !== undefined ? hw.soil_temperature : avg('temperature');

      return [
        { id: 'moisture',    name: hw?.soil_moisture != null ? 'Live Soil Moisture (ESP32)' : 'Avg Moisture',    value: moistureVal,    unit: '%',     trend: -2.4, status: min('moisture') < 60 ? 'warning' : 'live', icon: 'Droplets',     color: 'primary' },
        { id: 'ph',          name: hw?.soil_ph != null ? 'Live Soil pH (ESP32)' : 'Avg pH',                      value: phVal,          unit: 'pH',    trend: 0.1,  status: 'live',                                      icon: 'FlaskConical', color: 'secondary' },
        { id: 'nitrogen',    name: 'Nitrogen (N)',      value: avg('nitrogen'),    unit: 'mg/kg', trend: 1.5,  status: 'live',                                      icon: 'Activity',     color: 'primary' },
        { id: 'phosphorus',  name: 'Phosphorus (P)',    value: avg('phosphorus'),  unit: 'mg/kg', trend: -4.1, status: min('phosphorus') < 50 ? 'warning' : 'live', icon: 'Activity',     color: 'accent' },
        { id: 'potassium',   name: 'Potassium (K)',     value: avg('potassium'),   unit: 'mg/kg', trend: 0.5,  status: 'live',                                      icon: 'Activity',     color: 'secondary' },
        { id: 'temperature', name: hw?.soil_temperature != null ? 'Live Soil Temp (ESP32)' : 'Soil Temp',       value: tempVal,        unit: '°C',    trend: 1.2,  status: 'live',                                      icon: 'Thermometer',  color: 'accent' },
      ];
    }
    // Static fallback
    return [
      { id: 'soil',  name: 'Soil Moisture', value: 42,     unit: '%',    trend: 2.4,  status: 'optimal', icon: 'Droplets',     color: 'primary' },
      { id: 'temp',  name: 'Temperature',   value: 28.6,   unit: '°C',   trend: -0.8, status: 'optimal', icon: 'Thermometer',  color: 'accent' },
      { id: 'ph',    name: 'Soil pH',       value: 6.8,    unit: 'pH',   trend: 0.1,  status: 'optimal', icon: 'FlaskConical', color: 'secondary' },
    ];
  }, [telemetry]);

  const [sensors, setSensors] = useState<SensorEntry[]>(buildSensors);

  React.useEffect(() => {
    setSensors(buildSensors());
  }, [buildSensors]);

  const [activities, setActivities] = useState<ActivityEntry[]>([
    { time: '2 min ago', type: 'system', text: 'Trinexa AI Engine initialized successfully' },
  ]);

  const logActivity = useCallback((entry: ActivityEntry) => {
    setActivities(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const updateSensor = useCallback((id: string, patch: Partial<SensorEntry>) => {
    setSensors(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  return (
    <SimulationContext.Provider value={{ sensors, activities, logActivity, updateSensor }}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
};

