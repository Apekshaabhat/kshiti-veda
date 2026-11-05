import { Page, PageHeader } from "@/components/trinexa/Page";
import { Sun, CloudRain, CloudSun, Wind, AlertTriangle, Droplets } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useFarm } from "@/lib/FarmProvider";
import { useEffect, useState } from "react";

const MOCK_WEATHER = {
  current: {
    temperature_2m: 28.4,
    apparent_temperature: 30.1,
    relative_humidity_2m: 65,
    precipitation: 0.0,
    wind_speed_10m: 12.5
  },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => new Date(Date.now() + i * 3600000).toISOString()),
    temperature_2m: [26, 25, 25, 24, 25, 27, 29, 31, 32, 33, 33, 32, 31, 30, 29, 28, 27, 27, 26, 26, 25, 25, 24, 24],
    precipitation_probability: [10, 10, 15, 20, 20, 25, 30, 35, 40, 45, 30, 20, 15, 10, 10, 5, 5, 5, 5, 10, 10, 10, 10, 10]
  },
  daily: {
    uv_index_max: [7.2]
  }
};

export const Weather = () => {
  const { activeFarm } = useFarm();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const lat = activeFarm?.lat || 18.5204;
    const lon = activeFarm?.lon || 73.8567;

    const fetchWeather = async () => {
      // 1. Try local server
      try {
        const res = await fetch(`http://localhost:3001/api/weather?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const d = await res.json();
          if (d && d.current) {
            setData(d);
            return;
          }
        }
      } catch (e) {
        // Continue to public API fallback
      }

      // 2. Direct Open-Meteo call
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=uv_index_max&timezone=auto`;
        const res = await fetch(url);
        if (res.ok) {
          const d = await res.json();
          setData(d);
          return;
        }
      } catch (e) {
        console.log("Direct Open-Meteo call fallback");
      }

      // 3. Mock Weather fallback
      setData(MOCK_WEATHER);
    };

    fetchWeather();
  }, [activeFarm?.id, activeFarm?.lat, activeFarm?.lon]);

  if (!data || !data.current) return <Page><PageHeader tag="05 · Weather" title="Connecting to Satellite..." desc="Fetching hyperlocal data from Open-Meteo" /></Page>;

  const curr = data.current;
  const hourly = data.hourly.time.slice(0, 24).map((t: string, i: number) => ({
    h: new Date(t).toLocaleTimeString([], {hour: '2-digit'}),
    t: data.hourly.temperature_2m[i],
    r: data.hourly.precipitation_probability[i]
  }));
  
  const hasRainRisk = data.hourly.precipitation_probability.slice(0,12).some((p:number) => p > 50);

  return (
    <Page>
      <PageHeader tag="05 · Microclimate" title="Weather Intelligence" desc={`Live forecasting tied to ${activeFarm?.name || 'Farm'} GPS coordinates`}/>
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 premium-glass-strong rounded-3xl p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-3xl bg-[hsl(180,100%,55%)]/10 flex items-center justify-center border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
               {curr.precipitation > 0 ? <CloudRain className="w-12 h-12 text-[hsl(180,100%,55%)] drop-shadow-[0_0_10px_hsl(180,100%,55%/0.6)]" /> : <CloudSun className="w-12 h-12 text-[hsl(45,100%,60%)] drop-shadow-[0_0_10px_hsl(45,100%,60%/0.6)]"/>}
            </div>
            <div>
              <div className="text-6xl font-black">{curr.temperature_2m}°</div>
              <div className="text-muted-foreground font-bold mt-1">feels like {curr.apparent_temperature}°</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mt-2">{activeFarm?.name} · {activeFarm?.lat.toFixed(4)}°N, {activeFarm?.lon.toFixed(4)}°E</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              {i:Wind,l:"Wind Speed",v:`${curr.wind_speed_10m} km/h`, c:"neon-cyan"},
              {i:Droplets,l:"Rain",v:`${curr.precipitation} mm`, c:"neon-cyan"},
              {i:Sun,l:"UV Index",v:`${data.daily?.uv_index_max?.[0] || 'Mod'}`, c:"neon-lime"},
              {i:CloudSun,l:"Humidity",v:`${curr.relative_humidity_2m}%`, c:"neon-lime"}
            ].map(x=>(
              <div key={x.l} className="bg-black/40 rounded-2xl p-4 text-center border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                 <x.i className={`w-5 h-5 text-${x.c} mx-auto mb-2 drop-shadow-md`}/>
                 <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{x.l}</div>
                 <div className="font-black text-sm mt-1">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className={`premium-glass rounded-3xl p-6 md:p-8 flex flex-col justify-center relative overflow-hidden ${hasRainRisk ? 'border-[hsl(45,100%,60%)]/30' : 'border-primary/30'}`}>
          <div className={`absolute top-0 right-0 w-32 h-32 ${hasRainRisk ? 'bg-[hsl(45,100%,60%)]' : 'bg-primary'}/10 rounded-full blur-3xl`} />
          <AlertTriangle className={`w-8 h-8 ${hasRainRisk ? 'text-[hsl(45,100%,60%)]' : 'text-primary'} mb-4`} />
          <h3 className="font-black text-xl mb-2">{hasRainRisk ? 'Rainfall Incoming' : 'Stable Microclimate'}</h3>
          <p className="text-sm font-bold text-muted-foreground leading-relaxed">
            {hasRainRisk 
              ? `High probability (>50%) of precipitation in the next 12 hours. Water Intelligence module has factored this into upcoming irrigation requirements.` 
              : `Forecast is clear for the coming period. Auto-irrigation will rely strictly on telemetry soil moisture depletion levels.`}
          </p>
        </div>
      </div>
      
      <div className="premium-glass rounded-3xl p-6 md:p-8 mb-8">
        <h3 className="text-lg font-black mb-6 tracking-wide text-foreground">Next 24h · Temp (°C) vs Rain Prob (%)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={hourly}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} opacity={0.5}/>
            <XAxis dataKey="h" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} minTickGap={20}/>
            <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={-10}/>
            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dx={10}/>
            <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:16,boxShadow:"var(--shadow-elevated)",fontWeight:'bold', color: 'hsl(var(--foreground))'}}/>
            <Area yAxisId="right" type="monotone" dataKey="r" name="Rain Prob %" stroke="hsl(180, 100%, 55%)" fill="hsl(180, 100%, 55%)" fillOpacity={0.1} strokeWidth={2}/>
            <Area yAxisId="left" type="monotone" dataKey="t" name="Temp °C" stroke="hsl(45, 100%, 60%)" fill="hsl(45, 100%, 60%)" fillOpacity={0.1} strokeWidth={3}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Page>
  );
};
