import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { AppShell } from "@/components/trinexa/AppShell";
import { useTelemetry, ZoneState } from "@/lib/TelemetryProvider";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const Dashboard = () => {
  const { data, connected, hardware } = useTelemetry();

  // Render immediately with telemetry data

  // Calculate Farm Avg Health
  const avgHealth = Math.round(data.zones.reduce((acc, z) => acc + z.healthScore, 0) / data.zones.length);

  // Generate predictive data based on current overall moisture trend (Mocked for visual, but anchored to real base)
  const baseYield = 42;
  const yieldData = Array.from({ length: 7 }, (_, i) => ({
    day: `Day ${i+1}`,
    health: Math.max(0, avgHealth - (i * 0.5)),
    forecast: Math.max(0, avgHealth - (i * 0.3)),
  }));

  // Helper to determine color based on parameter
  const getParamColor = (param: string, value: number) => {
    if (param === 'moisture') return value < 60 ? 'text-red-400' : 'text-primary';
    if (param === 'phosphorus') return value < 50 ? 'text-red-400' : 'text-primary';
    return 'text-primary';
  };

  return (
    <AppShell>
      <div className="space-y-8">
        
        {/* Real-time Status Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
               <span className={`px-3 py-1 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${connected ? 'bg-primary/10 border-primary/30 text-primary shadow-glow' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                 <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-red-500'}`}/>
                 {connected ? 'LIVE TELEMETRY' : 'OFFLINE'}
               </span>
               <span className={`px-3 py-1 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${hardware?.online ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                 <span className={`w-2 h-2 rounded-full ${hardware?.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}/>
                 {hardware?.online ? `ESP32 (${hardware.device_id || 'NODE'}) LINKED` : 'ESP32 AWAITING BEACON'}
               </span>
               <span className="text-xs font-bold text-muted-foreground">Updated precisely {(Date.now() - data.timestamp) < 5000 ? 'just now' : 'a moment ago'}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">Soil Intelligence <span className="text-gradient drop-shadow-lg">Dashboard</span></h1>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-primary text-[hsl(var(--primary-foreground))] font-black shadow-glow hover:bg-primary/90 transition-all tracking-widest uppercase text-xs">Run Deep Analysis</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Soil Health Score */}
          <div className="premium-glass-strong rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden min-h-[400px]">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-[100px] scale-150" />
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground absolute top-8 left-8">Overall Soil Health</h3>
            
            <div className="flex flex-col items-center justify-center flex-1 z-10 mt-6">
              <svg className="w-64 h-64 -rotate-90 relative" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" />
                <motion.circle cx="100" cy="100" r="80" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" fill="none"
                  strokeDasharray="502" initial={{strokeDashoffset:502}} animate={{strokeDashoffset:502*(1-(avgHealth/100))}} transition={{duration:1,ease:"easeOut"}} style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary)/0.5))' }}/>
              </svg>
              <div className="absolute flex flex-col items-center mt-2">
                <div className="text-6xl font-black text-foreground drop-shadow-lg">{avgHealth}</div>
                <div className="text-xs uppercase font-black tracking-widest text-muted-foreground mt-2">/ 100</div>
              </div>
            </div>
            
            <div className="mt-6 z-10 bg-black/40 border border-white/5 rounded-2xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
               <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Analysis Breakdown</div>
               <p className="text-sm font-bold text-foreground">
                  Score is {avgHealth >= 90 ? 'excellent' : avgHealth >= 80 ? 'good' : 'declining'}. <br/>
                  <span className="text-primary mt-1 block">Driven by real-time Zone telemetry (Moisture + NPK weightings).</span>
               </p>
            </div>
          </div>

          {/* Zones Detail */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
             {data.zones.map(z => (
                <div key={z.id} className="premium-glass rounded-3xl p-6 relative overflow-hidden group hover:border-primary/30 transition-colors flex flex-col">
                  {z.healthScore < 80 && <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_red]"/>}
                  {z.healthScore >= 80 && <div className="absolute top-0 left-0 right-0 h-1 bg-primary shadow-glow"/>}
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="font-black text-xl text-foreground tracking-wide">{z.name}</div>
                    <div className="text-2xl font-black text-foreground">{z.healthScore}</div>
                  </div>
                  
                  <div className="flex-1 space-y-4 my-4">
                     <div>
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                          <span>Moisture</span>
                          <span className={getParamColor('moisture', z.moisture)}>{z.moisture.toFixed(1)}%</span>
                       </div>
                       <div className="h-1.5 rounded-full bg-black/50 overflow-hidden"><div className="h-full bg-primary" style={{width: `${z.moisture}%`}}/></div>
                     </div>
                     <div>
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                          <span>Phosphorus</span>
                          <span className={getParamColor('phosphorus', z.phosphorus)}>{z.phosphorus.toFixed(1)} mg/kg</span>
                       </div>
                       <div className="h-1.5 rounded-full bg-black/50 overflow-hidden"><div className="h-full bg-[hsl(45,100%,60%)]" style={{width: `${z.phosphorus}%`}}/></div>
                     </div>
                     <div>
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                          <span>Nitrogen</span>
                          <span className="text-foreground">{z.nitrogen.toFixed(1)} mg/kg</span>
                       </div>
                       <div className="h-1.5 rounded-full bg-black/50 overflow-hidden"><div className="h-full bg-[hsl(180,100%,55%)]" style={{width: `${z.nitrogen}%`}}/></div>
                     </div>
                     <div className="flex items-center gap-4 pt-2">
                       <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 px-2 py-1 rounded border border-white/5 text-muted-foreground">pH {z.ph.toFixed(2)}</span>
                       <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 px-2 py-1 rounded border border-white/5 text-muted-foreground">{z.temperature.toFixed(1)}°C</span>
                     </div>
                  </div>
                  
                  <div className={`mt-auto text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl text-center border ${z.healthScore >= 90 ? 'bg-primary/10 border-primary/20 text-primary' : z.healthScore >= 80 ? 'bg-[hsl(45,100%,60%)]/10 border-[hsl(45,100%,60%)]/20 text-[hsl(45,100%,60%)]' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    Status: {z.condition}
                  </div>
                </div>
             ))}
          </div>
        </div>

        {/* Prediction and Water Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="premium-glass rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center">
                    <Icons.TrendingUp className="w-5 h-5 text-primary" />
                 </div>
                 <h3 className="text-xl font-black text-foreground tracking-wide">7-Day Soil Outlook</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={yieldData}>
                  <defs>
                    <linearGradient id="yg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e673" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00e673" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(215, 15%, 65%)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis domain={[0, 100]} stroke="hsl(215, 15%, 65%)" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="forecast" stroke="#ffcc33" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="health" stroke="#00e673" strokeWidth={4} fill="url(#yg)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
           
           <div className="premium-glass rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <Icons.Droplets className="w-5 h-5 text-[hsl(180,100%,55%)] drop-shadow-[0_0_8px_hsl(180,100%,55%/0.6)]" />
                 </div>
                 <h3 className="text-xl font-black text-foreground tracking-wide">Water Intelligence</h3>
              </div>
              <div className="space-y-4">
                 {data.zones.map(z => {
                   const requirement = z.moisture < 60 ? "HIGH" : z.moisture < 70 ? "MODERATE" : "LOW";
                   const reqColor = requirement === "HIGH" ? "text-red-400" : requirement === "MODERATE" ? "text-[hsl(45,100%,60%)]" : "text-[hsl(180,100%,55%)]";
                   
                   return (
                     <div key={`water-${z.id}`} className="bg-black/30 border border-white/5 rounded-2xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">
                       <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-foreground">{z.name}</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${reqColor}`}>Req: {requirement}</span>
                       </div>
                       <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                          {requirement === 'HIGH' ? `Irrigation required. Moisture dropped to ${z.moisture.toFixed(1)}%.` :
                           requirement === 'MODERATE' ? `Moisture stable at ${z.moisture.toFixed(1)}%. Monitor closely.` :
                           `Optimal moisture at ${z.moisture.toFixed(1)}%. No action needed.`}
                       </p>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>

        {/* Real Activity Engine */}
        <div className="premium-glass rounded-3xl p-6 md:p-8">
           <h3 className="text-xl font-black mb-6 text-foreground tracking-wide">Live Soil Event Log</h3>
           <div className="space-y-4 max-h-[400px] overflow-auto scrollbar-hide pr-2">
              {data.activities.length === 0 && <p className="text-muted-foreground text-sm font-bold">Waiting for telemetry events...</p>}
              {data.activities.map((a, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1 shadow-glow ${a.type === 'alert' || a.type === 'warning' ? 'bg-red-500 border-red-500' : 'bg-primary border-primary'}`} />
                    {i < data.activities.length - 1 && <div className="w-[1.5px] flex-1 bg-white/10 group-hover:bg-primary/50 transition-colors my-2" />}
                  </div>
                  <div className="pb-6 min-w-0 flex-1">
                    <div className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase mb-1">
                      {new Date(a.timestamp).toLocaleTimeString()} · {a.type}
                    </div>
                    <div className="text-sm font-bold text-foreground bg-black/40 p-4 rounded-xl border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                       {a.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>

      </div>
    </AppShell>
  );
};

export default Dashboard;
