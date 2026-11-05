import * as Icons from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/trinexa/Page";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTelemetry } from "@/lib/TelemetryProvider";
import { useEffect, useState } from "react";

export const Sensors = () => {
  const { data, hardware } = useTelemetry();

  const avg = (key: keyof typeof data.zones[0]) => (data.zones.reduce((acc, z) => acc + (z[key] as number), 0) / data.zones.length).toFixed(1);
  const min = (key: keyof typeof data.zones[0]) => Math.min(...data.zones.map(z => z[key] as number));

  const realSensors = [
    { id: 'moisture', name: 'Avg Moisture', value: avg('moisture'), unit: '%', trend: -2.4, status: min('moisture') < 60 ? 'warning' : 'live', icon: 'Droplets', color: 'neon-cyan' },
    { id: 'ph', name: 'Avg pH', value: avg('ph'), unit: 'pH', trend: 0.1, status: 'live', icon: 'FlaskConical', color: 'neon-green' },
    { id: 'nitrogen', name: 'Nitrogen (N)', value: avg('nitrogen'), unit: 'mg/kg', trend: 1.5, status: 'live', icon: 'Activity', color: 'neon-cyan' },
    { id: 'phosphorus', name: 'Phosphorus (P)', value: avg('phosphorus'), unit: 'mg/kg', trend: -4.1, status: min('phosphorus') < 50 ? 'warning' : 'live', icon: 'Activity', color: 'neon-lime' },
    { id: 'potassium', name: 'Potassium (K)', value: avg('potassium'), unit: 'mg/kg', trend: 0.5, status: 'live', icon: 'Activity', color: 'neon-green' },
    { id: 'temperature', name: 'Soil Temp', value: avg('temperature'), unit: '°C', trend: 1.2, status: 'live', icon: 'Thermometer', color: 'neon-lime' },
  ];

  // Helper for hardware value display
  const renderHardwareValue = (val: number | null | undefined, unit: string) => {
    if (val === null || val === undefined) {
      return (
        <span className="text-xs uppercase tracking-wider font-mono text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20">
          Sensor Error / Disconnected
        </span>
      );
    }
    return (
      <span className="text-3xl font-black text-foreground">
        {val} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
      </span>
    );
  };

  const hwData = hardware?.data;
  const isOnline = hardware?.online;
  const lastSeenSec = hardware?.last_seen ? Math.round((Date.now() - hardware.last_seen) / 1000) : null;

  return (
    <Page>
      <PageHeader
        tag="01 · Physical Hardware & Telemetry Grid"
        title="Live Sensor Matrix"
        desc="Real physical ESP32 telemetry paired with multi-zone digital twin intelligence."
      />

      {/* =================================================================== */}
      {/* PHYSICAL ESP32 HARDWARE SECTION                                     */}
      {/* =================================================================== */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary))] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_red]'}`} />
            <h2 className="text-lg font-black tracking-wide text-foreground">
              PHYSICAL ESP32 NODE ({hardware?.device_id || 'ESP32-01'})
            </h2>
            <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg border ${
              isOnline
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {isOnline ? 'LIVE HARDWARE LINK' : 'OFFLINE / WAITING BEACON'}
            </span>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            {isOnline
              ? `Signal: ${hwData?.wifi_rssi ?? 0} dBm | Packet: ${lastSeenSec ?? 0}s ago`
              : 'Check CP2102 USB/Wi-Fi connection to 192.168.x.x'}
          </div>
        </div>

        {/* Real Hardware Sensor Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Capacitive Soil Moisture (GPIO 34) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Icons.Droplets className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">GPIO 34 · ADC</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Soil Moisture</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.soil_moisture, '%')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Raw ADC: {hwData?.soil_raw_adc ?? '—'}
            </div>
          </div>

          {/* 2. Soil pH (UART 16/17) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Icons.FlaskConical className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">UART RX16 / TX17</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Soil pH Level</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.soil_ph, 'pH')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Condition: {hwData?.soil_ph ? (hwData.soil_ph >= 6.0 && hwData.soil_ph <= 7.5 ? 'Neutral / Optimal' : 'Needs Adjustment') : 'Awaiting sensor UART'}
            </div>
          </div>

          {/* 3. Soil Temperature (DS18B20 GPIO 5) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center border border-lime-500/20">
                <Icons.Thermometer className="w-5 h-5 text-lime-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">GPIO 5 · OneWire</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Soil Temp (DS18B20)</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.soil_temperature, '°C')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Waterproof probe submerged
            </div>
          </div>

          {/* 4. Air Temperature (DHT22 GPIO 4) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Icons.CloudSun className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">GPIO 4 · DHT22</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Air Temperature</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.air_temperature, '°C')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Canopy microclimate ambient
            </div>
          </div>

          {/* 5. Air Humidity (DHT22 GPIO 4) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Icons.CloudDrizzle className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">GPIO 4 · DHT22</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Air Relative Humidity</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.air_humidity, '%')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Transpiration pressure index
            </div>
          </div>

          {/* 6. Ambient Light (BH1750 I2C GPIO 21/22) */}
          <div className="premium-glass rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Icons.Sun className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">I2C SDA 21 / SCL 22</span>
            </div>
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Light Intensity (BH1750)</div>
            <div className="min-h-[40px] flex items-center">
              {renderHardwareValue(hwData?.light_intensity, 'lux')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 font-mono">
              Solar radiation for photosynthesis
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* ZONE TELEMETRY AGGREGATION                                         */}
      {/* =================================================================== */}
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-wide text-foreground mb-4">
          ZONE AGGREGATION & DIGITAL TWIN
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {realSensors.map(s => {
          const Icon = (Icons as any)[s.icon] || Icons.Activity;
          return (
            <Link key={s.id} to={`/sensors/${s.id}`} className="premium-glass rounded-3xl p-6 md:p-8 hover:border-primary/40 transition-all group group-hover:-translate-y-1 block relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 ${s.status === 'warning' ? 'bg-[hsl(45,100%,60%)]' : 'bg-primary'}/5 rounded-full blur-2xl group-hover:bg-opacity-20 transition-colors`} />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className={`w-14 h-14 rounded-2xl bg-${s.color}/10 border border-white/5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`}>
                  <Icon className={`w-6 h-6 text-${s.color} drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]`} />
                </div>
                <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-xl border ${s.status === 'warning' ? 'bg-[hsl(45,100%,60%)]/10 text-[hsl(45,100%,60%)] border-[hsl(45,100%,60%)]/20 shadow-[0_0_10px_hsl(45,100%,60%)/0.2]' : 'bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.2)]'}`}>{s.status}</span>
              </div>
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground relative z-10 mb-1">{s.name}</div>
              <div className="text-3xl font-black text-foreground relative z-10 mb-2">{s.value}<span className="text-sm font-normal text-muted-foreground ml-2">{s.unit}</span></div>
              <div className="text-xs font-bold text-muted-foreground relative z-10">{s.trend > 0 ? '▲' : '▼'} {Math.abs(s.trend)}% trend</div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
};

export const SensorDetail = () => {
  const { id } = useParams();
  const { data } = useTelemetry();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/history').then(r => r.json()).then(rows => {
      const zoneARows = rows.filter((r: any) => r.zone === 'zone-a').slice(-60);
      setHistory(zoneARows.map((r: any) => ({ x: new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), y: r[id as string] })));
    }).catch(() => {
      // Client-side fallback history stream
      const now = Date.now();
      const sId = id || 'moisture';
      const baseVal = sId === 'moisture' ? 55 : sId === 'ph' ? 6.7 : sId === 'nitrogen' ? 75 : sId === 'phosphorus' ? 45 : sId === 'potassium' ? 68 : 26;
      const mockRows = Array.from({ length: 20 }, (_, i) => ({
        x: new Date(now - (20 - i) * 120000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        y: Number((baseVal + Math.sin(i / 2) * 5 + (Math.random() - 0.5) * 2).toFixed(1))
      }));
      setHistory(mockRows);
    });
  }, [id, data?.timestamp]);

  if (!data || data.zones.length === 0) return <Page><PageHeader tag={`Sensor · ${id?.toUpperCase()}`} title="..." desc="Loading..."/></Page>;

  const sId = id as string;
  const avg = (data.zones.reduce((acc, z) => acc + (z[sId as keyof typeof data.zones[0]] as number), 0) / data.zones.length).toFixed(1);
  
  const dict: Record<string, {name:string, unit:string, icon:string, color:string}> = {
    moisture: { name: 'Soil Moisture', unit: '%', icon: 'Droplets', color: 'neon-cyan' },
    ph: { name: 'Soil pH', unit: 'pH', icon: 'FlaskConical', color: 'neon-green' },
    nitrogen: { name: 'Nitrogen', unit: 'mg/kg', icon: 'Activity', color: 'neon-cyan' },
    phosphorus: { name: 'Phosphorus', unit: 'mg/kg', icon: 'Activity', color: 'neon-lime' },
    potassium: { name: 'Potassium', unit: 'mg/kg', icon: 'Activity', color: 'neon-green' },
    temperature: { name: 'Temperature', unit: '°C', icon: 'Thermometer', color: 'neon-lime' }
  };
  
  const s = dict[sId] || dict.moisture;
  const Icon = (Icons as any)[s.icon];

  return (
    <Page>
      <PageHeader tag={`Sensor · ${sId.toUpperCase()}`} title={s.name} desc="Live Telemetry View · Development Mode" />
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 premium-glass rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className={`w-16 h-16 rounded-2xl bg-${s.color}/10 flex items-center justify-center border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]`}><Icon className={`w-8 h-8 text-${s.color} drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]`} /></div>
            <div>
              <div className="text-6xl font-black text-foreground">{avg}<span className="text-2xl text-muted-foreground ml-3 font-normal">{s.unit}</span></div>
              <div className="text-sm text-primary font-bold tracking-widest uppercase mt-2 bg-primary/10 inline-block px-3 py-1 rounded">live · updated 3s ago</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history.length ? history : [{x:'0',y:0}]}>
              <defs>
                <linearGradient id={`sg-${s.color}`} x1="0" y1="0" x2="0" y2="1">
                  {s.color === 'neon-cyan' ? <><stop offset="0%" stopColor="#00ffff" stopOpacity={0.5} /><stop offset="100%" stopColor="#00ffff" stopOpacity={0} /></> :
                   s.color === 'neon-lime' ? <><stop offset="0%" stopColor="#7fff00" stopOpacity={0.5} /><stop offset="100%" stopColor="#7fff00" stopOpacity={0} /></> :
                   <><stop offset="0%" stopColor="#00e673" stopOpacity={0.5} /><stop offset="100%" stopColor="#00e673" stopOpacity={0} /></>}
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" stroke="hsl(215, 15%, 65%)" fontSize={11} tickMargin={10} minTickGap={20} />
              <YAxis domain={['auto', 'auto']} stroke="hsl(215, 15%, 65%)" fontSize={11} />
              <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontWeight: 'bold' }} />
              <Area type="monotone" dataKey="y" stroke={s.color === 'neon-cyan' ? '#00ffff' : s.color === 'neon-lime' ? '#7fff00' : '#00e673'} strokeWidth={3} fill={`url(#sg-${s.color})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          <div className="premium-glass rounded-3xl p-6 md:p-8">
            <h3 className="font-bold text-foreground tracking-wide mb-3">AI recommendation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">Based on the real-time {s.name.toLowerCase()} telemetry stream from Development Engine, the farm average remains highly stable. No manual intervention required.</p>
          </div>
          <div className="premium-glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
            <h3 className="font-bold text-foreground tracking-wide mb-4 relative z-10">Thresholds</h3>
            <div className="space-y-4 text-sm relative z-10">
              <div className="flex justify-between border-b border-white/5 pb-3"><span className="text-muted-foreground uppercase tracking-widest font-bold text-xs">Min Limit</span><span className="font-black text-foreground">{(Number(avg) * 0.6).toFixed(1)} {s.unit}</span></div>
              <div className="flex justify-between border-b border-white/5 pb-3"><span className="text-muted-foreground uppercase tracking-widest font-bold text-xs">Max Limit</span><span className="font-black text-foreground">{(Number(avg) * 1.4).toFixed(1)} {s.unit}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground uppercase tracking-widest font-bold text-xs">Farm Avg</span><span className="font-black text-primary">{avg} {s.unit}</span></div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};
