import { Hexagon } from "lucide-react";
import { Link } from "react-router-dom";

export const Logo = ({ to = "/" }: { to?: string }) => (
  <Link to={to} className="flex items-center gap-2 group">
    <div className="relative">
      {/* Hexagon icon — uses primary color for light/dark mode compatibility */}
      <Hexagon className="w-8 h-8 text-primary fill-primary/10 transition-transform group-hover:rotate-30 duration-700" strokeWidth={1.5} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>
    </div>
    <div className="leading-none">
      <div className="text-lg font-bold tracking-tight text-foreground">TRINEXA</div>
      <div className="text-[9px] uppercase tracking-[0.3em] text-secondary font-mono font-bold">AgriTech</div>
    </div>
  </Link>
);
