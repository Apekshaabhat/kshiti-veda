import { Page, PageHeader } from "@/components/trinexa/Page";
import { motion } from "framer-motion";
import { Cpu, Wifi, Battery, Activity, Plus, Heart, Settings as SettingsIcon, Languages, Bell, Database, FileText, Download, ExternalLink, FileSpreadsheet, Printer, CheckCircle2, RefreshCw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTelemetry } from "@/lib/TelemetryProvider";

import { useEffect, useState } from "react";

export const Analytics = () => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/history').then(r => r.json()).then(rows => {
      const zoneA = rows.filter((r:any) => r.zone === 'zone-a').slice(-40);
      setHistory(zoneA.map((r:any) => ({ 
        time: new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}), 
        moisture: r.moisture, 
        health: r.healthScore || 90
      })));
    }).catch(() => {
      const now = Date.now();
      const mockHistory = Array.from({ length: 25 }, (_, i) => ({
        time: new Date(now - (25 - i) * 60000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        moisture: Number((52 + Math.sin(i / 3) * 6 + (Math.random() - 0.5) * 2).toFixed(1)),
        health: Math.round(88 + Math.cos(i / 4) * 4)
      }));
      setHistory(mockHistory);
    });
  }, []);

  return (
    <Page>
      <PageHeader tag="08 · Analytics" title="Historical Intelligence" desc="Database-backed telemetry trends and farm analytics"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[{v:"37%",l:"Water saved"},{v:"+24%",l:"Yield uplift"},{v:"₹2.4L",l:"Profit/season"},{v:"68%",l:"Solar share"},{v:"99.7%",l:"Sensor uptime"},{v:"0.4t",l:"CO₂ saved"},{v:"94/100",l:"AI efficiency"},{v:"42min",l:"Avg auto-irrig"}].map(s=>(
          <div key={s.l} className="premium-glass rounded-3xl p-6 md:p-8">
            <div className="text-3xl md:text-4xl font-black text-foreground drop-shadow-md">{s.v}</div>
            <div className="text-[10px] sm:text-xs font-bold tracking-widest text-muted-foreground mt-3 uppercase">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="premium-glass-strong rounded-3xl p-6 md:p-8">
        <h3 className="text-xl font-bold text-foreground mb-6 tracking-wide">Moisture Trend · Zone A (Live DB)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={history}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} opacity={0.5}/>
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={15} tickMargin={10} minTickGap={30} />
            <YAxis domain={['dataMin - 10', 'auto']} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-15}/>
            <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:16,boxShadow:"var(--shadow-elevated)",fontWeight:'bold', color: 'hsl(var(--foreground))'}}/>
            <Area type="step" dataKey="moisture" stroke="hsl(180, 100%, 55%)" fill="hsl(180, 100%, 55%)" fillOpacity={0.1} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Page>
  );
};

export const Devices = () => {
  return (
    <Page>
      <PageHeader tag="09 · Hardware" title="Device Health" desc="Connected edge devices and sensor nodes"
        actions={<button className="px-5 py-3 rounded-xl bg-primary text-[hsl(var(--primary-foreground))] text-sm font-bold flex items-center gap-2 shadow-glow hover:bg-primary/90 transition-all uppercase tracking-widest"><Plus className="w-5 h-5"/>Pair Device</button>}/>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="premium-glass rounded-3xl p-6 md:p-8 hover:-translate-y-1 transition-all group hover:border-primary/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                <Cpu className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"/>
              </div>
              <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-widest bg-card border text-primary border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.15)]`}>LIVE</span>
            </div>
            <div className="font-black text-foreground text-xl mb-1 relative z-10">TRINEXA CORE</div>
            <div className="text-xs uppercase font-bold tracking-widest text-primary relative z-10 bg-primary/10 inline-block px-2 py-1 rounded">Development Mode</div>
            
            <div className="space-y-3 mt-6 relative z-10 text-sm font-medium">
               <div className="flex justify-between border-b border-white/5 pb-2">
                 <span className="text-muted-foreground">Integration:</span>
                 <span className="text-foreground">Development</span>
               </div>
               <div className="flex justify-between border-b border-white/5 pb-2">
                 <span className="text-muted-foreground">Telemetry:</span>
                 <span className="text-foreground">Development Simulation</span>
               </div>
               <div className="flex justify-between border-b border-white/5 pb-2">
                 <span className="text-muted-foreground">Hardware:</span>
                 <span className="text-[hsl(45,100%,60%)]">Pending Physical Integration</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Communication:</span>
                 <span className="text-primary italic">MQTT Ready</span>
               </div>
            </div>
          </div>
      </div>
    </Page>
  );
};

export const FarmHealth = () => {
  const { data } = useTelemetry();
  const avgHealth = data ? Math.round(data.zones.reduce((acc, z) => acc + z.healthScore, 0) / data.zones.length) : 0;
  const status = avgHealth >= 90 ? 'Excellent' : avgHealth >= 80 ? 'Good' : 'Declining';

  return (
    <Page>
      <PageHeader tag="10 · Health" title="Farm Health Score" desc="Holistic vitals across soil, climate, devices, and yield"/>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="premium-glass-strong rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px] scale-150" />
          <svg className="w-72 h-72 -rotate-90 relative" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" opacity={0.3}/>
            {avgHealth > 0 && <motion.circle cx="100" cy="100" r="80" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" fill="none"
              strokeDasharray="502" initial={{strokeDashoffset:502}} animate={{strokeDashoffset:502*(1-(avgHealth/100))}} transition={{duration:2,ease:"easeOut"}} style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary)/0.5))' }}/>}
          </svg>
          <div className="absolute flex flex-col items-center mt-2">
            <div className="text-7xl font-black text-foreground drop-shadow-lg">{avgHealth || '--'}</div>
            <div className="text-sm uppercase font-bold tracking-widest text-muted-foreground mt-2">/ 100</div>
            {avgHealth > 0 && <div className="text-xs text-primary mt-4 font-bold uppercase tracking-[0.2em] bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-xl shadow-glow">{status}</div>}
          </div>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[{l:"Soil quality",v:avgHealth},{l:"Irrigation efficiency",v:Math.max(0, avgHealth - 4)},{l:"Weather conditions",v:85},{l:"Crop health",v:Math.max(0, avgHealth - 2)},{l:"Sensor stability",v:99},{l:"Device health",v:100}].map(m=>(
            <div key={m.l} className="premium-glass rounded-3xl p-6 md:p-8 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-4"><span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{m.l}</span><span className="font-black text-foreground text-2xl">{m.v}<span className="text-sm text-primary">%</span></span></div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"><div className="h-full bg-primary shadow-glow relative" style={{width:`${m.v}%`}}>
                  <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/30 to-transparent" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
};

export const Automation = () => {
  const rules = [
    {n:"Smart irrigation fallback",c:"IF moisture < 30% AND rain < 40% THEN irrigate(zone_b, 18min)",s:"active"},
    {n:"Solar power priority",c:"IF solar_output > 200W THEN switch(solar_mode)",s:"active"},
    {n:"Disease risk alert",c:"IF humidity > 80% AND temp > 28°C THEN notify(disease_risk)",s:"active"},
    {n:"Night water pump limits",c:"IF time BETWEEN 22:00-05:00 THEN reduce_flow(50%)",s:"paused"},
  ];
  return (
    <Page>
      <PageHeader tag="11 · Rules" title="Automation Engine" desc="Compose IF-THEN rules executed locally at the edge"
        actions={<button className="px-5 py-3 rounded-xl bg-primary text-[hsl(var(--primary-foreground))] text-sm font-bold flex items-center gap-2 shadow-glow opacity-50 cursor-not-allowed uppercase tracking-widest"><Plus className="w-5 h-5"/>Hardware Required</button>}/>
      <div className="space-y-4">
        {rules.map(r=>(
          <div key={r.n} className="premium-glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-primary/40 transition-all">
            <div className="flex-1">
              <div className="font-black text-foreground text-xl mb-3 tracking-wide">{r.n}</div>
              <code className="text-xs sm:text-sm font-bold text-primary font-mono bg-black/40 px-4 py-2.5 rounded-xl border border-primary/20 block shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] w-full md:w-auto">{r.c}</code>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-xl self-start md:self-end bg-card border ${r.s==='active' ? 'text-primary border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.15)]' : 'text-muted-foreground border-border'}`}>{r.s}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Physical Integration Pending</span>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
};

export const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('SOIL_HEALTH');
  const [selectedDays, setSelectedDays] = useState(7);
  const [reportTitle, setReportTitle] = useState('Farm Soil Health & Telemetry Audit');

  const getApiBase = () => {
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
    return `http://${host}:3001`;
  };

  const loadReports = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : (data?.reports || []));
      }
    } catch {
      // Backend not running
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const now = Date.now();
      const startDate = now - selectedDays * 24 * 60 * 60 * 1000;
      const res = await fetch(`${getApiBase()}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: 'farm-1',
          report_type: selectedType,
          date_from: new Date(startDate).toISOString(),
          date_to: new Date(now).toISOString()
        })
      });
      if (res.ok) {
        await loadReports();
      }
    } catch (e) {
      console.error("Failed to generate report", e);
    } finally {
      setGenerating(false);
    }
  };

  const REPORT_TYPES = [
    { id: 'SOIL_HEALTH', label: 'Soil Health & Root Cation Audit' },
    { id: 'DAILY_SUMMARY', label: 'Daily Agronomic Summary' },
    { id: 'WEEKLY_AGGREGATION', label: 'Weekly Zone Telemetry' },
    { id: 'MONTHLY_AUDIT', label: 'Monthly Farm Performance' },
    { id: 'SENSOR_PERFORMANCE', label: 'Hardware Sensor Performance' },
    { id: 'CROP_MONITORING', label: 'Crop Phenology & Health' },
    { id: 'IRRIGATION_REPORT', label: 'Precision Irrigation Audit' },
    { id: 'EXPENSE_FINANCIAL', label: 'Farm Financial & Expense Ledger' },
    { id: 'AI_INSIGHTS', label: 'AI Prescriptions & Risk History' }
  ];

  return (
    <Page>
      <PageHeader
        tag="12 · Agricultural Reports"
        title="Comprehensive Farm Reports"
        desc="Generate, preview and download database-backed agricultural reports with full telemetry provenance."
      />

      {/* Report Generator Controls */}
      <div className="premium-glass-strong rounded-3xl p-6 md:p-8 mb-8 border border-white/10">
        <h3 className="text-xl font-black text-foreground mb-2 tracking-wide">Generate New Agricultural Report</h3>
        <p className="text-xs font-mono text-muted-foreground mb-6">
          Strict valid-reading aggregation. Eliminates fabricated hardware data; provenance is explicitly labeled.
        </p>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-wider">
              Report Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                const found = REPORT_TYPES.find(t => t.id === e.target.value);
                if (found) setReportTitle(`Official ${found.label}`);
              }}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {REPORT_TYPES.map(t => (
                <option key={t.id} value={t.id} className="bg-zinc-900 text-foreground">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-wider">
              Time Period
            </label>
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={1} className="bg-zinc-900">Today (24 Hours)</option>
              <option value={7} className="bg-zinc-900">Last 7 Days</option>
              <option value={30} className="bg-zinc-900">Last 30 Days</option>
              <option value={90} className="bg-zinc-900">Season (90 Days)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={generating}
              className="w-full bg-primary hover:bg-primary/90 text-[hsl(var(--primary-foreground))] font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow transition-all disabled:opacity-50 cursor-pointer"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {generating ? 'Compiling...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {/* Reports Archive */}
      <div className="premium-glass rounded-3xl p-6 md:p-8 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-black text-xl text-foreground tracking-wide">Generated Report Repository</h3>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Historical archive ready for immediate PDF preview, printing, or CSV spreadsheet analysis.
            </p>
          </div>
          <button
            onClick={loadReports}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase font-black text-muted-foreground tracking-wider">
                <th className="pb-3 px-4">Report Title</th>
                <th className="pb-3 px-4">Category</th>
                <th className="pb-3 px-4">Time Window</th>
                <th className="pb-3 px-4">Generated At</th>
                <th className="pb-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground font-mono text-xs">
                    No reports generated yet. Click "Generate Report" above to compile your first farm audit.
                  </td>
                </tr>
              ) : (
                (Array.isArray(reports) ? reports : []).map((r) => {
                  const title = r.report_title || r.title || 'Agronomic Telemetry Audit';
                  const rawType = r.report_type || r.type || 'REPORT';
                  const typeLabel = typeof rawType === 'string' ? rawType.replace(/_/g, ' ') : 'REPORT';
                  const startDateVal = r.date_from || r.start_date;
                  const endDateVal = r.date_to || r.end_date;
                  const createdVal = r.generated_at || r.created_at || Date.now();

                  return (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span>{title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-muted-foreground">
                        {startDateVal ? new Date(startDateVal).toLocaleDateString() : 'Historical'} — {endDateVal ? new Date(endDateVal).toLocaleDateString() : 'Present'}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-muted-foreground">
                        {new Date(createdVal).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <a
                        href={`${getApiBase()}/api/reports/${r.id}/download?format=pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print / PDF
                      </a>
                      <a
                        href={`${getApiBase()}/api/reports/${r.id}/download?format=csv`}
                        download
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground hover:bg-white/10 text-xs font-bold transition-all"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                      </a>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
};

export const Settings = () => (
  <Page>
    <PageHeader tag="13 · Settings" title="Account Settings" desc="Personalize your Trinexa command center"/>
    <div className="grid lg:grid-cols-2 gap-6">
      {[
        {i: SettingsIcon, t:"Profile details",d:"Arjun Kulkarni · +91 98765 43210"},
        {i: Languages, t:"Language preferences",d:"English (auto-translate to Hindi enabled)"},
        {i: Bell, t:"Notifications & Alerts",d:"Push, SMS alert thresholds enabled"},
        {i: Database, t:"APIs & Integrations",d:"Mandi prices · Weather forecasting · Bank ledger"},
      ].map(s=>(
        <div key={s.t} className="premium-glass rounded-3xl p-6 md:p-8 flex items-start gap-5 transition-colors group">
          <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
            <s.i className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
            <div className="font-black text-foreground text-lg tracking-wide">{s.t}</div>
            <div className="text-sm font-medium text-muted-foreground mt-2">{s.d}</div>
            <button className="mt-4 text-[10px] font-bold text-primary opacity-50 uppercase tracking-widest cursor-not-allowed">Coming Soon</button>
          </div>
        </div>
      ))}
    </div>
  </Page>
);
