import { describe, it, expect } from "vitest";
import { runHardwareAIAnalysis, HardwareTelemetry } from "../../server/aiEngine";

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
});

