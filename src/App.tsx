import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimulationProvider } from "./lib/SimulationContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import { Sensors, SensorDetail } from "./pages/Sensors";
import { CropAI } from "./pages/CropAI";
import { VirtualFarm } from "./pages/VirtualFarm";
import { Irrigation } from "./pages/Irrigation";
import { Weather } from "./pages/Weather";
import { Market, Expenses } from "./pages/MarketExpenses";
import { Analytics, Devices, FarmHealth, Automation, Reports, Settings } from "./pages/Modules";
import { Auth, Onboarding } from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SimulationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/sensors/:id" element={<SensorDetail />} />
            <Route path="/crop-ai" element={<CropAI />} />
            <Route path="/virtual-farm" element={<VirtualFarm />} />
            <Route path="/irrigation" element={<Irrigation />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/market" element={<Market />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/farm-health" element={<FarmHealth />} />
            <Route path="/automation" element={<Automation />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SimulationProvider>
  </QueryClientProvider>
);

export default App;
