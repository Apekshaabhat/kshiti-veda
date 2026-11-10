import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111827]/80 border border-red-500/30 rounded-3xl p-8 backdrop-blur-xl shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="text-[10px] uppercase font-mono font-bold tracking-widest text-red-400 mb-2">
              Trinexa Runtime Recovery
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Something went wrong</h2>
            <p className="text-xs font-mono text-zinc-400 mb-6 bg-black/40 p-3 rounded-xl border border-white/5 break-words">
              {this.state.error?.message || "An unexpected rendering error occurred"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Page
              </button>
              <a
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <Home className="w-3.5 h-3.5" /> Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

