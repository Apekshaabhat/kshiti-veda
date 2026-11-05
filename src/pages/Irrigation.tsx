import { Page, PageHeader } from "@/components/trinexa/Page";
import { Droplets, Power, PauseCircle, AlarmClock, ShieldAlert, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Irrigation = () => {
  const data = Array.from({length:7},(_,i)=>({day:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], used: 80+Math.random()*60, saved: 30+Math.random()*40}));
  
  const handleAction = (action: string) => alert(`Cannot execute [${action}]. Physical relay integration is pending.`);

  return (
    <Page>
      <PageHeader tag="04 · Smart Irrigation" title="Irrigation Control Center" desc="Live water flow, automation, and efficiency"
        actions={<>
          <button onClick={()=>handleAction('Pause Auto')} className="px-5 py-3 rounded-xl bg-black/40 border border-white/10 text-foreground text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-colors opacity-50 cursor-not-allowed"><PauseCircle className="w-4 h-4"/>Hardware Required</button>
          <button onClick={()=>handleAction('Emergency Stop')} className="px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/20 transition-colors opacity-50 cursor-not-allowed"><ShieldAlert className="w-4 h-4"/>Ext. Relay Pending</button>
        </>}
      />
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 premium-glass-strong rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
               <h3 className="font-black text-2xl">Zone B · Running</h3>
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Auto-triggered by AI · 12 min remaining</p>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-[hsl(180,100%,55%)]/10 text-[hsl(180,100%,55%)] text-[10px] uppercase font-black tracking-widest border border-[hsl(180,100%,55%)]/20 shadow-[0_0_10px_hsl(180,100%,55%/0.2)]">SIMULATED FLOW</div>
          </div>
          <div className="relative h-48 rounded-2xl bg-black/40 border border-white/5 overflow-hidden shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]">
            <motion.div className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-[hsl(180,100%,55%)]/30 to-transparent" animate={{x:["-100%","300%"]}} transition={{duration:2.5, repeat:Infinity, ease:"easeInOut"}}/>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
               <div className="text-6xl font-black text-foreground drop-shadow-md">14.2</div>
               <div className="text-xs text-[hsl(180,100%,55%)] uppercase tracking-[0.2em] font-bold mt-2">Litres / Minute</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[{l:"Used today",v:"284 L",c:"text-foreground"},{l:"Saved",v:"37%",c:"text-[hsl(180,100%,55%)]"},{l:"Efficiency",v:"96%",c:"text-[hsl(45,100%,60%)]"},{l:"Mode",v:"Auto",c:"text-[hsl(140,100%,60%)]"}].map(x=>(
              <div key={x.l} className="bg-black/30 border border-white/5 rounded-2xl p-4 text-center shadow-[inset_0_1px_5px_rgba(0,0,0,0.3)]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{x.l}</div>
                <div className={`font-black text-xl ${x.c}`}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 flex flex-col justify-center">
          {[{i:Power,t:"Start Motor",c:"[hsl(180,100%,55%)]"},{i:Power,t:"Stop Motor",c:"red-500"},{i:AlarmClock,t:"Schedule",c:"[hsl(45,100%,60%)]"},{i:Zap,t:"Auto Mode",c:"[hsl(140,100%,60%)]"}].map(b=>(
            <button key={b.t} onClick={()=>handleAction(b.t)} className="w-full premium-glass rounded-2xl p-5 flex items-center justify-between group hover:border-primary/40 transition-all opacity-80 cursor-not-allowed">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-${b.c}/10 flex items-center justify-center border border-${b.c}/20 shadow-[inset_0_1px_5px_rgba(0,0,0,0.2)]`}><b.i className={`w-6 h-6 text-${b.c}`}/></div>
                <div className="font-black text-lg text-foreground">{b.t}</div>
              </div>
              <div className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground bg-black/40 px-2 py-1 rounded">Hardware Req.</div>
            </button>
          ))}
        </div>
      </div>
      <div className="premium-glass-strong rounded-3xl p-6 md:p-8">
        <h3 className="font-black text-xl mb-6">Weekly Water · Used vs Saved (Litres)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} opacity={0.5}/>
            <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10}/>
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10}/>
            <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:16, fontWeight:'bold', color: 'white'}} cursor={{fill:'rgba(255,255,255,0.05)'}}/>
            <Bar dataKey="used" fill="hsl(180,100%,55%)" radius={[6,6,0,0]} barSize={24}/>
            <Bar dataKey="saved" fill="hsl(45,100%,60%)" radius={[6,6,0,0]} barSize={24}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Page>
  );
};
