import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import { Page, PageHeader } from "@/components/trinexa/Page";
import { useTelemetry } from "@/lib/TelemetryProvider";

export const CropAI = () => {
  const { data, hardware } = useTelemetry();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleScan = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setIsScanning(true);
    setScanResult(null);

    let file: File | null = null;
    if (e && e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl("https://images.unsplash.com/photo-1592982537447-6f296cb1357b?auto=format&fit=crop&q=80");
    }

    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:8000/analyze/crop-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Analysis failed");

        const apiData = await response.json();

        // Map the python response to our UI format
        setScanResult({
          disease:   { status: "Detected",  name: apiData.predictions.disease.label,   confidence: Math.round(apiData.predictions.disease.confidence * 100),   color: "secondary" },
          nutrients: { status: "Analyzed",  name: apiData.predictions.nutrient.label,  confidence: Math.round(apiData.predictions.nutrient.confidence * 100),  color: "primary" },
          pests:     { status: "Analyzed",  name: apiData.predictions.pest.label,      confidence: Math.round(apiData.predictions.pest.confidence * 100),      color: "primary" },
          stress:    { status: "Analyzed",  name: apiData.predictions.stress.label,    confidence: Math.round(apiData.predictions.stress.confidence * 100),    color: "accent" },
        });
      } else {
        // Fallback mock if no file API access
        await new Promise(resolve => setTimeout(resolve, 3500));
        setScanResult({
          disease:   { status: "Detected",  name: "Early Blight",    confidence: 94, color: "secondary" },
          nutrients: { status: "Deficient", name: "Nitrogen",        confidence: 88, color: "primary" },
          pests:     { status: "Clear",     name: "None detected",   confidence: 99, color: "primary" },
          stress:    { status: "Warning",   name: "Water Stress",    confidence: 72, color: "accent" },
        });
      }

      console.log("[CropAI] Multi-spectral AI scan completed");
    } catch (error) {
      console.error("[CropAI] Scan error:", error);
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Page>
      <PageHeader tag="03 · Multi-spectral AI" title="Crop Diagnostic Engine" desc="Identify pathogens, nutrient deficiencies, and cellular stress in seconds." />

      <div className="grid lg:grid-cols-2 gap-6 mt-6 pb-12">
        {/* Left Column: Scanner Interface */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-3xl p-4 md:p-6 relative overflow-hidden shadow-sm group">
            {/* Scanner Area */}
            <div className="relative aspect-square md:aspect-video bg-muted/40 rounded-2xl border border-border overflow-hidden flex items-center justify-center">
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 pointer-events-none"
                  >
                    <motion.div
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                      className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_hsl(var(--primary))]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 border-2 border-primary/20 rounded-full animate-ping" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isScanning && !scanResult && (
                <div className="text-center p-6 z-10 relative">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4 border border-border transition-transform group-hover:scale-110">
                    <Icons.Camera className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">Initialize AI Diagnostic</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto font-medium">
                    Upload crop imagery or connect a live field feed.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-sm font-bold transition">
                      Upload Imagery
                    </button>
                    <button onClick={() => handleScan()} className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md transition hover:bg-primary/90 active:scale-95">
                      Analyze Live
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScan} />
                </div>
              )}

              {scanResult && !isScanning && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-10">
                  <img src={previewUrl || "https://images.unsplash.com/photo-1592982537447-6f296cb1357b?auto=format&fit=crop&q=80"} alt="Scanned crop" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />

                  {/* Targeting Reticle */}
                  <div className="absolute top-[30%] left-[40%] w-12 h-12 border-2 border-secondary/50 flex items-center justify-center rounded-lg backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                    <div className="absolute -top-8 -right-24 bg-white border border-secondary/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase text-secondary shadow-sm">Target Isolated</div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-border shadow-lg">
                      <div className="text-[10px] font-bold text-primary mb-0.5 tracking-widest uppercase">DIAGNOSIS READY</div>
                      <div className="font-bold text-foreground text-base">Crop Matrix #402</div>
                    </div>
                    <button onClick={() => setScanResult(null)} className="p-3 rounded-2xl bg-white border border-border shadow-lg hover:text-primary transition-colors">
                      <Icons.RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results & Actions */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {!scanResult && !isScanning ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full min-h-[250px] md:min-h-[300px] bg-white border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center p-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                  <Icons.Activity className="w-8 h-8 text-muted-foreground opacity-40" />
                </div>
                <h3 className="font-bold text-muted-foreground">Ready for analysis</h3>
                <p className="text-sm text-muted-foreground/60 mt-1 max-w-[200px] font-medium">Please provide a source to begin the multi-spectral diagnostic.</p>
              </motion.div>
            ) : isScanning ? (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full min-h-[250px] md:min-h-[300px] bg-white border border-border rounded-3xl p-8 flex flex-col justify-center space-y-8 shadow-sm"
              >
                {[
                  { l: "ISOLATING SPECTRAL BANDS",    p: 85, c: "bg-primary" },
                  { l: "CROSS-REFERENCING PATHOGENS", p: 42, c: "bg-secondary" },
                  { l: "ANALYZING CELLULAR STRESS",   p: 12, c: "bg-accent" },
                ].map((s, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground tracking-widest">
                      <span>{s.l}</span>
                      <span className="font-mono">{s.p}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${s.p}%` }} transition={{ duration: 2, delay: i * 0.4 }}
                        className={`h-full ${s.c}`}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(scanResult).map(([key, data]: [string, any], i) => {
                    const colorMap: any = {
                      primary:   "text-primary border-primary/20 bg-primary/5",
                      secondary: "text-secondary border-secondary/20 bg-secondary/5",
                      accent:    "text-accent border-accent/20 bg-accent/5",
                    };
                    const theme = colorMap[data.color] || colorMap.primary;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        key={key} className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{key}</div>
                        <div className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-3 ${theme}`}>
                          {data.status.toUpperCase()}
                        </div>
                        <div className="text-lg font-bold mb-1 truncate text-foreground">{data.name}</div>
                        <div className="flex justify-between items-center text-[11px] font-medium">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className="font-bold text-foreground">{data.confidence}%</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* AI Prescription */}
                <div className="bg-white border border-border rounded-3xl p-6 shadow-md border-l-8 border-l-secondary">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                        <Icons.Brain className="w-5 h-5 text-secondary" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground">AI Prescription</h3>
                    </div>
                    {hardware?.online && hardware.data && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Physical Sensors Correlated
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    {hardware?.online && hardware.data?.soil_moisture !== null && hardware.data?.soil_moisture !== undefined && (
                      <div className="flex gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border/50 items-center">
                        <Icons.Droplets className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <p className="text-muted-foreground font-medium">
                          Live Soil Moisture <span className="font-bold text-foreground font-mono">{hardware.data.soil_moisture}%</span>: {hardware.data.soil_moisture < 50 ? 'Stress confirmed. Trigger irrigation cycle.' : 'Moisture is adequate.'}
                        </p>
                      </div>
                    )}

                    {hardware?.online && hardware.data?.ph_status === 'AIR' && (
                      <div className="flex gap-3 text-xs bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 items-center">
                        <Icons.FlaskConical className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <p className="text-muted-foreground font-medium">
                          Live Soil pH: <span className="font-bold text-amber-400 font-mono">AIR</span> (Sensor exposed to air · No soil contact)
                        </p>
                      </div>
                    )}

                    {hardware?.online && hardware.data?.ph_status !== 'AIR' && hardware.data?.soil_ph !== null && hardware.data?.soil_ph !== undefined && (
                      <div className="flex gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border/50 items-center">
                        <Icons.FlaskConical className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <p className="text-muted-foreground font-medium">
                          Live Soil pH <span className="font-bold text-foreground font-mono">{hardware.data.soil_ph}</span>: {hardware.data.soil_ph < 6.0 ? 'Acidic soil. Recommend agricultural lime.' : hardware.data.soil_ph > 7.5 ? 'Alkaline soil. Recommend sulfur.' : 'Within optimal absorption range.'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-4 text-sm bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <Icons.AlertCircle className="w-5 h-5 text-secondary flex-shrink-0" />
                      <p className="text-muted-foreground font-medium">Apply <span className="font-bold text-secondary">Chlorothalonil</span> fungicide at 2.5pt/acre immediately to halt pathogen spread.</p>
                    </div>
                    <div className="flex gap-4 text-sm bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <Icons.Zap className="w-5 h-5 text-accent flex-shrink-0" />
                      <p className="text-muted-foreground font-medium">Adjust <span className="font-bold text-accent">fertigation</span> to maintain nutrient balance for crop cycle.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button className="flex-1 px-4 py-3.5 rounded-2xl bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 transition flex items-center justify-center gap-2">
                      <Icons.ShoppingCart className="w-4 h-4" /> Order Treatment
                    </button>
                    <button className="flex-1 px-4 py-3.5 rounded-2xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition flex items-center justify-center gap-2">
                      <Icons.Settings2 className="w-4 h-4" /> Config Systems
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  );
};

