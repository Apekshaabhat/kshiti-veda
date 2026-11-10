/**
 * TRINEXA Standardized Soil pH Chemistry & Classification Utility
 * 
 * Scientific Standard:
 * - pH < 7.0: Acidic
 * - pH = 7.0: Neutral
 * - pH > 7.0: Alkaline / Basic
 * 
 * Classification Bins:
 * - 0.0 - 3.0: Strongly acidic
 * - Above 3.0 - 6.5: Acidic
 * - Above 6.5 - 7.5: Near neutral (with exactly 7.0 being Neutral)
 * - Above 7.5 - 10.0: Alkaline
 * - Above 10.0 - 14.0: Strongly alkaline
 */

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

export function getPHRecommendation(ph: number | null | undefined): string {
  const classification = classifySoilPH(ph);
  switch (classification) {
    case 'Strongly acidic':
      return 'Critical acidity. Immediate application of agricultural calcitic lime required.';
    case 'Acidic':
      return 'Acidic soil. Apply agricultural limestone or dolomite to raise pH towards neutral.';
    case 'Neutral':
      return 'Perfect neutral balance. Ideal cation exchange capacity and nutrient availability.';
    case 'Near neutral':
      return 'Near neutral root zone. Optimal macro- and micronutrient absorption.';
    case 'Alkaline':
      return 'Alkaline soil. Apply elemental sulfur or acidifying organic compost to lower pH.';
    case 'Strongly alkaline':
      return 'Severe alkalinity/sodicity. Apply agricultural gypsum and flood leach root zone.';
    case 'Invalid':
    default:
      return 'Sensor offline or awaiting valid telemetry packet.';
  }
}

export function getPHColorClass(ph: number | null | undefined): {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
} {
  const classification = classifySoilPH(ph);
  switch (classification) {
    case 'Strongly acidic':
      return {
        badgeBg: 'bg-red-500/10',
        badgeBorder: 'border-red-500/30',
        badgeText: 'text-red-400'
      };
    case 'Acidic':
      return {
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-400'
      };
    case 'Neutral':
    case 'Near neutral':
      return {
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/30',
        badgeText: 'text-emerald-400'
      };
    case 'Alkaline':
      return {
        badgeBg: 'bg-cyan-500/10',
        badgeBorder: 'border-cyan-500/30',
        badgeText: 'text-cyan-400'
      };
    case 'Strongly alkaline':
      return {
        badgeBg: 'bg-purple-500/10',
        badgeBorder: 'border-purple-500/30',
        badgeText: 'text-purple-400'
      };
    default:
      return {
        badgeBg: 'bg-zinc-500/10',
        badgeBorder: 'border-zinc-500/30',
        badgeText: 'text-zinc-400'
      };
  }
}

