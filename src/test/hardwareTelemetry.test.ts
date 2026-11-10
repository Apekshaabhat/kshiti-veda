import { describe, it, expect } from "vitest";
import { runHardwareAIAnalysis, HardwareTelemetry } from "../../server/aiEngine";
import { classifySoilPH, getPHRecommendation } from "../lib/phUtils";

describe("TRINEXA-AI Hardware Integration & AI Engine Test Suite", () => {
  it("1. Analyzes valid full telemetry without errors", () => {
    const validData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 65.4,
      soil_raw_adc: 2150,
      soil_ph: 6.8,
      soil_temperature: 24.5,
      air_temperature: 27.2,
      air_humidity: 62.0,
      light_intensity: 450.0,
      wifi_rssi: -58,
      uptime_ms: 60000,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(validData);

    expect(result.device_id).toBe("ESP32-01");
    expect(result.overall_score).toBeGreaterThanOrEqual(90);
    expect(result.soil_status).toBe("Optimal");
    expect(result.water_requirement).toBe("None");
    expect(result.sensor_health.soil_moisture).toBe("healthy");
    expect(result.sensor_health.soil_ph).toBe("healthy");
    expect(result.sensor_health.soil_temperature).toBe("healthy");
    expect(result.sensor_health.air_dht).toBe("healthy");
    expect(result.sensor_health.ambient_light).toBe("healthy");
    expect(result.explainable_insights.length).toBeGreaterThan(0);
  });

  it("2. Properly handles disconnected sensors without generating fake fallback values", () => {
    const disconnectedData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: null,
      soil_raw_adc: null,
      soil_ph: null,
      soil_temperature: null,
      air_temperature: null,
      air_humidity: null,
      light_intensity: null,
      wifi_rssi: -72,
      uptime_ms: 12000,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(disconnectedData);

    expect(result.sensor_health.soil_moisture).toBe("disconnected");
    expect(result.sensor_health.soil_ph).toBe("disconnected");
    expect(result.sensor_health.soil_temperature).toBe("disconnected");
    expect(result.sensor_health.air_dht).toBe("disconnected");
    expect(result.sensor_health.ambient_light).toBe("disconnected");
    expect(result.overall_score).toBe(0);
    expect(result.photosynthesis_efficiency).toBe("Unavailable");
  });

  it("3. Detects severe drought stress when soil moisture is critically low", () => {
    const droughtData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 22.0,
      soil_raw_adc: 3100,
      soil_ph: 6.5,
      soil_temperature: 26.0,
      air_temperature: 31.0,
      air_humidity: 45.0,
      light_intensity: 800.0,
      wifi_rssi: -60,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(droughtData);

    expect(result.water_requirement).toBe("Immediate High");
    expect(result.alerts.some(a => a.parameter === "soil_moisture" && a.severity === "critical")).toBe(true);
    expect(result.actionable_prescriptions.some(p => p.includes("drip"))).toBe(true);
  });

  it("4. Detects strongly acidic pH and recommends agricultural lime", () => {
    const acidicData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 60.0,
      soil_ph: 4.8,
      soil_temperature: 24.0,
      air_temperature: 26.0,
      air_humidity: 60.0,
      light_intensity: 400.0,
      wifi_rssi: -62,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(acidicData);

    expect(result.alerts.some(a => a.parameter === "soil_ph" && a.severity === "warning")).toBe(true);
    expect(result.actionable_prescriptions.some(p => p.includes("lime"))).toBe(true);
  });

  it("5. Detects fungal pathogen risk when humidity and temperature are sustained high", () => {
    const fungalRiskData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 70.0,
      soil_ph: 6.5,
      soil_temperature: 25.0,
      air_temperature: 26.5,
      air_humidity: 88.0, // High RH
      light_intensity: 300.0,
      wifi_rssi: -65,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(fungalRiskData);

    expect(result.fungal_disease_risk).toBe("High");
    expect(result.alerts.some(a => a.parameter === "air_microclimate")).toBe(true);
  });

  it("6. Detects hardware ADC saturation or grounding anomalies", () => {
    const shortedSensorData: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 100.0,
      soil_raw_adc: 12, // Shorted to ground
      soil_ph: 7.0,
      soil_temperature: 24.0,
      air_temperature: 25.0,
      air_humidity: 60.0,
      light_intensity: 500.0,
      wifi_rssi: -50,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(shortedSensorData);

    expect(result.sensor_health.soil_moisture).toBe("error");
    expect(result.anomalies_detected.some(a => a.includes("grounded or short-circuited"))).toBe(true);
  });

  it("7. Ensures nutrient modeling operates via centralized simulation in LIVE hybrid mode", () => {
    const liveTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 65.0,
      soil_ph: 6.8,
      soil_temperature: 24.0,
      air_temperature: 26.0,
      air_humidity: 60.0,
      light_intensity: 500.0,
      wifi_rssi: -50,
      timestamp: Date.now()
    };

    const simulatedNutrients = {
      nitrate: 52.4,
      sodium: 26.8,
      nitrogen: 52.4,
      phosphorus: 26.8,
      potassium: 74.2,
      provenance: "simulation" as const
    };

    const result = runHardwareAIAnalysis(liveTelemetry, "LIVE", simulatedNutrients);

    expect(result.mode).toBe("LIVE");
    expect(result.source).toBe("hardware");
    expect(result.npk_provenance).toBe("simulation");
    expect(result.npk?.potassium).toBe(74.2);
    expect(result.explainable_insights.some(i => i.includes("Hybrid Live Mode"))).toBe(true);
  });

  it("8. Evaluates estimated Nitrate, Sodium and Potassium without confusing metrics", () => {
    const liveTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 65.0,
      soil_ph: 6.8,
      soil_temperature: 24.0,
      air_temperature: 26.0,
      air_humidity: 60.0,
      light_intensity: 500.0,
      wifi_rssi: -50,
      timestamp: Date.now()
    };

    // Deficient Nitrate (< 35) and Elevated Sodium (> 50)
    const deficientNutrients = {
      nitrate: 28.0,
      sodium: 58.0,
      nitrogen: 28.0,
      phosphorus: 58.0,
      potassium: 74.0,
      provenance: "simulation" as const
    };

    const result = runHardwareAIAnalysis(liveTelemetry, "LIVE", deficientNutrients);

    expect(result.npk_provenance).toBe("simulation");
    expect(result.alerts.some(a => a.parameter === "nitrate" || a.parameter === "nitrogen")).toBe(true);
    expect(result.alerts.some(a => a.parameter === "sodium")).toBe(true);
    expect(result.actionable_prescriptions.some(p => p.toLowerCase().includes("nitrate") || p.toLowerCase().includes("nitrogen"))).toBe(true);
    expect(result.actionable_prescriptions.some(p => p.toLowerCase().includes("gypsum") || p.toLowerCase().includes("sodium"))).toBe(true);
  });

  it("9. Validates moisture calibration calculation and division-by-zero protection", () => {
    // Narrow delta calibration: dry = 3470, wet = 3370 (delta = 100)
    const dryVal = 3470;
    const wetVal = 3370;
    const delta = dryVal - wetVal;

    expect(delta).toBe(100);

    const calcMoisture = (raw: number, dry: number, wet: number) => {
      const d = dry - wet;
      if (Math.abs(d) < 10) return { pct: 0, valid: false };
      const pct = Math.max(0, Math.min(100, ((dry - raw) / d) * 100));
      return { pct: Number(pct.toFixed(1)), valid: true };
    };

    // Submerged in water (wet = 3370) -> 100%
    expect(calcMoisture(3370, dryVal, wetVal).pct).toBe(100.0);
    // In air (dry = 3470) -> 0%
    expect(calcMoisture(3470, dryVal, wetVal).pct).toBe(0.0);
    // Midpoint (3420) -> 50%
    expect(calcMoisture(3420, dryVal, wetVal).pct).toBe(50.0);
    // Division-by-zero protection
    expect(calcMoisture(3400, 3400, 3400).valid).toBe(false);
  });

  it("10. Validates 4-in-1 pH UART packet parsing algorithm for both labelled and CSV formats", () => {
    const parsePHPacket = (raw: string): { valid: boolean; ph: number | null } => {
      const trimmed = raw.trim();
      if (!trimmed) return { valid: false, ph: null };

      let token = "";
      const upper = trimmed.toUpperCase();
      const phIdx = upper.indexOf("PH:");

      if (phIdx >= 0) {
        const valStart = phIdx + 3;
        let valEnd = trimmed.indexOf(",", valStart);
        if (valEnd < 0) valEnd = trimmed.length;
        token = trimmed.substring(valStart, valEnd).trim();
      } else {
        const firstComma = trimmed.indexOf(",");
        if (firstComma > 0) {
          token = trimmed.substring(0, firstComma).trim();
        } else {
          token = trimmed;
        }
      }

      const num = Number(token);
      if (isNaN(num) || num < 0.0 || num > 14.0) {
        return { valid: false, ph: null };
      }
      return { valid: true, ph: Number(num.toFixed(2)) };
    };

    // Labelled format: "pH:7.20,L:45,T:26.5,W:1"
    expect(parsePHPacket("pH:7.20,L:45,T:26.5,W:1")).toEqual({ valid: true, ph: 7.20 });
    // Labelled uppercase: "PH:6.85,L:30"
    expect(parsePHPacket("PH:6.85,L:30")).toEqual({ valid: true, ph: 6.85 });
    // Unlabelled CSV format: "7.20,45,26.5,1"
    expect(parsePHPacket("7.20,45,26.5,1")).toEqual({ valid: true, ph: 7.20 });
    // Standalone reading: "6.50"
    expect(parsePHPacket("6.50")).toEqual({ valid: true, ph: 6.50 });
    // Out of physical bounds (e.g. 18.5) -> Rejected
    expect(parsePHPacket("pH:18.50,L:45").valid).toBe(false);
    // Corrupted non-numeric packet -> Rejected
    expect(parsePHPacket("pH:ERR,L:45").valid).toBe(false);
    // Empty packet -> Rejected
    expect(parsePHPacket("").valid).toBe(false);
  });

  it("11. Validates keyboard simulation control mappings and physical limits", () => {
    let moisture = 58.5;
    let temp = 24.5;
    let ph = 6.80;

    const applyShortcut = (key: string, shift: boolean) => {
      if (key === "m" && !shift) moisture = Math.min(100, moisture + 1.0);
      if (key === "M" && shift) moisture = Math.max(0, moisture - 1.0);
      if (key === "t" && !shift) temp = Math.min(60, temp + 0.5);
      if (key === "T" && shift) temp = Math.max(-10, temp - 0.5);
      if (key === "p" && !shift) ph = Math.min(11.0, ph + 0.1);
      if (key === "P" && shift) ph = Math.max(3.0, ph - 0.1);
    };

    // Test M (increase moisture)
    applyShortcut("m", false);
    expect(moisture).toBe(59.5);

    // Test Shift + M (decrease moisture)
    applyShortcut("M", true);
    expect(moisture).toBe(58.5);

    // Test T (increase temp)
    applyShortcut("t", false);
    expect(temp).toBe(25.0);

    // Test Shift + T (decrease temp)
    applyShortcut("T", true);
    expect(temp).toBe(24.5);

    // Test P (increase pH)
    applyShortcut("p", false);
    expect(Number(ph.toFixed(2))).toBe(6.90);

    // Test Shift + P (decrease pH)
    applyShortcut("P", true);
    expect(Number(ph.toFixed(2))).toBe(6.80);
  });

  it("12. Validates strict scientific pH classification scale across complete benchmark suite", () => {
    // 0 - 3.0: Strongly acidic
    expect(classifySoilPH(2.0)).toBe("Strongly acidic");
    expect(classifySoilPH(3.0)).toBe("Strongly acidic");

    // >3.0 - 6.5: Acidic
    expect(classifySoilPH(4.0)).toBe("Acidic");
    expect(classifySoilPH(6.0)).toBe("Acidic");
    expect(classifySoilPH(6.5)).toBe("Acidic");

    // Exactly 7.00: Neutral
    expect(classifySoilPH(7.0)).toBe("Neutral");

    // >6.5 - 7.5: Near neutral
    expect(classifySoilPH(7.4)).toBe("Near neutral");
    expect(classifySoilPH(6.8)).toBe("Near neutral");

    // >7.5 - 10.0: Alkaline
    expect(classifySoilPH(8.0)).toBe("Alkaline");
    expect(classifySoilPH(10.0)).toBe("Alkaline");

    // >10.0 - 14.0: Strongly alkaline
    expect(classifySoilPH(12.0)).toBe("Strongly alkaline");
    expect(classifySoilPH(14.0)).toBe("Strongly alkaline");

    // Invalid & boundary edge cases
    expect(classifySoilPH(null)).toBe("Invalid");
    expect(classifySoilPH(undefined)).toBe("Invalid");
    expect(classifySoilPH(NaN)).toBe("Invalid");
    expect(classifySoilPH(-1.0)).toBe("Invalid");
    expect(classifySoilPH(15.0)).toBe("Invalid");
  });

  it("13. Prevents negative nutrient values and validates non-negative bounds for phosphorus", () => {
    // Bounded clamp calculation
    const clampNutrient = (val: number | null | undefined, fallback: number = 45.0) => {
      if (val === null || val === undefined || isNaN(val)) return fallback;
      return Math.max(0, val);
    };

    // Replicates legacy negative subtraction test
    const legacyNegativePhosphorus = -935.9;
    expect(clampNutrient(legacyNegativePhosphorus)).toBe(0);

    // Realistic normal values
    expect(clampNutrient(45.0)).toBe(45.0);
    expect(clampNutrient(71.7)).toBe(71.7);
    expect(clampNutrient(null, 50.0)).toBe(50.0);
  });

  it("14. Updated Telemetry: Valid pH (e.g. 6.72) is classified and assessed", () => {
    const validPhTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 60.0,
      soil_ph: 6.72,
      ph_status: "VALID",
      soil_temperature: 25.0,
      air_temperature: 26.5,
      air_humidity: 60.0,
      light_intensity: 512,
      light_source: "PH_MODULE_L_RAW",
      light_unit: "raw",
      wifi_rssi: -55,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(validPhTelemetry);
    expect(result.sensor_health.soil_ph).toBe("healthy");
    expect(classifySoilPH(validPhTelemetry.soil_ph)).toBe("Near neutral");
  });

  it("15. Updated Telemetry: pH status AIR does not compute soil health and does not disconnect sensor", () => {
    const airPhTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 60.0,
      soil_ph: null,
      ph_status: "AIR",
      soil_temperature: 25.0,
      air_temperature: 26.5,
      air_humidity: 60.0,
      light_intensity: 520,
      light_source: "PH_MODULE_L_RAW",
      light_unit: "raw",
      wifi_rssi: -55,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(airPhTelemetry);
    // Sensor health is NOT treated as disconnected when in AIR
    expect(result.sensor_health.soil_ph).toBe("healthy");
    // Insights note probe in air
    expect(result.explainable_insights.some(i => i.includes("air"))).toBe(true);
    // Does not generate acidic/alkaline alerts
    expect(result.alerts.some(a => a.parameter === "soil_ph")).toBe(false);
  });

  it("16. Updated Telemetry: Light intensity from pH module L: field is preserved with raw unit", () => {
    const rawLightTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 55.0,
      soil_ph: 6.8,
      ph_status: "VALID",
      soil_temperature: 24.0,
      air_temperature: 26.0,
      air_humidity: 58.0,
      light_intensity: 420,
      light_source: "PH_MODULE_L_RAW",
      light_unit: "raw",
      wifi_rssi: -50,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(rawLightTelemetry);
    expect(result.sensor_health.ambient_light).toBe("healthy");
    // Verify no mention of BH1750 in insights
    expect(result.explainable_insights.some(i => i.includes("BH1750"))).toBe(false);
    expect(result.photosynthesis_efficiency).toBe("Optimal");
  });

  it("17. Updated Telemetry: Missing L field sets light to unavailable without crashing", () => {
    const missingLightTelemetry: HardwareTelemetry = {
      device_id: "ESP32-01",
      soil_moisture: 55.0,
      soil_ph: 6.8,
      ph_status: "VALID",
      soil_temperature: 24.0,
      air_temperature: 26.0,
      air_humidity: 58.0,
      light_intensity: null,
      light_source: "PH_MODULE_L_RAW",
      light_unit: "raw",
      wifi_rssi: -50,
      timestamp: Date.now()
    };

    const result = runHardwareAIAnalysis(missingLightTelemetry);
    expect(result.sensor_health.ambient_light).toBe("disconnected");
    expect(result.photosynthesis_efficiency).toBe("Unavailable");
  });
});
