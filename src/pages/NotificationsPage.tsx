import { useState, useEffect } from "react";
import { Page, PageHeader } from "@/components/trinexa/Page";
import * as Icons from "lucide-react";

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  related_id?: string;
  source?: string;
  timestamp: number;
  is_read: number;
  is_archived: number;
  action_url?: string;
}

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'WARNING' | 'CRITICAL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const getHostBase = () => {
    const host = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
    return `http://${host}:3001`;
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      let url = `${getHostBase()}/api/notifications?limit=50`;
      if (filter === 'UNREAD') url += '&unread=true';
      if (filter === 'WARNING' || filter === 'CRITICAL') url += `&severity=${filter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || json.data || (Array.isArray(json) ? json : []));
      }
    } catch (e) {
      console.warn("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${getHostBase()}/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (e) {
      console.warn(e);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${getHostBase()}/api/notifications/read-all`, { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.warn(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`${getHostBase()}/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <Page>
      <PageHeader
        tag="SYSTEM INTELLIGENCE & TELEMETRY ALERTS"
        title="Notifications & Alerts Center"
        desc="Real-time agronomic alerts, device telemetry events, budget thresholds, and mandi price triggers."
      />

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'UNREAD', 'WARNING', 'CRITICAL'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === f
                  ? 'bg-primary text-[hsl(var(--primary-foreground))] shadow-glow'
                  : 'bg-black/40 text-muted-foreground hover:bg-black/60 border border-white/5'
              }`}
            >
              {f === 'ALL' ? 'All Alerts' : f === 'UNREAD' ? 'Unread' : f === 'WARNING' ? 'Warnings' : 'Critical'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search alerts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 pl-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
            />
            <Icons.Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          </form>

          <button
            onClick={markAllRead}
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-foreground hover:bg-black/60 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Icons.CheckCheck className="w-3.5 h-3.5 text-primary" /> Mark all read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-mono">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="premium-glass rounded-2xl p-12 text-center border border-white/10">
            <Icons.ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-foreground mb-1">All Systems Optimal</h3>
            <p className="text-xs text-muted-foreground font-mono">No active alerts matching the selected filter.</p>
          </div>
        ) : (
          notifications.map(n => {
            const isCritical = n.severity === 'CRITICAL';
            const isWarning = n.severity === 'WARNING';

            return (
              <div
                key={n.id}
                className={`premium-glass rounded-2xl p-4 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  !n.is_read ? 'border-primary/40 bg-primary/[0.03]' : 'border-white/10'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                    isCritical
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : isWarning
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {isCritical ? (
                      <Icons.AlertCircle className="w-4 h-4" />
                    ) : isWarning ? (
                      <Icons.AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Icons.Info className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                        isCritical
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : isWarning
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {n.severity}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">
                        {n.category}
                      </span>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-foreground">{n.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>

                    <div className="text-[10px] text-muted-foreground font-mono pt-1">
                      {new Date(n.timestamp).toLocaleString()} · Source: {n.source || 'TRINEXA CORE'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs text-muted-foreground hover:text-foreground font-mono hover:bg-black/60 transition-colors"
                      title="Mark as read"
                    >
                      <Icons.Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs text-red-400/80 hover:text-red-400 font-mono hover:bg-red-500/10 transition-colors"
                    title="Delete alert"
                  >
                    <Icons.Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Page>
  );
};

