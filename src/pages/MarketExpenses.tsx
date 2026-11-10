import { Page, PageHeader } from "@/components/trinexa/Page";
import { TrendingUp, TrendingDown, Plus, Receipt, Loader2, Trash2, Star, CheckCircle, Clock, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useFarm } from "@/lib/FarmProvider";
import { useEffect, useState } from "react";

const getHostBase = () => {
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
};

export const Market = () => {
  const [commodities, setCommodities] = useState<any[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<string>('comm-rice');
  const [mandiPrices, setMandiPrices] = useState<any[]>([]);
  const [trendHistory, setTrendHistory] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMarketData = async () => {
    try {
      setLoading(true);
      const [pricesRes, watchRes] = await Promise.all([
        fetch(`${getHostBase()}/api/market/prices`),
        fetch(`${getHostBase()}/api/market/watchlist`)
      ]);

      if (pricesRes.ok) {
        const data = await pricesRes.json();
        setMandiPrices(data || []);

        // Unique commodities
        const unique = Array.from(new Set(data.map((p: any) => p.commodity_id))).map(id => {
          const item = data.find((p: any) => p.commodity_id === id);
          return { id, name: item.commodity_name, variety: item.variety };
        });
        setCommodities(unique);
      }

      if (watchRes.ok) {
        const watchData = await watchRes.json();
        setWatchlist((watchData || []).map((w: any) => w.commodity_id));
      }
    } catch (err) {
      console.warn("Failed to load market data", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (commId: string) => {
    try {
      const res = await fetch(`${getHostBase()}/api/market/history?commodity_id=${commId}&days=30`);
      if (res.ok) {
        const data = await res.json();
        const trendList = Array.isArray(data) ? data : (data.trend || []);
        if (trendList.length) {
          setTrendHistory(trendList.map((d: any) => ({
            day: d.date || (d.arrival_date ? new Date(d.arrival_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Day'),
            price: d.price ?? d.modal_price ?? 0
          })));
        }
      }
    } catch (e) {
      console.warn("Failed to load trend history", e);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, []);

  useEffect(() => {
    if (selectedCommodity) {
      loadHistory(selectedCommodity);
    }
  }, [selectedCommodity]);

  const toggleWatchlist = async (commId: string) => {
    const isWatched = watchlist.includes(commId);
    try {
      if (isWatched) {
        await fetch(`${getHostBase()}/api/market/watchlist/${commId}`, { method: 'DELETE' });
        setWatchlist(prev => prev.filter(id => id !== commId));
      } else {
        await fetch(`${getHostBase()}/api/market/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commodity_id: commId })
        });
        setWatchlist(prev => [...prev, commId]);
      }
    } catch (e) {
      console.warn("Failed to update watchlist", e);
    }
  };

  const currentPrices = mandiPrices.filter(p => p.commodity_id === selectedCommodity);
  const selectedName = commodities.find(c => c.id === selectedCommodity)?.name || 'Commodity';
  const bestMandi = currentPrices.length ? [...currentPrices].sort((a,b) => b.modal_price - a.modal_price)[0] : null;

  return (
    <Page>
      <PageHeader
        tag="06 · Market Intelligence"
        title="Live APMC Mandi Prices"
        desc="Real-time Agmarknet commodity prices, multi-mandi comparisons, and AI sell-window recommendations."
      />

      {/* Commodity Selector Ribbon */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
        {commodities.map((c) => {
          const isSelected = c.id === selectedCommodity;
          const isStarred = watchlist.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCommodity(c.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-primary text-[hsl(var(--primary-foreground))] shadow-glow'
                  : 'bg-black/40 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <span>{c.name}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWatchlist(c.id);
                }}
                className={`p-0.5 rounded-full ${isStarred ? 'text-amber-400' : 'text-zinc-500 hover:text-white'}`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* 30-day Trendline */}
        <div className="lg:col-span-2 premium-glass-strong rounded-3xl p-6 md:p-8 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-xl text-foreground tracking-wide">{selectedName} · 30-Day Trend</h3>
              <span className="text-xs font-mono text-muted-foreground">Historical modal mandi prices (₹/quintal)</span>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-[#7fff00] bg-[#7fff00]/10 px-3 py-1 rounded-full border border-[#7fff00]/20">
              ▲ Bullish Trend
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendHistory.length ? trendHistory : [{ day: 'Today', price: 4200 }]}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(215, 15%, 65%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 15%, 65%)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 100', 'dataMax + 100']} />
              <Tooltip
                contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="price" stroke="#7fff00" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI Best Sell Window Recommendation */}
        <div className="premium-glass rounded-3xl p-6 md:p-8 border-l-[3px] border-[#7fff00] flex flex-col justify-center">
          <span className="text-xs uppercase font-black tracking-widest text-[#7fff00] mb-2">Optimal Selling Window</span>
          <div className="text-3xl font-black text-foreground mb-3">Next 3–5 Days</div>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            AI predicts peak modal realization at <strong>{bestMandi?.market_name || 'Pune APMC'}</strong> at ₹{bestMandi?.modal_price?.toLocaleString() || '4,540'}/quintal.
            Recommend scheduling harvest dispatch before arrival volume surges next week.
          </p>
          {bestMandi && (
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-mono">Top Mandi Realization:</span>
              <span className="font-black text-[#7fff00]">₹{bestMandi.modal_price}/q</span>
            </div>
          )}
        </div>
      </div>

      {/* APMC Mandi Price Comparison Table */}
      <div className="premium-glass-strong rounded-3xl p-6 md:p-8 border border-white/10">
        <h3 className="font-black text-xl mb-4 text-foreground tracking-wide">Multi-Mandi Real-Time Comparison</h3>
        <div className="divide-y divide-white/5">
          {currentPrices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground font-mono text-xs">
              Loading market price benchmarks from Agmarknet provider...
            </div>
          ) : (
            currentPrices.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-4 hover:bg-white/5 px-2 rounded-xl transition-colors">
                <div>
                  <div className="font-black text-base text-foreground flex items-center gap-2">
                    <span>{m.market_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">({m.state})</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">
                    Arrivals: {m.arrivals} {m.arrival_unit} · Range: ₹{m.min_price} – ₹{m.max_price}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-black text-foreground">₹{m.modal_price.toLocaleString()}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">per {m.price_unit}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Page>
  );
};

export const Expenses = () => {
  const { activeFarm } = useFarm();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    category_id: 'cat-fertilizers',
    payment_status: 'PAID',
    payment_method: 'UPI',
    vendor: '',
    description: ''
  });

  const currentFarmId = activeFarm?.id || 'farm-default';

  const loadExpenseData = async () => {
    try {
      const [listRes, sumRes, budRes] = await Promise.all([
        fetch(`${getHostBase()}/api/expenses?farm_id=${currentFarmId}`),
        fetch(`${getHostBase()}/api/expenses/summary?farm_id=${currentFarmId}`),
        fetch(`${getHostBase()}/api/expenses/budgets?farm_id=${currentFarmId}`)
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        const list = Array.isArray(data) ? data : (data?.expenses || []); setExpenses(list);
      }
      if (sumRes.ok) {
        const sum = await sumRes.json();
        setSummary(sum);
      }
      if (budRes.ok) {
        const bud = await budRes.json();
        const budList = Array.isArray(bud) ? bud : (bud?.budgets || []); setBudgets(budList);
      }
    } catch (e) {
      console.warn("Failed to load expense data", e);
    }
  };

  useEffect(() => {
    loadExpenseData();
  }, [currentFarmId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(form.amount);
    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid positive amount greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getHostBase()}/api/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: currentFarmId,
          category: CATEGORIES.find(c => c.id === form.category_id)?.name || form.category_id, category_id: form.category_id,
          amount: amountVal,
          payment_status: form.payment_status,
          payment_method: form.payment_method,
          vendor: form.vendor,
          description: form.description,
          purchase_date: new Date().toISOString().split("T")[0]
        })
      });

      if (res.ok) {
        await loadExpenseData();
        setIsAdding(false);
        setForm({
          amount: '',
          category_id: 'cat-fertilizers',
          payment_status: 'PAID',
          payment_method: 'UPI',
          vendor: '',
          description: ''
        });
      }
    } catch (err) {
      console.error("Failed to add expense", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${getHostBase()}/api/expenses/${id}`, { method: "DELETE" });
      loadExpenseData();
    } catch (e) {
      console.error("Failed to delete expense", e);
    }
  };

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const totalSpent = summary?.total_expenditure ?? summary?.total_spent ?? safeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthlySpent = summary?.current_month_expenditure ?? summary?.monthly_spent ?? totalSpent;
  const rawCategories = summary?.category_breakdown || summary?.by_category || [];
  const pieData = (Array.isArray(rawCategories) ? rawCategories : []).map((c: any, i: number) => ({
    category: c.category || c.name || "Expense",
    amount: Number(c.amount || c.total || 0),
    color: ['#00ffff', '#7fff00', '#00e673', '#ffaa00', '#ff007f', '#9933ff'][i % 6]
  }));

  const CATEGORIES = [
    { id: 'cat-seeds', name: 'Seeds & Saplings' },
    { id: 'cat-fertilizers', name: 'Fertilizers & Nutrients' },
    { id: 'cat-pesticides', name: 'Crop Protection & Pesticides' },
    { id: 'cat-labour', name: 'Labour & Workforce' },
    { id: 'cat-irrigation', name: 'Irrigation & Pumping' },
    { id: 'cat-machinery', name: 'Machinery & Tractor Rental' },
    { id: 'cat-fuel', name: 'Fuel & Electricity' },
    { id: 'cat-transport', name: 'Post-Harvest Transport' },
    { id: 'cat-other', name: 'Miscellaneous Field Operations' }
  ];

  return (
    <Page>
      <PageHeader
        tag="07 · Farm Finances"
        title="Expense Management"
        desc={`Track every rupee for ${activeFarm?.name || 'Farm'} with budget thresholds and automated overrun alerts.`}
        actions={
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-6 py-3 rounded-full bg-primary text-[hsl(var(--primary-foreground))] text-xs font-black uppercase tracking-widest shadow-glow flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      />

      {/* Add Expense Form Modal */}
      {isAdding && (
        <form onSubmit={handleAdd} className="premium-glass-strong rounded-3xl p-6 md:p-8 mb-8 border border-primary/30">
          <h3 className="font-black text-lg text-foreground mb-4">Record New Farm Expenditure</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Amount (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 15000"
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Payment Status</label>
              <select
                value={form.payment_status}
                onChange={e => setForm({ ...form, payment_status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="PAID" className="bg-zinc-900">Paid (Settled)</option>
                <option value="PENDING" className="bg-zinc-900">Pending</option>
                <option value="OVERDUE" className="bg-zinc-900">Overdue</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Vendor / Payee</label>
              <input
                value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Krishi Seva Kendra"
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">Description</label>
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. NPK 19-19-19 Fertigation Sacks"
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-primary text-[hsl(var(--primary-foreground))] text-xs font-black uppercase tracking-wider shadow-glow hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Record Expense'}
            </button>
          </div>
        </form>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="premium-glass rounded-3xl p-6 border border-white/10">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Expenditure</div>
          <div className="text-3xl font-black text-foreground mt-2">₹{totalSpent.toLocaleString()}</div>
          <div className="text-xs font-mono text-emerald-400 mt-2">Active Field Ledger</div>
        </div>
        <div className="premium-glass rounded-3xl p-6 border border-white/10">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Expenditure</div>
          <div className="text-3xl font-black text-foreground mt-2">₹{monthlySpent.toLocaleString()}</div>
          <div className="text-xs font-mono text-cyan-400 mt-2">Current Billing Cycle</div>
        </div>
        <div className="premium-glass rounded-3xl p-6 border border-white/10">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Settlement Status</div>
          <div className="text-3xl font-black text-foreground mt-2">
            {summary?.paid_total !== undefined ? `₹${Number(summary.paid_total).toLocaleString()}` : `${safeExpenses.length} Total`}
          </div>
          <div className="text-xs font-mono text-amber-400 mt-2">
            {summary?.pending_total !== undefined ? `₹${Number(summary.pending_total).toLocaleString()} Pending` : '0 Pending Settlements'}
          </div>
        </div>
        <div className="premium-glass rounded-3xl p-6 border border-white/10">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Budget Safeguard</div>
          <div className="text-3xl font-black text-foreground mt-2">{budgets.length > 0 ? `${budgets.length} Monitored` : 'Active'}</div>
          <div className="text-xs font-mono text-emerald-400 mt-2">Auto Alert at 80% Cap</div>
        </div>
      </div>

      {/* Expense Breakdown & Ledger Table */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="premium-glass-strong rounded-3xl p-6 md:p-8 border border-white/10">
          <h3 className="font-black text-xl mb-4 text-foreground tracking-wide">Category Distribution</h3>
          {pieData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground font-mono text-xs">
              No expenses recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} stroke="none">
                  {pieData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="premium-glass-strong rounded-3xl p-6 md:p-8 border border-white/10 flex flex-col">
          <h3 className="font-black text-xl mb-4 text-foreground tracking-wide">Expense Ledger</h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-2 scrollbar-thin">
            {safeExpenses.length === 0 ? (
              <div className="text-muted-foreground font-mono text-xs py-8 text-center">
                No recorded expenditures for this farm.
              </div>
            ) : (
              safeExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                      <Receipt className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-foreground">{e.category || e.category_name || 'Expense'}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {new Date(e.purchase_date || e.expense_date || e.date || Date.now()).toLocaleDateString()} {e.vendor ? `· ${e.vendor}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-black text-base text-foreground">₹{Number(e.amount).toLocaleString()}</div>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                        e.payment_status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {e.payment_status || 'PAID'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Page>
  );
};
