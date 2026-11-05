/**
 * TRINEXA-AI Engine: Real-Time Hardware Sensor Intelligence Pipeline
 * 
 * Provides:
 * 1. Environmental & Soil Condition Assessment
 * 2. Multi-parameter Sensor Anomaly Detection
 * 3. Crop Stress & Moisture Intelligence
 * 4. Fungal / Microclimate Disease Risk Modeling
 * 5. Explainable AI Recommendations & Actionable Insights
 */

export interface HardwareTelemetry {
  device_id: string;
  soil_moisture: number | null;
  soil_raw_adc?: number | null;
  soil_ph: number | null;
  soil_temperature: number | null;
  air_temperature: number | null;
  air_humidity: number | null;
  light_intensity: number | null;
  wifi_rssi: number | null;
  uptime_ms?: number | null;
  timestamp: number;
}

export interface SensorAlert {
  id?: number;
  device_id: string;
  parameter: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  timestamp: number;
}

export interface AIAnalysisResult {
  device_id: string;
  timestamp: number;
  overall_score: number;
  soil_status: 'Optimal' | 'Mild Stress' | 'High Stress' | 'Critical Risk';
  water_requirement: 'None' | 'Low' | 'Moderate' | 'Immediate High';
  anomalies_detected: string[];
  fungal_disease_risk: 'Low' | 'Moderate' | 'High';
  photosynthesis_efficiency: 'Low (Low Light)' | 'Optimal' | 'High (Excess Light)' | 'Unavailable';
  sensor_health: {
    soil_moisture: 'healthy' | 'warning' | 'error' | 'disconnected';
    soil_ph: 'healthy' | 'warning' | 'error' | 'disconnected';
    soil_temperature: 'healthy' | 'warning' | 'error' | 'disconnected';
    air_dht: 'healthy' | 'warning' | 'error' | 'disconnected';
    ambient_light: 'healthy' | 'warning' | 'error' | 'disconnected';
  };
  explainable_insights: string[];
  actionable_prescriptions: string[];
  alerts: SensorAlert[];
}

/**
 * Executes full AI analysis over real physical sensor readings.
 * Does NOT generate fake data when a sensor is disconnected or null.
 */
export function runHardwareAIAnalysis(data: HardwareTelemetry): AIAnalysisResult {
  const anomalies: string[] = [];
  const insights: string[] = [];
  const prescriptions: string[] = [];
  const alerts: SensorAlert[] = [];

  let healthScore = 100;
  let activeSensorsCount = 0;

  // 1. Sensor Health Diagnosis & Anomaly Detection
  const sensorHealth: AIAnalysisResult['sensor_health'] = {
    soil_moisture: data.soil_moisture !== null ? 'healthy' : 'disconnected',
    soil_ph: data.soil_ph !== null ? 'healthy' : 'disconnected',
    soil_temperature: data.soil_temperature !== null ? 'healthy' : 'disconnected',
    air_dht: (data.air_temperature !== null && data.air_humidity !== null) ? 'healthy' : 'disconnected',
    ambient_light: data.light_intensity !== null ? 'healthy' : 'disconnected'
  };

  // Check hardware electrical bounds (ADC stuck or probe open circuit)
  if (data.soil_raw_adc !== null && data.soil_raw_adc !== undefined) {
    if (data.soil_raw_adc <= 50) {
      sensorHealth.soil_moisture = 'error';
      anomalies.push('Soil moisture probe ADC grounded or short-circuited');
    } else if (data.soil_raw_adc >= 4090) {
      sensorHealth.soil_moisture = 'warning';
      anomalies.push('Soil moisture probe reading dry air ceiling (potential open pin)');
    }
  }

  // 2. Soil Moisture & Water Intelligence
  let waterReq: AIAnalysisResult['water_requirement'] = 'None';
  if (data.soil_moisture !== null) {
    activeSensorsCount++;
    const m = data.soil_moisture;
    if (m < 35) {
      healthScore -= 30;
      waterReq = 'Immediate High';
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_moisture',
        severity: 'critical',
        message: `Severe soil drought detected at ${m.toFixed(1)}%. Immediate root wilt risk.`,
        recommendation: 'Trigger primary drip irrigation line for 35 minutes.',
        timestamp: data.timestamp
      });
      insights.push(`Physical moisture probe measures critically low water content (${m.toFixed(1)}%). Cellular transpiration halted.`);
      prescriptions.push('Activate deep drip fertigation to restore volumetric soil water content above 55%.');
    } else if (m < 55) {
      healthScore -= 15;
      waterReq = 'Moderate';
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_moisture',
        severity: 'warning',
        message: `Soil moisture dropped to ${m.toFixed(1)}%. Approaching deficit threshold.`,
        recommendation: 'Schedule moderate irrigation cycle before midday heat.',
        timestamp: data.timestamp
      });
      insights.push(`Soil moisture is suboptimal (${m.toFixed(1)}%). Evapotranspiration will induce stress under high solar radiation.`);
    } else if (m > 88) {
      healthScore -= 15;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_moisture',
        severity: 'warning',
        message: `Soil saturation at ${m.toFixed(1)}%. Risk of root hypoxia / root rot.`,
        recommendation: 'Halt all irrigation and check drainage channels.',
        timestamp: data.timestamp
      });
      insights.push(`Soil is near liquid saturation (${m.toFixed(1)}%). Oxygen diffusion into root hairs restricted.`);
    } else {
      insights.push(`Soil moisture content is optimal at ${m.toFixed(1)}%.`);
    }
  } else {
    insights.push('Soil moisture probe is currently offline. Skipping hydration scoring.');
  }

  // 3. Soil pH Absorption Matrix
  if (data.soil_ph !== null) {
    activeSensorsCount++;
    const ph = data.soil_ph;
    if (ph < 5.5) {
      healthScore -= 20;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_ph',
        severity: 'warning',
        message: `Strongly acidic soil detected: pH ${ph.toFixed(2)}. Phosphorus lockup likely.`,
        recommendation: 'Incorporate agricultural limestone or calcium carbonate.',
        timestamp: data.timestamp
      });
      insights.push(`Soil pH (${ph.toFixed(2)}) is strongly acidic. Micronutrient toxicity (Al/Mn) and Phosphorus fixation risk.`);
      prescriptions.push('Apply agricultural lime (calcitic limestone) at 50kg/acre to elevate pH towards 6.5.');
    } else if (ph > 7.8) {
      healthScore -= 20;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_ph',
        severity: 'warning',
        message: `Alkaline soil detected: pH ${ph.toFixed(2)}. Micronutrient availability restricted.`,
        recommendation: 'Apply elemental sulfur or acidifying organic compost.',
        timestamp: data.timestamp
      });
      insights.push(`Alkaline pH (${ph.toFixed(2)}) restricts Iron, Zinc, and Manganese bio-availability.`);
      prescriptions.push('Introduce elemental sulfur or gypsum to balance soil alkalinity.');
    } else {
      insights.push(`Soil pH is well-balanced (${ph.toFixed(2)}), supporting optimal root cation-exchange capacity.`);
    }
  }

  // 4. Soil Temperature (DS18B20 OneWire)
  if (data.soil_temperature !== null) {
    activeSensorsCount++;
    const st = data.soil_temperature;
    if (st > 34) {
      healthScore -= 15;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_temperature',
        severity: 'warning',
        message: `High soil temperature: ${st.toFixed(1)}°C. High microbial respiration.`,
        recommendation: 'Apply organic straw mulch to insulate topsoil.',
        timestamp: data.timestamp
      });
      insights.push(`Topsoil temperature elevated (${st.toFixed(1)}°C). Mulching recommended to protect root microbiome.`);
    } else if (st < 12) {
      healthScore -= 15;
      insights.push(`Cold soil conditions (${st.toFixed(1)}°C). Root elongation and water uptake rate diminished.`);
    }
  }

  // 5. Microclimate, Humidity & Fungal Pathogen Model (DHT22)
  let fungalRisk: AIAnalysisResult['fungal_disease_risk'] = 'Low';
  if (data.air_temperature !== null && data.air_humidity !== null) {
    activeSensorsCount++;
    const temp = data.air_temperature;
    const hum = data.air_humidity;

    // Fungal risk condition: Warm temperature + high sustained relative humidity
    if (hum > 80 && temp >= 22 && temp <= 30) {
      fungalRisk = 'High';
      healthScore -= 10;
      alerts.push({
        device_id: data.device_id,
        parameter: 'air_microclimate',
        severity: 'warning',
        message: `High fungal sporulation index (Humidity: ${hum.toFixed(1)}%, Temp: ${temp.toFixed(1)}°C).`,
        recommendation: 'Check lower leaves for downy/powdery mildew and blight spots.',
        timestamp: data.timestamp
      });
      insights.push(`Canopy microclimate presents elevated fungal spore germination risk (${hum.toFixed(1)}% RH, ${temp.toFixed(1)}°C).`);
      prescriptions.push('Maintain inter-row air circulation and inspect for Early Blight or powdery mildew.');
    } else if (hum > 70) {
      fungalRisk = 'Moderate';
    }
  }

  // 6. Ambient Light & Photosynthesis Suitability (BH1750 I2C)
  let photoEff: AIAnalysisResult['photosynthesis_efficiency'] = 'Unavailable';
  if (data.light_intensity !== null) {
    activeSensorsCount++;
    const lux = data.light_intensity;
    if (lux < 200) {
      photoEff = 'Low (Low Light)';
      insights.push(`Low ambient solar irradiance (${lux.toFixed(0)} lux). Plant is in low-photosynthesis / dark respiration state.`);
    } else if (lux <= 35000) {
      photoEff = 'Optimal';
      insights.push(`Solar irradiance (${lux.toFixed(0)} lux) is ideal for light-dependent photosynthetic reactions.`);
    } else {
      photoEff = 'High (Excess Light)';
      insights.push(`High solar irradiance (${lux.toFixed(0)} lux). Monitor canopy moisture to prevent photo-inhibition.`);
    }
  }

  // If no sensors are reporting, adjust score
  if (activeSensorsCount === 0) {
    healthScore = 0;
    insights.push('No physical sensors currently online. Live AI scoring in standby.');
  } else {
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));
  }

  let soilStatus: AIAnalysisResult['soil_status'] = 'Optimal';
  if (healthScore < 50) soilStatus = 'Critical Risk';
  else if (healthScore < 75) soilStatus = 'High Stress';
  else if (healthScore < 90) soilStatus = 'Mild Stress';

  return {
    device_id: data.device_id,
    timestamp: data.timestamp,
    overall_score: healthScore,
    soil_status: soilStatus,
    water_requirement: waterReq,
    anomalies_detected: anomalies,
    fungal_disease_risk: fungalRisk,
    photosynthesis_efficiency: photoEff,
    sensor_health: sensorHealth,
    explainable_insights: insights,
    actionable_prescriptions: prescriptions,
    alerts
  };
}

