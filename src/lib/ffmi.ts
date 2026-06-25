const LB_TO_KG = 0.45359237;
const IN_TO_M = 0.0254;

export type FfmiInput = {
  weightLb: number;
  heightIn: number;
  bodyFatPercent: number;
};

export type FfmiResult = {
  fatFreeMassLb: number;
  ffmi: number;
  normalizedFfmi: number;
};

// FFMI = (lean mass in kg) / (height in m)^2, normalized to a 1.8m reference
// height so it's comparable across heights.
export function calculateFfmi({ weightLb, heightIn, bodyFatPercent }: FfmiInput): FfmiResult {
  const weightKg = weightLb * LB_TO_KG;
  const heightM = heightIn * IN_TO_M;
  const fatFreeMassKg = weightKg * (1 - bodyFatPercent / 100);
  const ffmi = fatFreeMassKg / (heightM * heightM);
  const normalizedFfmi = ffmi + 6.1 * (1.8 - heightM);

  return { fatFreeMassLb: fatFreeMassKg / LB_TO_KG, ffmi, normalizedFfmi };
}

export const FFMI_SCALE_MIN = 16;
export const FFMI_SCALE_MAX = 30;

export const FFMI_SCALE = [
  { label: 'Below Average', from: 16, to: 18, color: '#FF3B30' },
  { label: 'Average', from: 18, to: 20, color: '#FF9F0A' },
  { label: 'Above Average', from: 20, to: 22, color: '#FFD60A' },
  { label: 'Excellent', from: 22, to: 24, color: '#00FF87' },
  { label: 'Superior', from: 24, to: 26, color: '#30D5C8' },
  { label: 'Suspicious', from: 26, to: 28, color: '#0A84FF' },
  { label: 'Unlikely', from: 28, to: 30, color: '#BF5AF2' },
] as const;

export function categorizeFfmi(value: number): string {
  if (value < FFMI_SCALE[0].from) return FFMI_SCALE[0].label;
  const tier = FFMI_SCALE.find((entry) => value < entry.to);
  return tier ? tier.label : FFMI_SCALE[FFMI_SCALE.length - 1].label;
}
