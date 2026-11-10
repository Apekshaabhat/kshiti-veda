import { useState, useEffect } from "react";
import { Page, PageHeader } from "@/components/trinexa/Page";
import { useFarm } from "@/lib/FarmProvider";
import { useTelemetry } from "@/lib/TelemetryProvider";
import { motion } from "framer-motion";
import { Trees, Sprout, Droplets, FlaskConical, Thermometer, Wind, AlertCircle, TrendingUp, CheckCircle2, ShieldAlert } from "lucide-react";

// Crop Database representing expert knowledge for the simulation
const CROP_DB = {
  tomato: { name: "Tomato", yield: "25 t/acre", ph: [6.0, 6.8], n: [60, 90], p: [40, 60], k: [50, 80], temp: [20, 28], waterFactor: 1.2 },
  wheat: { name: "Wheat", yield: "15 q/acre", ph: [6.0, 7.5], n: [80, 120], p: [30, 50], k: [40, 60], temp: [15, 25], waterFactor: 0.8 },
  sugarcane: { name: "Sugarcane", yield: "40 t/acre", ph: [6.0, 8.0], n: [120, 150], p: [50, 70], k: [80, 120], temp: [25, 35], waterFactor: 1.5 },
  basmati: { name: "Basmati Rice", yield: "30 q/acre", ph: [5.5, 6.5], n: [100, 130], p: [40, 60], k: [60, 80], temp: [25, 35], waterFactor: 2.0 },
};

export const VirtualFarm = () => {
  const { activeFarm } = useFarm();
  const { data: telemetry } = useTelemetry();
  
  const [cropId, setCropId] = useState<keyof typeof CROP_DB>('basmati');
  const [weather, setWeather] = useState<any>(null);
  
  // What-If Simulation State
  const [simMode, setSimMode] = useState(false);
  const [simModifiers, setSimModifiers] = useState({
    moistureOffset: 0,
    phosphorusOffset: 0,
    nitrogenOffset: 0
  });

  const currentFarm = activeFarm || { id: 'farm-1', name: 'Green Valley Estate', lat: 18.5204, lon: 73.8567, area: 14.2, crop: 'Rice + Wheat' };
  const currentTelemetry = telemetry || {
    zones: [
      { id: 'zone-a', name: 'Zone A - North Field', moisture: 54.2, ph: 6.8, nitrogen: 72.0, phosphorus: 42.5, potassium: 65.0, temperature: 26.4, healthScore: 78, condition: 'Moisture Warning' },
      { id: 'zone-b', name: 'Zone B - South Orchard', moisture: 68.5, ph: 6.5, nitrogen: 88.0, phosphorus: 54.0, potassium: 70.0, temperature: 25.8, healthScore: 92, condition: 'Optimal' },
      { id: 'zone-c', name: 'Zone C - East Greenhouse', moisture: 74.1, ph: 6.7, nitrogen: 91.5, phosphorus: 58.2, potassium: 75.0, temperature: 24.2, healthScore: 95, condition: 'Optimal' }
    ]
  };

  useEffect(() => {
    if (currentFarm?.lat && currentFarm?.lon) {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      fetch(`http://${host}:3001/api/weather?lat=${currentFarm.lat}&lon=${currentFarm.lon}`)
        .then(r => r.json())
        .then(d => setWeather(d))
        .catch(() => {}); // silent fail for dummy demo if needed
    }
  }, [currentFarm?.lat, currentFarm?.lon]);

  const crop = CROP_DB[cropId] || CROP_DB.basmati;
  
  // Real State Aggregation with null safety
  const validAvg = (key: keyof typeof currentTelemetry.zones[0], fallback: number) => {
    const list = currentTelemetry.zones.filter(z => z[key] !== null && z[key] !== undefined);
    if (!list.length) return fallback;
    return list.reduce((acc, z) => acc + (z[key] as number), 0) / list.length;
  };

  const realMoisture = validAvg('moisture', 55.0);
  const realPh = validAvg('ph', 6.8);
  const realN = validAvg('nitrogen', 75.0);
  const realP = validAvg('phosphorus', 45.0);
  const realK = validAvg('potassium', 65.0);
  const realTemp = validAvg('temperature', 26.0);

  // Simulator Engine
  const envMoisture = simMode ? Math.max(0, Math.min(100, realMoisture + simModifiers.moistureOffset)) : realMoisture;
  const envP = simMode ? Math.max(0, Math.min(150, realP + simModifiers.phosphorusOffset)) : realP;
  const envN = simMode ? Math.max(0, Math.min(200, realN + simModifiers.nitrogenOffset)) : realN;
  const envK = realK;
  const envPh = realPh;
  const envTemp = weather?.current?.temperature_2m || realTemp;

  // Analysis Logic
  const analysis = [];
  let score = 100;
  
  // Moisture check
  if (envMoisture < 40) { score -= 20; analysis.push({ p: 'Moisture', s: 'Critical', text: `Severe water stress expected (${envMoisture.toFixed(1)}%)` }); }
  else if (envMoisture < 60) { score -= 10; analysis.push({ p: 'Moisture', s: 'Warning', text: `Moderate moisture deficit. Irrigation required.` }); }
  else { analysis.push({ p: 'Moisture', s: 'Good', text: `Moisture within healthy ranges.` }); }

  // NPK Checks against Crop DB
  if (envN < crop.n[0]) { score -= 15; analysis.push({ p: 'Nitrogen', s: 'Warning', text: `Deficient (-${(crop.n[0] - envN).toFixed(1)} mg/kg). Yield impact likely.` }); }
  else { analysis.push({ p: 'Nitrogen', s: 'Good', text: `Adequate for vegetative growth.` }); }

  if (envP < crop.p[0]) { score -= 15; analysis.push({ p: 'Phosphorus', s: 'Warning', text: `Deficient (-${(crop.p[0] - envP).toFixed(1)} mg/kg). Root development at risk.` }); }
  else { analysis.push({ p: 'Phosphorus', s: 'Good', text: `Optimal levels for fruiting.` }); }

  if (envTemp > crop.temp[1]) { score -= 10; analysis.push({ p: 'Temperature', s: 'Warning', text: `Heat stress possible (Current: ${envTemp.toFixed(1)}°C).` }); }
  
  if (envPh < crop.ph[0] || envPh > crop.ph[1]) { score -= 10; analysis.push({ p: 'pH', s: 'Warning', text: `pH (${envPh.toFixed(1)}) is marginal for ${crop.name}.` }); }

  const waterReq = crop.waterFactor * (60 - envMoisture) * (currentFarm.area || 10);
  const isDrought = envMoisture < 45;

  return (
    <Page>
      <PageHeader tag="TRINEXA · AI SOIL DIGITAL TWIN" title="Virtual Farm" desc="Active semantic simulation mapped to real physical telemetry" />
      
      {/* Simulation Master Controls */}
      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
        <div className="premium-glass rounded-3xl p-6 md:p-8 flex-1 w-full relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Trees className="w-48 h-48" /></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
             <div className="w-12 h-12 bg-primary/20 text-primary flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                <Sprout className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Digital Twin Sandbox</h2>
                <h1 className="text-2xl font-black text-foreground">{currentFarm.name}</h1>
             </div>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4 relative z-10">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 block">Prospective Crop Simulator</label>
              <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] cursor-pointer"
                value={cropId} onChange={e => setCropId(e.target.value as keyof typeof CROP_DB)}>
                {Object.entries(CROP_DB).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button onClick={() => setSimMode(!simMode)} className={`w-full py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all border ${simMode ? 'bg-primary/20 text-primary border-primary/50 shadow-glow' : 'bg-black/40 text-muted-foreground border-white/10 hover:border-white/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]'}`}>
                {simMode ? 'Disable What-If Modifiers' : 'Enable What-If Simulation'}
              </button>
            </div>
          </div>
        </div>

        {/* Core Environment Status */}
        <div className="premium-glass rounded-3xl p-6 w-full md:w-80">
           <h3 className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-4">Base Telemetry Context</h3>
           <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold flex items-center gap-2"><Wind className="w-4 h-4"/> GPS Area</span>
                <span className="text-foreground font-black">{currentFarm.area} Acres</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-bold flex items-center gap-2"><Thermometer className="w-4 h-4"/> Microclimate</span>
                <span className="text-foreground font-black">{weather?.current?.temperature_2m !== undefined ? `${weather.current.temperature_2m}°C` : `${realTemp.toFixed(1)}°C`}</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Visual Map (2.5D schematic of Zones) */}
        <div className="lg:col-span-2 premium-glass-strong rounded-3xl p-6 md:p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xl text-foreground">Spatial Intelligence View</h3>
            {simMode && <span className="bg-[hsl(45,100%,60%)]/20 text-[hsl(45,100%,60%)] text-[10px] px-3 py-1 uppercase tracking-widest font-black border border-[hsl(45,100%,60%)]/30 rounded-xl animate-pulse">Simulation Sandbox Active</span>}
          </div>
          
          <div className="flex-1 min-h-[400px] rounded-3xl bg-black/80 border border-white/5 shadow-[inset_0_2px_30px_rgba(0,0,0,1)] p-8 flex items-center justify-center relative overflow-hidden">
             
             {/* 3D Isometric Plane */}
             <div className="relative w-full max-w-[500px] aspect-square transition-all duration-700"
                  style={{ transform: "rotateX(60deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}>
               
               {/* Base Grid / Land Contour */}
               <div className="absolute inset-0 grid grid-cols-2 gap-6" style={{ transformStyle: "preserve-3d" }}>
                 {currentTelemetry.zones.map((z, index) => {
                   const m = simMode ? Math.max(0, Math.min(100, z.moisture + simModifiers.moistureOffset)) : z.moisture;
                   const nLvl = simMode ? Math.max(0, Math.min(200, z.nitrogen + simModifiers.nitrogenOffset)) : z.nitrogen;
                   const pLvl = simMode ? Math.max(0, Math.min(150, z.phosphorus + simModifiers.phosphorusOffset)) : z.phosphorus;
                   
                   const isMoistureDrought = m < 45;
                   const isMoistureFlood = m > 85;
                   const isNutrientDeficient = nLvl < crop.n[0] || pLvl < crop.p[0];
                   
                   const groundColor = isMoistureDrought ? 'bg-[#7a6435]' : isMoistureFlood ? 'bg-[#2a454d]' : isNutrientDeficient ? 'bg-[#6b6748]' : 'bg-[#3b5235]';
                   const dirtColor = isMoistureDrought ? 'bg-[#4a3618]' : 'bg-[#2b1f13]';
                   const borderColor = isMoistureDrought ? 'border-red-500/50' : 'border-[#91c53b]/30';
                   const plantColor = isMoistureDrought ? 'bg-[hsl(40,80%,40%)]' : isNutrientDeficient ? 'bg-[hsl(60,80%,50%)]' : 'bg-[#7fff00]';

                   // Determine Growth Size (Scale based on simulated optimal conditions)
                   const growthScale = score / 100;
                   const plantHeight = Math.max(10, 50 * growthScale);
                   
                   // Dynamic Z offset for terraforming
                   const terrainElevation = index % 3 === 0 ? 30 : index % 2 === 0 ? 15 : 0;

                   return (
                     <div key={z.id} className="relative w-full h-full group"
                          style={{
                            transformStyle: "preserve-3d",
                            transform: `translateZ(${terrainElevation}px)`
                          }}>
                       
                       {/* 3D Extruded Soil Dirt Layers */}
                       {Array.from({length: 12}).map((_, i) => (
                          <div key={i} className={`absolute inset-0 ${dirtColor} border border-black/50`} 
                               style={{ transform: `translateZ(-${(i + 1) * 2}px)` }} />
                       ))}

                       {/* Top Face (Ground) */}
                       <div className={`absolute inset-0 border-2 ${borderColor} ${groundColor} shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] overflow-hidden transition-colors duration-1000`}
                            style={{ transformStyle: "preserve-3d", transform: "translateZ(0px)" }}>
                           
                           {/* Topographic Lines Overlay */}
                           <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" style={{ backgroundSize: '15px 15px', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)' }} />

                           {/* Irrigation Pipeline (Drip lines) */}
                           <div className={`absolute top-0 bottom-0 left-1/4 w-1 flex justify-center ${m < 50 ? 'bg-black/50' : 'bg-blue-500/40 shadow-[0_0_15px_blue]'} transition-colors`}/>
                           <div className={`absolute top-0 bottom-0 right-1/4 w-1 flex justify-center ${m < 50 ? 'bg-black/50' : 'bg-blue-500/40 shadow-[0_0_15px_blue]'} transition-colors`}/>

                           {/* Soil Moisture Decal */}
                           <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${isMoistureDrought?'red':isMoistureFlood?'blue':'transparent'} 0%, transparent 70%)`}} />
                       </div>

                       {/* Hover Info Panel (Stands up in 3D) */}
                       <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none" 
                            style={{ transform: "translateZ(40px) rotateZ(45deg) rotateX(-60deg)", transformOrigin: 'center center' }}>
                           <div className="bg-black/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-xl text-center shadow-2xl">
                             <span className="text-white font-black uppercase tracking-widest text-[10px] block border-b border-white/10 pb-1 mb-1">{z.name}</span>
                             <span className="text-[10px] text-primary">H2O: {m.toFixed(1)}%</span>
                           </div>
                       </div>

                       {/* 3D Rows of Crops */}
                       <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 inset-1 gap-2" style={{ transformStyle: "preserve-3d", transform: "translateZ(0px)" }}>
                          {Array.from({length: 16}).map((_, i) => (
                             <div key={i} className="relative flex items-end justify-center" style={{ transformStyle: "preserve-3d" }}>
                                <motion.div 
                                  className={`w-1.5 shadow-[0_0_10px_rgba(0,0,0,0.8)] rounded-full ${plantColor}`}
                                  initial={{ height: 0 }}
                                  animate={{ height: `${plantHeight}px` }}
                                  transition={{ duration: 1.5, delay: i * 0.05 }}
                                  style={{
                                    transform: `translateZ(1px) rotateZ(45deg) rotateX(-60deg) translateY(-${plantHeight/2}px)`,
                                    transformOrigin: "bottom center"
                                  }}
                                />
                             </div>
                          ))}
                       </div>

                       {/* Sensor Node Blip (Floating slightly above ground) */}
                       <div className="absolute bottom-4 right-4 w-5 h-5 bg-black/90 border-2 border-white/20 rounded-full flex items-center justify-center shadow-2xl z-20 pointer-events-none" 
                            style={{ transform: "translateZ(10px) rotateZ(45deg) rotateX(-60deg)", transformStyle: "preserve-3d" }}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isMoistureDrought || isNutrientDeficient ? 'bg-red-500 shadow-[0_0_15px_red]' : 'bg-primary shadow-glow'} animate-ping`} />
                       </div>
                     </div>
                   );
                 })}
               </div>
               
               {/* Decorational Sun/Weather Overlay matching microclimate */}
               {weather?.current?.temperature_2m !== undefined && weather.current.temperature_2m > 30 && (
                 <div className="absolute -top-32 -left-32 w-64 h-64 bg-yellow-500/15 rounded-full blur-[80px] pointer-events-none z-50 mix-blend-screen" 
                      style={{ transform: "translateZ(100px) rotateZ(45deg) rotateX(-60deg)" }} />
               )}

             </div>
             
             {/* Key / Legend Overlay */}
             <div className="absolute bottom-4 left-4 bg-black/60 border border-white/5 backdrop-blur-md p-3 rounded-2xl flex flex-col gap-2 pointer-events-none z-50">
               <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground border-b border-white/5 pb-1 mb-1">Digital Twin Legend</span>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-primary"></div><span className="text-[10px] font-bold text-foreground flex-1">Optimal Health</span></div>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[hsl(60,80%,50%)]"></div><span className="text-[10px] font-bold text-foreground">Nutrient Strain</span></div>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[hsl(40,80%,40%)]"></div><span className="text-[10px] font-bold text-foreground">Moisture Warning</span></div>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full border border-white/30 bg-black flex items-center justify-center"><div className="w-0.5 h-0.5 rounded-full bg-primary animate-ping"></div></div><span className="text-[10px] font-bold text-foreground">Sensor Point</span></div>
               <div className="flex items-center gap-2"><div className="w-2 h-0.5 rounded bg-blue-500/50"></div><span className="text-[10px] font-bold text-foreground">Sub-surface Irrigation</span></div>
             </div>
          </div>
        </div>

        {/* Engine Breakdown */}
        <div className="space-y-6 flex flex-col">
          <div className="premium-glass rounded-3xl p-6 md:p-8 flex-1 relative overflow-hidden">
            <h3 className="font-black text-xl text-foreground mb-4 relative z-10">Intelligence Matrix</h3>
            
            <div className="absolute top-0 right-0 -mr-10 -mt-10">
               <div className="w-32 h-32 rounded-full border-4 border-primary/20 flex items-center justify-center bg-black/40">
                 <div className={`text-4xl font-black ${score > 75 ? 'text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]' : 'text-[hsl(45,100%,60%)]'}`}>{Math.max(0, score)}</div>
               </div>
            </div>

            <div className="space-y-4 mt-8 relative z-10 pr-2 max-h-[300px] overflow-y-auto scrollbar-hide">
              {analysis.map((a, i) => (
                <div key={i} className="bg-black/40 rounded-xl p-4 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-2 mb-1">
                    {a.s === 'Warning' || a.s === 'Critical' ? <ShieldAlert className={`w-4 h-4 ${a.s === 'Critical' ? 'text-red-500' : 'text-[hsl(45,100%,60%)]'}`} /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{a.p}</span>
                  </div>
                  <div className="text-sm font-bold text-foreground">{a.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action / Predictive Layer */}
      <div className="grid md:grid-cols-2 gap-6">
         {/* What-If Controllers */}
         {simMode && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} className="premium-glass border border-[hsl(45,100%,60%)]/30 rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <FlaskConical className="w-6 h-6 text-[hsl(45,100%,60%)]" />
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Experimental Modifiers</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-muted-foreground mb-3">
                  <span>Simulate Irrigation (Moisture Δ)</span>
                  <span className={simModifiers.moistureOffset > 0 ? 'text-primary' : ''}>{simModifiers.moistureOffset > 0 ? '+' : ''}{simModifiers.moistureOffset}%</span>
                </div>
                <input type="range" min="-30" max="30" value={simModifiers.moistureOffset} onChange={e => setSimModifiers({...simModifiers, moistureOffset: Number(e.target.value)})} className="w-full accent-[hsl(45,100%,60%)]" />
              </div>
              
              <div>
                <div className="flex justify-between text-xs font-bold text-muted-foreground mb-3">
                  <span>Simulate Fertilization (P Δ)</span>
                  <span className={simModifiers.phosphorusOffset > 0 ? 'text-primary' : ''}>{simModifiers.phosphorusOffset > 0 ? '+' : ''}{simModifiers.phosphorusOffset} mg/kg</span>
                </div>
                <input type="range" min="-30" max="50" value={simModifiers.phosphorusOffset} onChange={e => setSimModifiers({...simModifiers, phosphorusOffset: Number(e.target.value)})} className="w-full accent-[hsl(45,100%,60%)]" />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-muted-foreground mb-3">
                  <span>Simulate Fertilization (N Δ)</span>
                  <span className={simModifiers.nitrogenOffset > 0 ? 'text-primary' : ''}>{simModifiers.nitrogenOffset > 0 ? '+' : ''}{simModifiers.nitrogenOffset} mg/kg</span>
                </div>
                <input type="range" min="-30" max="50" value={simModifiers.nitrogenOffset} onChange={e => setSimModifiers({...simModifiers, nitrogenOffset: Number(e.target.value)})} className="w-full accent-[hsl(45,100%,60%)]" />
              </div>
            </div>
          </motion.div>
         )}

         {/* TRINEXA Management Plan */}
         <div className={`premium-glass rounded-3xl p-6 md:p-8 ${simMode ? '' : 'md:col-span-2'}`}>
            <h3 className="text-xl font-black text-foreground mb-4">TRINEXA Management Plan</h3>
            <div className="grid sm:grid-cols-2 gap-4">
               <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                 <h4 className="text-[10px] uppercase font-black text-primary tracking-widest mb-3">Pre-Planting / Current Phase</h4>
                 <ul className="space-y-2 text-sm font-bold text-muted-foreground">
                   {envMoisture < 60 && <li className="flex gap-2"><span>•</span>Initiate drip line flushing to correct {60 - Math.round(envMoisture)}% moisture deficit.</li>}
                   {envP < crop.p[0] && <li className="flex gap-2"><span>•</span>Apply basal dose of {`DAP/SSP to correct ${Math.round(crop.p[0]-envP)} mg/kg gap`}.</li>}
                   {envTemp > crop.temp[1] && <li className="flex gap-2"><span>•</span>Delay seed broadcasting until soil temps drop below {crop.temp[1]}°C.</li>}
                   {score > 80 && <li className="flex gap-2"><span>•</span>Soil conditioning optimal. Ready for operational commencement.</li>}
                 </ul>
               </div>

               <div className="bg-black/40 border border-white/5 rounded-2xl p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                 <h4 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-3">Growth Projections</h4>
                 <div className="flex justify-between items-center mb-4">
                   <div className="text-xs font-bold text-foreground">Estimated Yield Potential</div>
                   <div className="text-lg font-black text-[hsl(180,100%,55%)]">{score < 60 ? 'Compromised' : crop.yield}</div>
                 </div>
                 {waterReq > 0 && <div className="text-xs text-[hsl(45,100%,60%)] font-bold mt-2 bg-[hsl(45,100%,60%)]/10 px-3 py-2 rounded-lg">
                   ~{Math.round(waterReq).toLocaleString()} Litres scheduled irrigation needed to clear stress.
                 </div>}
               </div>
            </div>
         </div>
      </div>
      
    </Page>
  );
};
