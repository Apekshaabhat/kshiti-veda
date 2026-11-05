import { Page, PageHeader } from "@/components/trinexa/Page";
import { marketPrices } from "../lib/mockData";
import { TrendingUp, TrendingDown, Plus, Receipt, Loader2, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useFarm } from "@/lib/FarmProvider";
import { useEffect, useState } from "react";

export const Market = () => {
  const trend = Array.from({length:30},(_,i)=>({d:i, p: 4000 + Math.sin(i/3)*200 + i*8}));
  return (
    <Page>
      <PageHeader tag="06 · Market" title="Live mandi prices" desc="Best windows, demand forecasts, and nearby market comparisons"/>
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 premium-glass-strong rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xl">Basmati Rice · 30-day</h3>
            <span className="text-xs font-black uppercase tracking-widest text-[#7fff00] bg-[#7fff00]/10 px-3 py-1 rounded-full">▲ 4.2%</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <Line type="monotone" dataKey="p" stroke="#7fff00" strokeWidth={3} dot={false}/>
              <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:16, fontWeight:'bold'}} cursor={{stroke:"rgba(255,255,255,0.1)", strokeWidth:2}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="premium-glass rounded-3xl p-6 md:p-8 border-l-[3px] border-[#7fff00]/50 flex flex-col justify-center">
          <h3 className="font-black text-xl text-muted-foreground mb-3">Best Sell Window</h3>
          <div className="text-4xl font-black text-foreground mb-4">Next 5 days</div>
          <p className="text-sm font-bold text-muted-foreground leading-relaxed">AI predicts peak ₹4,540/q in Pune APMC. Recommend selling before Friday due to impending supply glut.</p>
        </div>
      </div>
      <div className="premium-glass-strong rounded-3xl p-6 md:p-8">
        <h3 className="font-black text-xl mb-6">All Mandis</h3>
        <div className="space-y-3">
          {marketPrices.map(m => (
            <div key={m.crop} className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
              <div>
                <div className="font-black text-lg group-hover:text-primary transition-colors">{m.crop}</div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{m.mandi} · demand: {m.demand}</div>
              </div>
              <div className="flex items-center gap-6">
                <div className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 ${m.change > 0 ? 'text-[#7fff00] bg-[#7fff00]/10' : 'text-red-500 bg-red-500/10'}`}>
                  {m.change > 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>} {Math.abs(m.change)}%
                </div>
                <div className="text-2xl font-black">₹{m.price.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
};

const DEFAULT_EXPENSES_LIST = [
  { id: 'exp-1', farm_id: 'farm-1', category: 'Seeds', amount: 24000, date: new Date().toISOString(), note: 'Basmati Rice High Yield Seeds' },
  { id: 'exp-2', farm_id: 'farm-1', category: 'Fertilizer', amount: 18500, date: new Date().toISOString(), note: 'NPK Soil Booster' },
  { id: 'exp-3', farm_id: 'farm-1', category: 'Labor', amount: 42000, date: new Date().toISOString(), note: 'Field Preparation & Planting' },
  { id: 'exp-4', farm_id: 'farm-1', category: 'Water', amount: 8200, date: new Date().toISOString(), note: 'Micro-Irrigation Channel' }
];

export const Expenses = () => {
  const { activeFarm } = useFarm();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'Fertilizer', note: '' });

  const loadExpenses = () => {
    const currentFarmId = activeFarm?.id || 'farm-1';
    fetch('http://localhost:3001/api/expenses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setExpenses(data.filter((e:any) => e.farm_id === currentFarmId));
          return;
        }
        throw new Error("Invalid response");
      })
      .catch(() => {
        const saved = localStorage.getItem(`trinexa_expenses_${currentFarmId}`);
        if (saved) {
          setExpenses(JSON.parse(saved));
        } else {
          const farmDefaults = DEFAULT_EXPENSES_LIST.map(e => ({ ...e, farm_id: currentFarmId }));
          setExpenses(farmDefaults);
          localStorage.setItem(`trinexa_expenses_${currentFarmId}`, JSON.stringify(farmDefaults));
        }
      });
  };

  useEffect(() => { loadExpenses(); }, [activeFarm?.id]);

  const handleAdd = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setLoading(true);
    const currentFarmId = activeFarm?.id || 'farm-1';
    const newRecord = {
      id: `exp-${Date.now()}`,
      farm_id: currentFarmId,
      category: form.category,
      amount: parseFloat(form.amount),
      note: form.note,
      date: new Date().toISOString()
    };

    try {
      await fetch('http://localhost:3001/api/expenses', {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(newRecord)
      });
      loadExpenses();
    } catch(e) {
      const updated = [newRecord, ...expenses];
      setExpenses(updated);
      localStorage.setItem(`trinexa_expenses_${currentFarmId}`, JSON.stringify(updated));
    } finally {
      setIsAdding(false);
      setForm({ amount: '', category: 'Fertilizer', note: '' });
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const currentFarmId = activeFarm?.id || 'farm-1';
    try {
      await fetch(`http://localhost:3001/api/expenses/${id}`, { method: "DELETE" });
      loadExpenses();
    } catch(e) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem(`trinexa_expenses_${currentFarmId}`, JSON.stringify(updated));
    }
  };

  const total = expenses.reduce((s,e)=>s+e.amount,0);
  const cats = expenses.reduce((acc:any, cur:any) => { acc[cur.category] = (acc[cur.category] || 0) + cur.amount; return acc; }, {});
  const colors = ['hsl(180,100%,55%)', 'hsl(45,100%,60%)', 'hsl(280,100%,65%)', 'hsl(140,100%,60%)', 'hsl(330,100%,60%)'];
  const pieData = Object.keys(cats).map((k, i) => ({ category: k, amount: cats[k], color: colors[i%colors.length] }));

  return (
    <Page>
      <PageHeader tag="07 · Finance" title="Expense Management" desc={`Track every rupee for ${activeFarm?.name || 'Farm'} with AI-powered cost reduction`}
        actions={<button onClick={()=>setIsAdding(!isAdding)} className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest shadow-glow flex items-center gap-2 hover:opacity-90 transition-opacity"><Plus className="w-4 h-4"/>Add Record</button>}
      />
      
      {isAdding && (
        <div className="premium-glass-strong rounded-3xl p-6 md:p-8 mb-8 animate-in fade-in slide-in-from-top-4 border-primary/30">
          <h3 className="font-black text-lg mb-4">New Expense</h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground block mb-2">Category</label>
              <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                {['Fertilizer', 'Pesticide', 'Labor', 'Equipment', 'Seeds', 'Water', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground block mb-2">Amount (₹)</label>
              <input type="number" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})} placeholder="e.g. 1500" className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"/>
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground block mb-2">Note (Optional)</label>
              <input value={form.note} onChange={e=>setForm({...form, note: e.target.value})} placeholder="e.g. NPK Base" className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"/>
            </div>
            <button onClick={handleAdd} disabled={loading} className="w-full md:w-auto px-8 py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-widest shadow-[0_0_15px_hsl(var(--primary)/20)] flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {[{l:"Total spend",v:`₹${total.toLocaleString()}`,s:"active farm"},{l:"Estimated profit",v:"₹----",s:"requires harvest data"},{l:"AI savings",v:"₹0",s:"optimizations pending"}].map(x=>(
          <div key={x.l} className="premium-glass rounded-3xl p-6 md:p-8">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">{x.l}</div>
            <div className="text-4xl font-black text-foreground mt-2">{x.v}</div>
            <div className="text-xs font-bold text-primary mt-2">{x.s}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="premium-glass-strong rounded-3xl p-6 md:p-8">
          <h3 className="font-black text-xl mb-6">Spend Breakdown</h3>
          {expenses.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground font-bold">No expenses recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} stroke="none">
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",borderRadius:16, fontWeight:'bold', color:'white'}} cursor={{fill:'transparent'}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="premium-glass-strong rounded-3xl p-6 md:p-8 flex flex-col">
          <h3 className="font-black text-xl mb-6">Ledger</h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {expenses.length === 0 && <div className="text-muted-foreground font-bold text-sm">Add your first expense to begin tracking.</div>}
            {expenses.map(e=>(
              <div key={e.id} className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-colors group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5">
                   <Receipt className="w-5 h-5 text-muted-foreground"/>
                </div>
                <div className="flex-1">
                  <div className="font-black text-sm">{e.category}</div>
                  <div className="text-xs font-bold text-muted-foreground mt-1">{new Date(e.date).toLocaleDateString()} · {e.note || 'No note'}</div>
                </div>
                <div className="font-black text-lg">₹{e.amount.toLocaleString()}</div>
                <button onClick={()=>handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/20 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};
