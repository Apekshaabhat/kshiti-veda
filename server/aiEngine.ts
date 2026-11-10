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
  ph_status?: 'VALID' | 'AIR' | 'UNAVAILABLE';
  soil_temperature: number | null;
  air_temperature: number | null;
  air_humidity: number | null;
  light_intensity: number | null;
  light_source?: string;
  light_unit?: string;
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

export interface SimulatedNPK {
  nitrate?: number;
  sodium?: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  provenance: 'simulation';
}

export interface AIAnalysisResult {
  device_id: string;
  timestamp: number;
  mode: 'LIVE' | 'SIMULATED';
  source: 'hardware' | 'simulation';
  npk_provenance: 'simulation';
  npk?: SimulatedNPK;
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
    npk: 'simulated';
  };
  explainable_insights: string[];
  actionable_prescriptions: string[];
  alerts: SensorAlert[];
}

export type PHClassification =
  | 'Strongly acidic'
  | 'Acidic'
  | 'Neutral'
  | 'Near neutral'
  | 'Alkaline'
  | 'Strongly alkaline'
  | 'Invalid';

export function classifySoilPH(ph: number | null | undefined): PHClassification {
  if (ph === null || ph === undefined || isNaN(ph) || ph < 0.0 || ph > 14.0) {
    return 'Invalid';
  }
  if (ph <= 3.0) return 'Strongly acidic';
  if (ph <= 6.5) return 'Acidic';
  if (Math.abs(ph - 7.0) < 0.001) return 'Neutral';
  if (ph <= 7.5) return 'Near neutral';
  if (ph <= 10.0) return 'Alkaline';
  return 'Strongly alkaline';
}

/**
 * Executes full AI analysis over real physical sensor readings or simulated data.
 * Does NOT generate fake data when a physical sensor is disconnected or null.
 * 
 * NPK Handling Rule:
 * In both LIVE and SIMULATED modes, NPK data is sourced from the centralized simulation engine.
 * LIVE mode operates as a HYBRID mode: physical readings for installed sensors (moisture, pH, temp, light)
 * and simulated readings for NPK. NPK provenance is explicitly tagged as 'simulation'.
 */
export function runHardwareAIAnalysis(
  data: HardwareTelemetry,
  mode: 'LIVE' | 'SIMULATED' = 'LIVE',
  simulatedNPK?: SimulatedNPK
): AIAnalysisResult {
  const anomalies: string[] = [];
  const insights: string[] = [];
  const prescriptions: string[] = [];
  const alerts: SensorAlert[] = [];

  let healthScore = 100;
  let activeSensorsCount = 0;

  if (mode === 'LIVE') {
    insights.push('Hybrid Live Mode Active: Moisture, pH, temperature and light come from physical ESP32 sensors; NPK metrics are provided by the centralized simulation engine.');
  } else {
    insights.push('Telemetry running in centralized SIMULATED mode for demonstrations (all parameters simulated).');
  }

  // 1. Sensor Health Diagnosis & Anomaly Detection
  const sensorHealth: AIAnalysisResult['sensor_health'] = {
    soil_moisture: data.soil_moisture !== null ? 'healthy' : 'disconnected',
    soil_ph: data.ph_status === 'AIR' ? 'healthy' : (data.soil_ph !== null && data.ph_status !== 'UNAVAILABLE' ? 'healthy' : 'disconnected'),
    soil_temperature: data.soil_temperature !== null ? 'healthy' : 'disconnected',
    air_dht: (data.air_temperature !== null && data.air_humidity !== null) ? 'healthy' : 'disconnected',
    ambient_light: data.light_intensity !== null ? 'healthy' : 'disconnected',
    npk: 'simulated'
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

  // 3. Soil pH Absorption Matrix (Scientific Scale & Chemistry)
  if (data.ph_status === 'AIR') {
    // When ph_status is AIR, do not display numeric pH value, do not classify it, and do not calculate soil health using this reading
    insights.push('pH sensor probe is exposed to air. Soil reaction measurement suspended until probe is inserted into soil.');
  } else if (data.soil_ph !== null && data.ph_status !== 'UNAVAILABLE') {
    activeSensorsCount++;
    const ph = data.soil_ph;
    const classification = classifySoilPH(ph);

    if (ph <= 3.0) {
      healthScore -= 30;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_ph',
        severity: 'critical',
        message: `Strongly acidic soil detected: pH ${ph.toFixed(2)}. Severe Aluminum/Manganese toxicity and root necrosis risk.`,
        recommendation: 'Immediate incorporation of agricultural limestone or hydrated lime.',
        timestamp: data.timestamp
      });
      insights.push(`Soil pH (${ph.toFixed(2)}) is Strongly Acidic. Acute cation exchange collapse and Phosphorus lockup.`);
      prescriptions.push('Incorporate agricultural lime (calcitic limestone) at 75-100 kg/acre to restore root zone pH above 6.0.');
    } else if (ph <= 6.5) {
      if (ph < 5.8) {
        healthScore -= 15;
        alerts.push({
          device_id: data.device_id,
          parameter: 'soil_ph',
          severity: 'warning',
          message: `Acidic soil detected: pH ${ph.toFixed(2)}. Phosphorus lockup likely.`,
          recommendation: 'Incorporate agricultural limestone or calcium carbonate.',
          timestamp: data.timestamp
        });
        insights.push(`Soil pH (${ph.toFixed(2)}) is Acidic. Micronutrient fixation and reduced bacterial nitrification.`);
        prescriptions.push('Apply agricultural lime at 40-50 kg/acre to elevate pH towards near neutral.');
      } else {
        insights.push(`Soil pH (${ph.toFixed(2)}) is Acidic, suitable for moderately acid-tolerant crop rootstocks.`);
      }
    } else if (ph <= 7.5) {
      insights.push(`Soil pH (${ph.toFixed(2)}) is ${classification}, supporting optimal root cation-exchange capacity and nutrient uptake.`);
    } else if (ph <= 10.0) {
      healthScore -= 20;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_ph',
        severity: 'warning',
        message: `Alkaline soil detected: pH ${ph.toFixed(2)}. Micronutrient availability restricted.`,
        recommendation: 'Apply elemental sulfur or acidifying organic compost.',
        timestamp: data.timestamp
      });
      insights.push(`Soil pH (${ph.toFixed(2)}) is Alkaline. Restricts Iron (Fe), Zinc (Zn), and Manganese (Mn) bioavailability.`);
      prescriptions.push('Introduce elemental sulfur (25-35 kg/acre) or organic compost to balance soil alkalinity.');
    } else {
      // Strongly alkaline (> 10.0)
      healthScore -= 30;
      alerts.push({
        device_id: data.device_id,
        parameter: 'soil_ph',
        severity: 'critical',
        message: `Strongly alkaline soil detected: pH ${ph.toFixed(2)}. Severe sodicity and micronutrient lockout.`,
        recommendation: 'Apply agricultural gypsum and organic acidifiers with deep leaching.',
        timestamp: data.timestamp
      });
      insights.push(`Soil pH (${ph.toFixed(2)}) is Strongly Alkaline. Sodium carbonate accumulation and root structure degradation.`);
      prescriptions.push('Heavy application of agricultural gypsum followed by flood leaching.');
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

  // 6. Optical Light Intensity & Photosynthesis Suitability (4-in-1 Module L-Field)
  let photoEff: AIAnalysisResult['photosynthesis_efficiency'] = 'Unavailable';
  if (data.light_intensity !== null) {
    activeSensorsCount++;
    const lightVal = data.light_intensity;
    const isRaw = data.light_unit === 'raw' || data.light_source === 'PH_MODULE_L_RAW';
    const unitLabel = isRaw ? 'raw units' : 'module units';

    if (lightVal < 200) {
      photoEff = 'Low (Low Light)';
      insights.push(`Low ambient light level (${lightVal.toFixed(0)} ${unitLabel}). Plant is in low-photosynthesis / dark respiration state.`);
    } else if (lightVal <= 35000) {
      photoEff = 'Optimal';
      insights.push(`Ambient light level (${lightVal.toFixed(0)} ${unitLabel}) is ideal for light-dependent photosynthetic reactions.`);
    } else {
      photoEff = 'High (Excess Light)';
      insights.push(`High ambient light level (${lightVal.toFixed(0)} ${unitLabel}). Monitor canopy moisture to prevent photo-inhibition.`);
    }
  }

  // 7. Estimated Soil Nutrient Profile (Nitrate, Sodium, Potassium - Active in both LIVE and SIMULATED modes)
  if (simulatedNPK) {
    const nitrate = simulatedNPK.nitrate ?? simulatedNPK.nitrogen;
    const sodium = simulatedNPK.sodium ?? simulatedNPK.phosphorus;
    const potassium = simulatedNPK.potassium;

    // Nitrate (NO3-) Analysis (Estimated Baseline ~40-70 mg/kg)
    if (nitrate < 35) {
      healthScore -= 10;
      alerts.push({
        device_id: data.device_id,
        parameter: 'nitrate',
        severity: 'warning',
        message: `Low Nitrate (NO3-) estimated: ${nitrate.toFixed(1)} mg/kg. Risk of reduced vegetative vigor.`,
        recommendation: 'Apply calcium nitrate or well-decomposed organic compost fertigation.',
        timestamp: data.timestamp
      });
      insights.push(`Nitrate level (${nitrate.toFixed(1)} mg/kg) [Estimated] is low. Vegetative biomass accumulation impaired.`);
      prescriptions.push('Supplement nitrate via organic compost tea or calcium nitrate solution.');
    } else if (nitrate > 100) {
      healthScore -= 5;
      insights.push(`Nitrate level (${nitrate.toFixed(1)} mg/kg) [Estimated] is elevated. Monitor vegetative growth rate.`);
    } else {
      insights.push(`Nitrate level (${nitrate.toFixed(1)} mg/kg) [Estimated] is optimal for root nitrogen uptake.`);
    }

    // Sodium (Na+) Analysis (Estimated Baseline ~15-35 mg/kg; excessive > 50 mg/kg damages soil structure)
    if (sodium > 50) {
      healthScore -= 10;
      alerts.push({
        device_id: data.device_id,
        parameter: 'sodium',
        severity: 'warning',
        message: `Elevated Sodium (Na+) estimated: ${sodium.toFixed(1)} mg/kg. Risk of soil sodicity and crusting.`,
        recommendation: 'Apply agricultural gypsum (calcium sulfate) to displace sodium and leach root zone.',
        timestamp: data.timestamp
      });
      insights.push(`Sodium level (${sodium.toFixed(1)} mg/kg) [Estimated] is elevated. SAR and sodicity risk increased.`);
      prescriptions.push('Incorporate agricultural gypsum to displace exchangeable sodium cations.');
    } else {
      insights.push(`Sodium level (${sodium.toFixed(1)} mg/kg) [Estimated] is within safe non-sodic limits.`);
    }

    // Potassium (K+) Analysis (Estimated Baseline ~50-90 mg/kg)
    if (potassium < 45) {
      healthScore -= 8;
      alerts.push({
        device_id: data.device_id,
        parameter: 'potassium',
        severity: 'warning',
        message: `Low Potassium (K+) estimated: ${potassium.toFixed(1)} mg/kg. Stomatal regulation impaired.`,
        recommendation: 'Apply potassium sulfate (SOP) or organic wood ash.',
        timestamp: data.timestamp
      });
      insights.push(`Potassium level (${potassium.toFixed(1)} mg/kg) [Estimated] is deficient. Osmotic tolerance lowered.`);
      prescriptions.push('Incorporate potassium sulfate (SOP) to boost drought and heat resistance.');
    } else {
      insights.push(`Potassium level (${potassium.toFixed(1)} mg/kg) [Estimated] is balanced for crop osmotic regulation.`);
    }
  }

  // If no physical sensors are reporting in LIVE mode, adjust score
  if (mode === 'LIVE' && activeSensorsCount === 0) {
    healthScore = 0;
    insights.push('Physical ESP32 node offline. Live AI scoring in standby.');
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
    mode,
    source: mode === 'LIVE' ? 'hardware' : 'simulation',
    npk_provenance: 'simulation',
    npk: simulatedNPK,
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

