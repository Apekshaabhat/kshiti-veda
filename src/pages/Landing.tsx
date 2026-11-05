import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Droplets, CloudSun, Brain, BarChart3, Zap, Satellite, Bot, Sprout, Activity, Container, Sun, Wind, Hexagon, ChevronDown } from "lucide-react";
import { Logo } from "@/components/trinexa/Logo";

const FloatParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(40)].map((_, i) => (
      <motion.div key={i}
        className="absolute w-1 h-1 rounded-full bg-neon-green"
        style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%` }}
        animate={{ y: [0, -30, 0], opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 3 + Math.random()*4, repeat: Infinity, delay: Math.random()*2 }}
      />
    ))}
  </div>
);

const SectionTag = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[11px] uppercase tracking-[0.25em] font-mono text-neon-green mb-6">
    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
    {children}
  </div>
);

const Landing = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const sensorIcons = [Droplets, Activity, Sprout, Container, CloudSun, Sun, Wind, Hexagon];

  return (
    <div className="relative bg-background overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-strong border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#ecosystem" className="hover:text-foreground transition">Ecosystem</a>
            <a href="#hardware" className="hover:text-foreground transition">Hardware</a>
            <a href="#ai" className="hover:text-foreground transition">AI Engine</a>
            <a href="#future" className="hover:text-foreground transition">Future</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="px-4 py-2 text-sm rounded-lg hover:bg-muted/40">Sign in</Link>
            <Link to="/dashboard" className="px-4 py-2 text-sm rounded-lg bg-gradient-primary text-background font-semibold shadow-glow">Launch OS</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <FloatParticles />

        {/* Animated rings */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3, 4].map((i) => (
            <motion.div key={i}
              className="absolute rounded-full border border-neon-green/15"
              style={{ width: `${i * 280}px`, height: `${i * 280}px` }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 40 + i * 10, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </motion.div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionTag>System Online · v3.0 · 14,200 farms connected</SectionTag>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
            className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="text-gradient neon-text">Trinexa</span>
            <br />
            <span className="text-foreground">Core</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-xl md:text-2xl text-muted-foreground mb-3 font-light">
            AI-Powered Smart Farm Operating System
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-base md:text-lg text-muted-foreground/80 max-w-2xl mx-auto mb-10">
            Monitor, automate, analyze, and optimize your farms in real time using AI and IoT intelligence — all from one cinematic command center.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/dashboard" className="group px-6 py-3 rounded-xl bg-gradient-primary text-background font-semibold shadow-glow hover:shadow-elevated transition flex items-center gap-2">
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
            <Link to="/dashboard" className="px-6 py-3 rounded-xl glass-strong border border-neon-cyan/30 hover:border-neon-cyan/60 transition">Live Demo</Link>
            <Link to="/onboarding" className="px-6 py-3 rounded-xl glass hover:bg-muted/30 transition">Connect Farm</Link>
          </motion.div>

          {/* Stat strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { v: "2.4M+", l: "Sensor pings/day" },
              { v: "37%", l: "Avg water saved" },
              { v: "14.2k", l: "Active farms" },
              { v: "99.97%", l: "Uptime" },
            ].map((s) => (
              <div key={s.l} className="glass rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-gradient">{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground text-xs flex flex-col items-center gap-1">
          <span className="font-mono uppercase tracking-widest">Scroll the journey</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </section>

      {/* JOURNEY PATH */}
      <div className="relative">
        <svg className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-2 z-0 hidden md:block" preserveAspectRatio="none">
          <line x1="1" y1="0" x2="1" y2="100%" stroke="hsl(var(--neon-green) / 0.25)" strokeWidth="2" strokeDasharray="6 6" />
        </svg>

        {/* SECTION 1 - Smart Field */}
        <Section id="field" tag="01 · Smart Field" title="Monitor every inch of your farmland in real time"
          desc="Digital field overlays project crop health, moisture, and growth signals across your entire estate.">
          <div className="relative h-72 rounded-3xl glass overflow-hidden">
            <div className="absolute inset-0 grid-bg" />
            <div className="absolute inset-0 bg-gradient-to-br from-neon-green/10 via-transparent to-neon-cyan/10" />
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="absolute w-3 h-3 rounded-full bg-neon-green"
                style={{ left: `${15 + i * 14}%`, top: `${30 + (i % 2) * 30}%` }}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}>
                <div className="absolute inset-0 rounded-full bg-neon-green animate-pulse-ring" />
              </motion.div>
            ))}
          </div>
        </Section>

        {/* SECTION 2 - Sensor network */}
        <Section id="sensors" tag="02 · Sensor Network" title="A living web of connected sensors"
          desc="Soil, climate, and resource sensors stream data continuously into the Trinexa intelligence layer.">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Soil Moisture","Temperature","Humidity","pH","NPK","Water Tank","Rain Sensor","Light","Wind","Air Quality"].map((n, i) => {
              const Icon = sensorIcons[i % sensorIcons.length];
              return (
                <motion.div key={n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-4 hover:border-neon-green/40 transition group">
                  <div className="relative w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-neon-green" />
                    <div className="absolute inset-0 rounded-xl border border-neon-green/30 animate-pulse-ring" />
                  </div>
                  <div className="text-sm font-medium">{n}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">live · {Math.floor(Math.random()*60)}s ago</div>
                </motion.div>
              );
            })}
          </div>
        </Section>

        {/* SECTION 3 - Hardware */}
        <Section id="hardware" tag="03 · Hardware" title="Trinexa Core — The field intelligence device"
          desc="A ruggedized edge computer that collects, analyzes, predicts, and automates — right at the soil.">
          <div className="relative h-96 rounded-3xl glass-strong overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 grid-bg opacity-40" />
            {[1,2,3].map(i => (
              <motion.div key={i} className="absolute rounded-full border border-neon-green/30"
                style={{ width: `${i * 140}px`, height: `${i * 140}px` }}
                animate={{ rotate: i % 2 === 0 ? 360 : -360, scale: [1, 1.05, 1] }}
                transition={{ rotate: { duration: 20 + i * 5, repeat: Infinity, ease: "linear" }, scale: { duration: 3, repeat: Infinity } }}
              />
            ))}
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }}
              className="relative w-40 h-40 rounded-3xl bg-gradient-to-br from-neon-green/30 to-neon-cyan/20 border border-neon-green/40 shadow-glow flex flex-col items-center justify-center">
              <Hexagon className="w-16 h-16 text-neon-green mb-2" strokeWidth={1.5} />
              <div className="text-xs font-mono text-neon-cyan">CORE-X3</div>
            </motion.div>
            <div className="absolute bottom-6 left-0 right-0 grid grid-cols-4 max-w-2xl mx-auto px-6 gap-2 text-center text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              {["Collect","Analyze","Predict","Automate"].map(s => <div key={s} className="glass rounded-lg py-2 text-neon-green">{s}</div>)}
            </div>
          </div>
        </Section>

        {/* SECTION 4 - AI */}
        <Section id="ai" tag="04 · AI Intelligence" title="Holographic insights, surfaced automatically"
          desc="The AI layer continuously interprets data streams and surfaces decisions that matter.">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Droplets, t: "Low moisture detected", d: "Zone B at 28% — irrigation recommended for 18 min", c: "neon-cyan" },
              { icon: Brain, t: "Disease probability", d: "Powdery mildew risk 14% — preventive spray suggested", c: "neon-lime" },
              { icon: CloudSun, t: "Weather risk", d: "Heavy rainfall in 14h — automation paused", c: "neon-green" },
            ].map((c, i) => (
              <motion.div key={c.t} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-strong rounded-2xl p-5 border-l-2 border-neon-green animate-glow-pulse">
                <c.icon className={`w-6 h-6 text-${c.c} mb-3`} />
                <div className="font-semibold mb-1">{c.t}</div>
                <div className="text-sm text-muted-foreground">{c.d}</div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* SECTION 5 - Weather */}
        <Section tag="05 · Weather Intelligence" title="GPS-precise climate forecasting"
          desc="Hyperlocal forecasts blended with on-farm sensors give you 30-minute precision on rain, storms, and wind.">
          <div className="glass-strong rounded-3xl p-8 border border-neon-cyan/20">
            <div className="flex items-center gap-4 mb-6">
              <CloudSun className="w-12 h-12 text-neon-cyan" />
              <div>
                <div className="text-4xl font-bold">28.6°C</div>
                <div className="text-sm text-muted-foreground">Partly cloudy · Pune, MH</div>
              </div>
              <div className="ml-auto px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-sm">
                Heavy rainfall expected tomorrow · irrigation paused automatically
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => (
                <div key={d} className="glass rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{d}</div>
                  <div className="text-2xl my-2">{["☀️","⛅","🌧️","🌧️","⛈️","☁️","☀️"][i]}</div>
                  <div className="text-xs font-mono">{28 + i % 3}°</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* SECTION 6 - Automation */}
        <Section tag="06 · Smart Automation" title="Rules that run themselves"
          desc="Compose conditional automations across irrigation, motors, and energy — Trinexa executes them at the edge.">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-strong rounded-2xl p-6">
              <div className="text-xs font-mono text-neon-green mb-3">RULE · ACTIVE</div>
              <div className="font-mono text-sm space-y-2">
                <div><span className="text-neon-cyan">IF</span> moisture &lt; 30%</div>
                <div><span className="text-neon-cyan">AND</span> rain_probability &lt; 40%</div>
                <div><span className="text-neon-lime">THEN</span> start_irrigation(zone_b, 18min)</div>
                <div><span className="text-neon-lime">AND</span> notify(farmer)</div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 relative overflow-hidden">
              <div className="text-sm text-muted-foreground mb-3">Live water flow · Zone B</div>
              <div className="relative h-32 rounded-xl bg-muted/20 overflow-hidden">
                <motion.div className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent"
                  animate={{ x: ["-10%", "110%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">14.2 L/min</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                <div className="glass rounded-lg p-2"><div className="text-neon-green font-bold">37%</div><div className="text-muted-foreground">water saved</div></div>
                <div className="glass rounded-lg p-2"><div className="text-neon-lime font-bold">96%</div><div className="text-muted-foreground">efficiency</div></div>
                <div className="glass rounded-lg p-2"><div className="text-neon-cyan font-bold">Auto</div><div className="text-muted-foreground">mode</div></div>
              </div>
            </div>
          </div>
        </Section>

        {/* SECTION 7 - Multi-farm */}
        <Section tag="07 · Multi-Farm Ecosystem" title="One ecosystem, every farm"
          desc="Synchronize fields across districts, states, even countries — managed from a single interface.">
          <div className="glass-strong rounded-3xl p-8 relative overflow-hidden h-80">
            <div className="absolute inset-0 grid-bg opacity-30" />
            {[
              { x: 30, y: 50 }, { x: 45, y: 35 }, { x: 60, y: 55 }, { x: 25, y: 70 }, { x: 70, y: 40 }, { x: 55, y: 75 }
            ].map((p, i) => (
              <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <div className="relative w-3 h-3 rounded-full bg-neon-green shadow-glow">
                  <div className="absolute inset-0 rounded-full bg-neon-green animate-pulse-ring" />
                </div>
              </div>
            ))}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="30" y1="50" x2="45" y2="35" stroke="hsl(var(--neon-green) / 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
              <line x1="45" y1="35" x2="60" y2="55" stroke="hsl(var(--neon-green) / 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
              <line x1="60" y1="55" x2="55" y2="75" stroke="hsl(var(--neon-green) / 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
              <line x1="25" y1="70" x2="55" y2="75" stroke="hsl(var(--neon-green) / 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
              <line x1="70" y1="40" x2="60" y2="55" stroke="hsl(var(--neon-green) / 0.4)" strokeWidth="0.2" strokeDasharray="1 1" />
            </svg>
            <div className="absolute bottom-6 right-6 text-right">
              <div className="text-4xl font-bold text-gradient">14,247</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">connected farms</div>
            </div>
          </div>
        </Section>

        {/* SECTION 8 - Analytics */}
        <Section tag="08 · Analytics & BI" title="Your farm, in numbers that matter"
          desc="From water savings to ROI — every decision is backed by enterprise-grade analytics.">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: "37%", l: "Water saved", i: Droplets },
              { v: "+24%", l: "Yield uplift", i: Sprout },
              { v: "₹2.4L", l: "Profit / season", i: BarChart3 },
              { v: "92/100", l: "Farm health", i: Activity },
              { v: "99.7%", l: "Sensor uptime", i: Cpu },
              { v: "68%", l: "Solar share", i: Sun },
              { v: "0.4 t", l: "CO₂ saved", i: Zap },
              { v: "42 min", l: "Avg auto-irrig", i: Bot },
            ].map((s, i) => (
              <motion.div key={s.l} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className="glass rounded-2xl p-5 hover:shadow-glow transition">
                <s.i className="w-5 h-5 text-neon-green mb-3" />
                <div className="text-2xl md:text-3xl font-bold text-gradient">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* SECTION 9 - Future */}
        <Section id="future" tag="09 · The Future" title="The future of farming starts here"
          desc="Drones, satellites, robotic farming, autonomous irrigation, digital twin farms — all natively orchestrated.">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { i: Satellite, t: "Satellite Intelligence", d: "Sub-meter resolution NDVI scans every 24h" },
              { i: Bot, t: "Autonomous Robotics", d: "Robotic weeders & seeders managed by Core" },
              { i: Brain, t: "Digital Twin Farms", d: "A live mirror of every field for what-if simulations" },
            ].map((f, i) => (
              <motion.div key={f.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-strong rounded-2xl p-6 hover:border-neon-cyan/40 transition group relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-glow opacity-50 group-hover:opacity-100 transition" />
                <f.i className="w-8 h-8 text-neon-cyan mb-4 relative" />
                <div className="text-lg font-semibold mb-2 relative">{f.t}</div>
                <div className="text-sm text-muted-foreground relative">{f.d}</div>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <section className="relative py-32 px-6 text-center">
          <div className="absolute inset-0 bg-gradient-hero opacity-50" />
          <div className="relative max-w-3xl mx-auto">
            <SectionTag>Ready when you are</SectionTag>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Step into the <span className="text-gradient">command center</span> of your farm.
            </h2>
            <p className="text-muted-foreground mb-8">Trinexa Core is live, autonomous, and built for the next generation of agriculture.</p>
            <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-primary text-background font-semibold shadow-glow hover:shadow-elevated transition">
              Launch the OS <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-border/40 py-8 px-6 text-center text-xs text-muted-foreground">
          <Logo />
          <div className="mt-4 font-mono">© 2026 Trinexa Core — Cultivating the future, autonomously.</div>
        </footer>
      </div>
    </div>
  );
};

const Section = ({ id, tag, title, desc, children }: any) => (
  <section id={id} className="relative py-24 px-6">
    <div className="max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6 }}
        className="text-center mb-12">
        <SectionTag>{tag}</SectionTag>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 max-w-3xl mx-auto leading-tight">{title}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">{desc}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.7 }}>
        {children}
      </motion.div>
    </div>
  </section>
);

export default Landing;
