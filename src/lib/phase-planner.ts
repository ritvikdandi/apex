import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateFfmi } from '@/lib/ffmi';
import { supabase } from '@/lib/supabase';
import type { Sex } from '@/lib/tdee-engine';

export type PhaseType = 'cut' | 'recomp' | 'lean_bulk' | 'aggressive_bulk';

export type PhaseRates = {
  weightLbPerWeek: number;
  bodyFatPercentPerWeek: number;
  calorieOffset: number;
};

export const PHASE_RATES: Record<PhaseType, PhaseRates> = {
  cut: { weightLbPerWeek: -0.6, bodyFatPercentPerWeek: -0.3, calorieOffset: -300 },
  recomp: { weightLbPerWeek: 0, bodyFatPercentPerWeek: -0.1, calorieOffset: 0 },
  lean_bulk: { weightLbPerWeek: 0.4, bodyFatPercentPerWeek: 0.1, calorieOffset: 200 },
  aggressive_bulk: { weightLbPerWeek: 0.8, bodyFatPercentPerWeek: 0.3, calorieOffset: 400 },
};

export const PHASE_LABELS: Record<PhaseType, string> = {
  cut: 'cut',
  recomp: 'recomp',
  lean_bulk: 'lean bulk',
  aggressive_bulk: 'aggressive bulk',
};

export type PhaseSegment = { phase: PhaseType; weeks: number };

export type PhaseScenario = {
  id: string;
  name: string;
  breakdown: string;
  segments: PhaseSegment[];
};

export const PHASE_SCENARIOS: PhaseScenario[] = [
  {
    id: 'cut-lean-bulk',
    name: 'Cut & Lean Bulk',
    breakdown: '3 week cut → 7 week lean bulk',
    segments: [{ phase: 'cut', weeks: 3 }, { phase: 'lean_bulk', weeks: 7 }],
  },
  {
    id: 'recomp',
    name: 'Steady Recomp',
    breakdown: '10 week recomp',
    segments: [{ phase: 'recomp', weeks: 10 }],
  },
  {
    id: 'lean-bulk',
    name: 'Lean Bulk',
    breakdown: '10 week lean bulk',
    segments: [{ phase: 'lean_bulk', weeks: 10 }],
  },
  {
    id: 'cut-recomp',
    name: 'Cut & Recomp',
    breakdown: '4 week cut → 6 week recomp',
    segments: [{ phase: 'cut', weeks: 4 }, { phase: 'recomp', weeks: 6 }],
  },
  {
    id: 'aggressive-bulk',
    name: 'Aggressive Bulk',
    breakdown: '8 week aggressive bulk',
    segments: [{ phase: 'aggressive_bulk', weeks: 8 }],
  },
  {
    id: 'cut-aggressive-bulk',
    name: 'Cut & Aggressive Bulk',
    breakdown: '4 week cut → 8 week aggressive bulk',
    segments: [{ phase: 'cut', weeks: 4 }, { phase: 'aggressive_bulk', weeks: 8 }],
  },
];

export type ScenarioProjection = {
  scenario: PhaseScenario;
  projectedWeightLb: number;
  projectedBodyFatPercent: number;
  projectedFfmi: number;
  phaseCalories: { phase: PhaseType; calories: number }[];
  totalWeeks: number;
};

const BF_LIMIT: Record<Sex, number> = { male: 20, female: 28 };

export function projectScenario(
  scenario: PhaseScenario,
  profile: { weightLb: number; heightIn: number; bodyFatPercent: number },
  tdee: number
): ScenarioProjection {
  let weight = profile.weightLb;
  let bodyFat = profile.bodyFatPercent;

  for (const segment of scenario.segments) {
    const rates = PHASE_RATES[segment.phase];
    weight += rates.weightLbPerWeek * segment.weeks;
    bodyFat = Math.max(3, bodyFat + rates.bodyFatPercentPerWeek * segment.weeks);
  }

  const { normalizedFfmi } = calculateFfmi({ weightLb: weight, heightIn: profile.heightIn, bodyFatPercent: bodyFat });

  return {
    scenario,
    projectedWeightLb: weight,
    projectedBodyFatPercent: bodyFat,
    projectedFfmi: normalizedFfmi,
    phaseCalories: scenario.segments.map((segment) => ({
      phase: segment.phase,
      calories: Math.round(tdee + PHASE_RATES[segment.phase].calorieOffset),
    })),
    totalWeeks: scenario.segments.reduce((sum, segment) => sum + segment.weeks, 0),
  };
}

export function isScenarioWithinBfLimit(projection: ScenarioProjection, sex: Sex): boolean {
  return projection.projectedBodyFatPercent <= BF_LIMIT[sex];
}

export type WeightLogRow = { weightLbs: number; loggedAt: string };
export type FoodLogCalorieRow = { calories: number; loggedAt: string };

export async function getWeightLogs(userId: string): Promise<WeightLogRow[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight_lbs, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true });

  if (error) {
    console.log('[PhasePlanner] weight logs error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({ weightLbs: row.weight_lbs, loggedAt: row.logged_at }));
}

export async function getFoodLogCalories(userId: string): Promise<FoodLogCalorieRow[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select('calories, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: true });

  if (error) {
    console.log('[PhasePlanner] food logs error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({ calories: row.calories, loggedAt: row.logged_at }));
}

export type WeeklyFeedback = { message: string; createdAt: string };

export async function getLatestWeeklyFeedback(userId: string): Promise<WeeklyFeedback | null> {
  const { data, error } = await supabase
    .from('weekly_feedback')
    .select('message, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log('[PhasePlanner] weekly feedback error:', error.message);
    return null;
  }
  if (!data) return null;

  return { message: data.message, createdAt: data.created_at };
}

const ACTIVE_PLAN_KEY = 'apex:active-plan';

export async function saveActivePlan(scenario: PhaseScenario): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(scenario));
}

export async function loadActivePlan(): Promise<PhaseScenario | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PhaseScenario;
  } catch {
    return null;
  }
}
