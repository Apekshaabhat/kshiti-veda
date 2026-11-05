import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Activity, Brain, Droplets, CloudSun, TrendingUp, Receipt, BarChart3, Cpu, Heart, Zap, FileText, Settings, Bell, Mic, ChevronDown, Wifi, Battery, Sun, Globe, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useTelemetry } from "@/lib/TelemetryProvider";
import { useFarm } from "@/lib/FarmProvider";

// Restructured for SoilMatrix
const navItems = [
  { group: "SOIL INTELLIGENCE" },
  { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
  { to: "/farm-health", icon: Heart, label: "nav.farm_health" },
  { to: "/analytics", icon: BarChart3, label: "nav.analytics" },
  { group: "SUPPORTING MODULES" },
  { to: "/irrigation", icon: Droplets, label: "nav.irrigation" },
  { to: "/sensors", icon: Activity, label: "nav.sensors" },
  { to: "/devices", icon: Cpu, label: "nav.devices" },
  { to: "/weather", icon: CloudSun, label: "nav.weather" },
  { to: "/automation", icon: Zap, label: "nav.automation" },
  { to: "/virtual-farm", icon: Brain, label: "Virtual Farm" },
  { to: "/market", icon: TrendingUp, label: "nav.market" },
  { to: "/expenses", icon: Receipt, label: "nav.expenses" },
  { to: "/reports", icon: FileText, label: "nav.reports" },
  { group: "SYSTEM" },
  { to: "/settings", icon: Settings, label: "nav.settings" },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language || 'en');
  const { connected, resetDemo } = useTelemetry();
  const { farms, activeFarm, setActiveFarmId } = useFarm();

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'hi' : lang === 'hi' ? 'mr' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('soilmatrix_lang', newLang);
    setLang(newLang);
  };

  return (
    <div className="min-h-screen flex bg-background pb-20 md:pb-0 font-sans text-foreground selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 border-r border-white/5 premium-glass flex-shrink-0 flex-col sticky top-0 h-screen z-50">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="font-black text-xl text-foreground flex items-center gap-3 tracking-wider">
            <span className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-[hsl(var(--primary-foreground))] shadow-glow text-lg">T</span>
            Trinexa
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {navItems.map((item, idx) => {
            if (item.group) {
              return <div key={idx} className="px-4 py-3 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">{item.group}</div>;
            }
            
            const active = pathname === item.to;
            return (
              <Link key={item.to} to={item.to!}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  active ? 'text-primary bg-primary/10 shadow-[inset_0_1px_0_0_hsla(var(--primary),10%)]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}>
                {active && <motion.div layoutId="activeNav" className="absolute inset-0 rounded-xl border border-primary/20 shadow-glow" />}
                <item.icon className="w-5 h-5 relative z-10" />
                <span className="relative z-10 tracking-wide">{t(item.label || '')}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-5 border-t border-white/5">
          <div className="bg-black/40 rounded-xl p-4 text-xs space-y-3 border border-white/5 backdrop-blur-md shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Data Source</span>
              <span className={`flex items-center gap-2 font-bold ${connected ? 'text-primary' : 'text-red-500'}`}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-pulse shadow-glow' : 'bg-red-500'}`} />
                {connected ? 'Trinexa Core (Dev)' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-x-hidden">
        {/* Top Header */}
        <header className="h-16 md:h-20 border-b border-white/5 premium-glass flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3">
             <div className="md:hidden font-black text-lg text-foreground flex items-center gap-2 tracking-wide">
                <span className="w-8 h-8 rounded-lg bg-primary text-[hsl(var(--primary-foreground))] flex items-center justify-center text-sm shadow-glow">T</span>
                Trinexa
             </div>
             
             <div className="hidden md:flex relative group">
               <button className="flex flex-row items-center gap-2 px-4 py-2 rounded-xl bg-black/40 text-sm font-bold border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] hover:bg-black/60 transition-colors">
                 <span className="text-foreground">{activeFarm?.name || 'Select Farm'}</span>
                 <ChevronDown className="w-4 h-4 opacity-60 ml-1" />
               </button>
               <div className="absolute top-12 left-0 w-56 bg-black/95 border border-white/10 rounded-xl hidden group-hover:block backdrop-blur-lg overflow-hidden py-2 shadow-2xl z-50">
                 {farms.map((f: any) => (
                   <button key={f.id} onClick={() => setActiveFarmId(f.id)} className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-primary/20 ${f.id === activeFarm?.id ? 'text-primary' : 'text-muted-foreground'}`}>
                     {f.name}
                   </button>
                 ))}
                 <Link to="/onboarding" className="w-full block text-left px-4 py-2 text-sm font-bold text-primary hover:bg-white/10 border-t border-white/5 mt-1 pt-3">
                   + Add New Farm
                 </Link>
               </div>
             </div>

             <button onClick={resetDemo} className="hidden lg:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary px-4 py-2 rounded-xl border border-primary/30 hover:bg-primary/10 transition-colors shadow-glow ml-4">
               <RefreshCcw className="w-3.5 h-3.5" /> Reset Demo
             </button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 text-xs font-bold border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] text-muted-foreground mr-2">
               Synchronized
            </div>
            <button onClick={toggleLang} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 border border-white/5 text-xs font-bold hover:bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] text-foreground transition-all">
              <Globe className="w-4 h-4 text-primary" />
              {lang === 'en' ? 'EN' : 'HI'}
            </button>
            <button className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-foreground hover:bg-black/60 relative transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary shadow-glow" />
            </button>
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary items-center justify-center text-sm font-black text-[hsl(var(--primary-foreground))] shadow-glow cursor-pointer hover:opacity-90 transition-opacity">
              AK
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 premium-glass border-t border-white/5 flex justify-around items-center h-20 px-2 pb-safe z-50">
        {[navItems[1], navItems[2], navItems[5], navItems[6]].map((item: any) => {
          const active = pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? 'text-primary' : 'text-muted-foreground/80'}`}>
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-primary/10 shadow-glow' : 'bg-transparent'}`}>
                <item.icon className={`w-6 h-6 ${active ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[9px] sm:text-[10px] uppercase tracking-widest font-black ${active ? 'text-primary' : ''}`}>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
        <Link to="/settings" className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/settings' ? 'text-primary' : 'text-muted-foreground/80'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${pathname === '/settings' ? 'bg-primary/10 shadow-glow' : 'bg-transparent'}`}>
            <Settings className={`w-6 h-6 ${pathname === '/settings' ? 'stroke-[2.5px]' : ''}`} />
          </div>
          <span className={`text-[9px] sm:text-[10px] uppercase tracking-widest font-black ${pathname === '/settings' ? 'text-primary' : ''}`}>MENU</span>
        </Link>
      </nav>
    </div>
  );
};
