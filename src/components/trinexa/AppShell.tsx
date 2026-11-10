import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Activity, Brain, Droplets, CloudSun, TrendingUp, Receipt, BarChart3, Cpu, Heart, Zap, FileText, Settings, Bell, Mic, ChevronDown, Wifi, Battery, Sun, Globe, RefreshCcw, Check, AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      const [listRes, countRes] = await Promise.all([
        fetch(`http://${host}:3001/api/notifications?limit=15`),
        fetch(`http://${host}:3001/api/notifications/count`)
      ]);
      if (listRes.ok) {
        const json = await listRes.json();
        setNotifications(json.notifications || json.data || (Array.isArray(json) ? json : []));
      }
      if (countRes.ok) {
        const json = await countRes.json();
        setUnreadCount(json.unread_count || 0);
      }
    } catch {
      // Backend not running yet
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  const markAsRead = async (id: string) => {
    try {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      await fetch(`http://${host}:3001/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.warn("Failed to mark notification read", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      await fetch(`http://${host}:3001/api/notifications/mark-all-read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.warn("Failed to mark all read", e);
    }
  };

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
            {/* Interactive Notifications Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="View notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-foreground hover:bg-black/60 relative transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-black text-black flex items-center justify-center shadow-[0_0_8px_#34d399] animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-80 sm:w-96 bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden flex flex-col max-h-[480px]"
                  >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase tracking-wide text-foreground">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="overflow-y-auto divide-y divide-white/5 flex-1 scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs font-mono">
                          No notifications yet. System is optimal.
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isCritical = n.severity === 'CRITICAL';
                          const isWarning = n.severity === 'WARNING';
                          return (
                            <div
                              key={n.id}
                              onClick={() => !n.is_read && markAsRead(n.id)}
                              className={`p-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left ${
                                !n.is_read ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5">
                                  {isCritical ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  ) : isWarning ? (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  )}
                                  <span className={`text-[11px] font-black tracking-wide ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {n.title}
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-snug pl-5 line-clamp-2">
                                {n.message}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-3 border-t border-white/10 bg-black/40 text-center">
                      <Link
                        to="/notifications"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        View All Notifications →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
