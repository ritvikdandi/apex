const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

export type Sex = 'male' | 'female';

export type Profile = {
  weightLb: number;
  heightIn: number;
  age: number;
  sex: Sex;
};

export type DailyMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

// Mifflin-St Jeor BMR x 1.55 activity multiplier (moderately active).
export function calculateEstimatedTDEE({ weightLb, heightIn, age, sex }: Profile): number {
  const weightKg = weightLb * LB_TO_KG;
  const heightCm = heightIn * IN_TO_CM;
  const sexOffset = sex === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  return bmr * 1.55;
}

export type CalibrationConfidence = 'low' | 'medium' | 'high';

export type TrueMaintenanceResult = {
  trueMaintenance: number;
  avgCalories: number;
  weeklyWeightChangeLb: number;
  confidence: CalibrationConfidence;
  daysOfData: number;
};

type WeightLogEntry = { weightLbs: number; loggedAt: string };
type FoodLogEntry = { calories: number; loggedAt: string };

// Requires 14+ days of weight + food log data to calibrate.
export function calculateTrueMaintenance(
  weightLogs: WeightLogEntry[],
  foodLogs: FoodLogEntry[]
): TrueMaintenanceResult | null {
  if (weightLogs.length < 2 || foodLogs.length === 0) return null;

  const sortedWeights = [...weightLogs].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  const earliest = sortedWeights[0];
  const latest = sortedWeights[sortedWeights.length - 1];

  const daysOfData = Math.max(
    1,
    Math.round(
      (new Date(latest.loggedAt).getTime() - new Date(earliest.loggedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const weeks = daysOfData / 7;

  const avgCalories =
    foodLogs.reduce((sum, entry) => sum + entry.calories, 0) / foodLogs.length;
  const weeklyWeightChangeLb = (latest.weightLbs - earliest.weightLbs) / weeks;

  // ~3500 kcal per pound of bodyweight change, spread across the week.
  const trueMaintenance = avgCalories - (weeklyWeightChangeLb * 500);

  const confidence: CalibrationConfidence =
    weeks < 2 ? 'low' : weeks < 4 ? 'medium' : 'high';

  return { trueMaintenance, avgCalories, weeklyWeightChangeLb, confidence, daysOfData };
}

export function calculateDailyMacros(calories: number, weightLb: number): DailyMacros {
  const proteinG = weightLb * 1;
  const fatG = weightLb * 0.4;
  const carbsG = Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4);
  return { calories, proteinG, carbsG, fatG };
}
