import { AppShell } from "@/components/trinexa/AppShell";
import { motion } from "framer-motion";

export const PageHeader = ({ tag, title, desc, actions }: { tag: string; title: string; desc?: string; actions?: React.ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">{tag}</div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
      {desc && <p className="text-muted-foreground mt-1 text-sm">{desc}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

export const Page = ({ children }: { children: React.ReactNode }) => (
  <AppShell>
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="p-6 max-w-[1600px] mx-auto">
      {children}
    </motion.div>
  </AppShell>
);
