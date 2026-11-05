import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Phone, UserCircle, MapPin, Droplets, Sprout, Building, Loader2 } from "lucide-react";
import { useState } from "react";
import { useFarm } from "@/lib/FarmProvider";

export const Auth = () => {
  const navigate = useNavigate();
  return (
  <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
    <div className="absolute inset-0 bg-gradient-hero mix-blend-screen" />
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="relative w-full max-w-md premium-glass-strong rounded-3xl p-8 md:p-10 z-10">
      <div className="flex justify-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-[hsl(var(--primary-foreground))] text-3xl font-black shadow-glow border border-primary/50">
          T
        </div>
      </div>
      <h1 className="text-3xl font-black text-center text-foreground mb-2 tracking-tight">Welcome Back</h1>
      <p className="text-sm font-medium text-muted-foreground text-center mb-10 tracking-wide">Enter your command center</p>
      
      <div className="space-y-5">
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground drop-shadow-md" />
          <input placeholder="Mobile Number" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-black/60 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-muted-foreground/50"/>
        </div>
        <div className="relative">
          <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground drop-shadow-md" />
          <input type="password" placeholder="Password" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-black/60 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-muted-foreground/50"/>
        </div>
        
        <button onClick={() => navigate('/dashboard')} className="w-full mt-4 py-4 rounded-2xl bg-primary text-[hsl(var(--primary-foreground))] font-black shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity uppercase tracking-widest text-sm border border-primary/50">
          Sign In <ArrowRight className="w-5 h-5" />
        </button>
        <button className="w-full py-4 rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 text-foreground font-bold hover:bg-card/80 transition-colors uppercase tracking-widest text-xs">
          Login with OTP
        </button>
      </div>
      
      <div className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mt-10">
        New to Trinexa? <br/><Link to="/onboarding" className="text-primary hover:text-primary/80 transition-colors mt-2 inline-block">Connect your farm →</Link>
      </div>
    </motion.div>
  </div>
  );
};

export const Onboarding = () => {
  const navigate = useNavigate();
  const { refreshFarms, setActiveFarmId } = useFarm();
  const [form, setForm] = useState({ name: '', area: '', crop: '', lat: 18.5204, lon: 73.8567 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.area) return;
    setLoading(true);
    try {
      const r = await fetch('http://localhost:3001/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (data.success) {
        await refreshFarms();
        setActiveFarmId(data.id);
        navigate('/dashboard');
        return;
      }
    } catch(e) {
      const newFarm = {
        id: `farm-${Date.now()}`,
        name: form.name,
        area: Number(form.area) || 10,
        crop: form.crop || 'Crop',
        lat: form.lat,
        lon: form.lon
      };
      await refreshFarms(newFarm);
      setActiveFarmId(newFarm.id);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setForm({...form, lat: pos.coords.latitude, lon: pos.coords.longitude});
        alert(`GPS Captured successfully: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      });
    }
  };

  return (
  <div className="min-h-screen relative overflow-hidden py-12 px-6 flex items-center justify-center bg-background">
    <div className="absolute inset-0 bg-gradient-hero mix-blend-screen" />
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="relative w-full max-w-2xl premium-glass-strong rounded-3xl p-8 md:p-10 z-10">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-[hsl(var(--primary-foreground))] text-xl font-black shadow-glow border border-primary/50">
          T
        </div>
      </div>
      <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold text-center mb-3">Step 1 of 3 · Farm Profile</div>
      <h1 className="text-3xl md:text-4xl font-black text-center text-foreground mb-4 tracking-tight">Tell us about your farm</h1>
      <p className="text-sm font-medium text-muted-foreground text-center mb-10">We'll calibrate our models perfectly to your unique conditions.</p>
      
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { l: "Farm Name", k: "name", i: Building, p: "e.g. Green Valley Estate" },
          { l: "Total Area (Acres)", k: "area", i: MapPin, p: "e.g. 45", t: "number" },
          { l: "Primary Crop", k: "crop", i: Sprout, p: "e.g. Wheat, Sugarcane" }
        ].map((f) => (
          <div key={f.l}>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground block mb-2 ml-1">{f.l}</label>
            <div className="relative">
              <f.i className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground drop-shadow-md" />
              <input type={f.t || 'text'} value={(form as any)[f.k]} onChange={e => setForm({...form, [f.k]: e.target.value})} placeholder={f.p} className="w-full pl-12 pr-4 py-4 rounded-xl bg-black/40 border border-white/10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-black/60 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] placeholder:text-muted-foreground/30"/>
            </div>
          </div>
        ))}
      </div>
      
      <div onClick={getGps} className="mt-10 premium-glass border-dashed border-2 border-primary/30 rounded-3xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all group">
        <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] group-hover:bg-primary/20 transition-colors">
          <MapPin className="w-7 h-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
        </div>
        <div className="font-black text-foreground text-lg mb-1 tracking-wide">Add Farm Photo + Capture GPS</div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">Current GPS: {form.lat.toFixed(4)}, {form.lon.toFixed(4)}</div>
      </div>
      
      <div className="mt-10 flex gap-4 flex-col sm:flex-row">
        <Link to="/auth" className="w-full py-4 rounded-xl bg-card/60 backdrop-blur-md border border-white/10 text-foreground font-bold hover:bg-card/80 transition-colors uppercase tracking-widest text-xs flex items-center justify-center">
          Back
        </Link>
        <button disabled={loading} onClick={handleSubmit} className="w-full py-4 rounded-xl bg-primary text-[hsl(var(--primary-foreground))] font-black shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity uppercase tracking-widest text-xs border border-primary/50 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue to Pair Devices <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </motion.div>
  </div>
  );
};
