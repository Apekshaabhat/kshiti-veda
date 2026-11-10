import { createRoot } from "react-dom/client";
import "./lib/i18n";
import App from "./App.tsx";
import "./index.css";
import { TelemetryProvider } from "./lib/TelemetryProvider";
import { FarmProvider } from "./lib/FarmProvider";
import { ErrorBoundary } from "./components/trinexa/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <FarmProvider>
      <TelemetryProvider>
        <App />
      </TelemetryProvider>
    </FarmProvider>
  </ErrorBoundary>
);
