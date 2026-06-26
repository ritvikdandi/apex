import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { calculateEstimatedTDEE, type Profile } from '@/lib/tdee-engine';

export type DayData = {
  protein: boolean;
  water: boolean;
  logging: boolean;
  calories: boolean;
};

export type Streaks = {
  protein: number;
  water: number;
  logging: number;
};

const DAY_KEY_PREFIX = 'apex:day:';
const FFMI_PREV_CATEGORY_KEY = 'apex:ffmi-prev-category';
const FFMI_CELEBRATED_KEY = 'apex:ffmi-celebrated';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon
  const daysToMon = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysToMon);
  return d.toISOString().slice(0, 10);
}

async function getDayData(dateStr: string): Promise<DayData | null> {
  const raw = await AsyncStorage.getItem(DAY_KEY_PREFIX + dateStr);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DayData;
  } catch {
    return null;
  }
}

export async function updateTodayData(data: DayData): Promise<void> {
  await AsyncStorage.setItem(DAY_KEY_PREFIX + todayStr(), JSON.stringify(data));
}

export async function checkTodayTargets(
  userId: string,
  profile: Profile
): Promise<DayData> {
  const today = todayStr();

  const [{ data: foodData }, { data: waterData }] = await Promise.all([
    supabase
      .from('food_logs')
      .select('protein_g, calories')
      .eq('user_id', userId)
      .eq('logged_at', today),
    supabase
      .from('water_logs')
      .select('amount_oz')
      .eq('user_id', userId)
      .eq('logged_at', today),
  ]);

  const foodRows = foodData ?? [];
  const waterRows = waterData ?? [];

  const totalProtein = foodRows.reduce((s, r) => s + (r.protein_g ?? 0), 0);
  const totalCalories = foodRows.reduce((s, r) => s + (r.calories ?? 0), 0);
  const totalWater = waterRows.reduce((s, r) => s + (r.amount_oz ?? 0), 0);

  const tdee = calculateEstimatedTDEE(profile);
  const proteinTarget = profile.weightLb; // 1g per lb
  const waterTarget = profile.weightLb * 0.5; // 0.5oz per lb

  return {
    logging: foodRows.length > 0,
    protein: totalProtein >= proteinTarget,
    water: totalWater >= waterTarget,
    calories: totalCalories >= tdee * 0.9 && totalCalories <= tdee * 1.1 && totalCalories > 0,
  };
}

export async function calculateStreaks(): Promise<Streaks> {
  const today = todayStr();

  // Pre-fetch last 60 days in parallel
  const dates = Array.from({ length: 60 }, (_, i) => subtractDays(today, i));
  const rawValues = await Promise.all(dates.map((d) => AsyncStorage.getItem(DAY_KEY_PREFIX + d)));

  const dayMap = new Map<string, DayData | null>(
    rawValues.map((raw, i) => [
      dates[i],
      raw
        ? (() => {
            try {
              return JSON.parse(raw) as DayData;
            } catch {
              return null;
            }
          })()
        : null,
    ])
  );

  const keys: (keyof Streaks)[] = ['protein', 'water', 'logging'];
  const streaks: Streaks = { protein: 0, water: 0, logging: 0 };

  for (const key of keys) {
    for (const date of dates) {
      const data = dayMap.get(date);
      if (!data || !data[key]) break;
      streaks[key]++;
    }
  }

  return streaks;
}

export async function calculateWeeklyConsistency(): Promise<number | null> {
  const today = todayStr();
  const weekStart = getWeekStart(today);

  // Get all days from Monday to today
  const days: string[] = [];
  let cur = weekStart;
  while (cur <= today) {
    days.push(cur);
    const d = new Date(cur + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }

  if (days.length === 0) return null;

  const rawValues = await Promise.all(days.map((d) => AsyncStorage.getItem(DAY_KEY_PREFIX + d)));

  let hitCount = 0;
  let knownCount = 0;

  for (const raw of rawValues) {
    if (!raw) continue; // No data for this day yet
    knownCount++;
    try {
      const data = JSON.parse(raw) as DayData;
      if (data.protein && data.water && data.calories) hitCount++;
    } catch {
      // skip
    }
  }

  if (knownCount === 0) return null;
  return Math.round((hitCount / knownCount) * 100);
}

// Returns the category name to celebrate if FFMI just crossed into a new milestone, else null
export async function checkFfmiMilestone(category: string): Promise<string | null> {
  const ORDER = ['Below Average', 'Average', 'Above Average', 'Excellent', 'Superior', 'Suspicious', 'Unlikely'];

  const prevCategory = await AsyncStorage.getItem(FFMI_PREV_CATEGORY_KEY);

  if (prevCategory === null) {
    await AsyncStorage.setItem(FFMI_PREV_CATEGORY_KEY, category);
    return null;
  }

  if (prevCategory !== category) {
    await AsyncStorage.setItem(FFMI_PREV_CATEGORY_KEY, category);

    const prevIdx = ORDER.indexOf(prevCategory);
    const currIdx = ORDER.indexOf(category);

    if (currIdx > prevIdx && currIdx >= 0 && prevIdx >= 0) {
      const rawCelebrated = await AsyncStorage.getItem(FFMI_CELEBRATED_KEY);
      const celebrated: string[] = rawCelebrated ? JSON.parse(rawCelebrated) : [];

      if (!celebrated.includes(category)) {
        celebrated.push(category);
        await AsyncStorage.setItem(FFMI_CELEBRATED_KEY, JSON.stringify(celebrated));
        return category;
      }
    }
  }

  return null;
}
