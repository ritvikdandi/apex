// Required DB tables:
//   coach_messages(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), role text, content text, created_at timestamptz default now())
//   coach_memories(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), key text, value text, created_at timestamptz default now())
//   water_bottles(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), name text, size_oz numeric, created_at timestamptz default now())
//   Optional: ALTER TABLE profiles ADD COLUMN is_paid boolean DEFAULT false;

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from '@/contexts/profile-context';
import { addFoodLog } from '@/lib/food-log';
import { getTodayFoodLogs } from '@/lib/food-log';
import { supabase } from '@/lib/supabase';
import { calculateDailyMacros, calculateEstimatedTDEE } from '@/lib/tdee-engine';
import { addWaterLog, getTodayWaterLogs } from '@/lib/water';
import { getWaterBottles } from '@/lib/water-bottles';

export type CoachMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type CoachMemory = {
  id: string;
  key: string;
  value: string;
};

export type CoachAction =
  | {
      action: 'log_food';
      data: { description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
    }
  | { action: 'log_water'; data: { amount_oz: number } }
  | {
      action: 'save_recipe';
      data: {
        name: string;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        ingredients: string[];
        instructions: string[];
      };
    }
  | { action: 'update_goal'; data: { goal_mode: string } }
  | { action: 'generate_meal_plan'; data: { preferences: string } };

const DAILY_COUNT_PREFIX = 'apex:coach:count:';
export const COACH_DAILY_LIMIT = 30;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getRecentCoachMessages(userId: string): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.log('[Coach] load messages error:', error.message);
    return [];
  }

  return (data ?? [])
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.created_at,
    }));
}

export async function saveCoachMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const { error } = await supabase.from('coach_messages').insert({ user_id: userId, role, content });
  if (error) console.log('[Coach] save message error:', error.message);
}

export async function getCoachMemories(userId: string): Promise<CoachMemory[]> {
  const { data, error } = await supabase
    .from('coach_memories')
    .select('id, key, value')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('[Coach] load memories error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({ id: row.id, key: row.key, value: row.value }));
}

export async function upsertCoachMemory(userId: string, key: string, value: string): Promise<void> {
  const { data: existing } = await supabase
    .from('coach_memories')
    .select('id')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from('coach_memories').update({ value }).eq('id', existing.id);
  } else {
    await supabase.from('coach_memories').insert({ user_id: userId, key, value });
  }
}

export async function getDailyMessageCount(): Promise<number> {
  const val = await AsyncStorage.getItem(DAILY_COUNT_PREFIX + todayStr());
  return parseInt(val ?? '0', 10);
}

export async function incrementDailyCount(): Promise<void> {
  const current = await getDailyMessageCount();
  await AsyncStorage.setItem(DAILY_COUNT_PREFIX + todayStr(), String(current + 1));
}

export async function checkIsPaid(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_paid')
      .eq('id', userId)
      .maybeSingle();
    if (error) return true; // Column not added yet — allow access
    return data?.is_paid === true;
  } catch {
    return true;
  }
}

export function parseCoachAction(text: string): { displayText: string; action: CoachAction | null } {
  const lines = text.trim().split('\n');
  const lastLine = lines[lines.length - 1].trim();

  if (lastLine.startsWith('{') && lastLine.endsWith('}')) {
    try {
      const parsed = JSON.parse(lastLine);
      if (parsed && typeof parsed.action === 'string') {
        return {
          displayText: lines.slice(0, -1).join('\n').trim(),
          action: parsed as CoachAction,
        };
      }
    } catch {
      // not a valid action block
    }
  }

  return { displayText: text, action: null };
}

export async function buildSystemPrompt(userId: string, profile: UserProfile): Promise<string> {
  const [foodLogs, waterLogs, bottles, memories] = await Promise.all([
    getTodayFoodLogs(userId),
    getTodayWaterLogs(userId),
    getWaterBottles(userId),
    getCoachMemories(userId),
  ]);

  const { data: pantryData } = await supabase
    .from('user_ingredients')
    .select('name')
    .eq('user_id', userId)
    .limit(50);
  const pantryNames = (pantryData ?? []).map((row: { name: string }) => row.name);

  const caloriesLogged = Math.round(foodLogs.reduce((s, e) => s + e.calories, 0));
  const proteinLogged = Math.round(foodLogs.reduce((s, e) => s + e.proteinG, 0));
  const waterOz = Math.round(waterLogs.reduce((s, e) => s + e.amountOz, 0));

  const tdee = calculateEstimatedTDEE({
    weightLb: profile.weightLb,
    heightIn: profile.heightIn,
    age: profile.age,
    sex: profile.sex,
  });
  const targets = calculateDailyMacros(Math.round(tdee), profile.weightLb);

  const lbmKg = profile.weightLb * (1 - profile.bodyFatPercent / 100) * 0.453592;
  const heightM = profile.heightIn * 0.0254;
  const ffmi = (lbmKg / (heightM * heightM)).toFixed(1);

  const memoriesText =
    memories.length > 0 ? memories.map((m) => `• ${m.key}: ${m.value}`).join('\n') : 'none yet';

  const bottlesLine =
    bottles.length > 0
      ? `\nWater bottles: ${bottles.map((b) => `${b.name} (${b.sizeOz}oz)`).join(', ')}`
      : '';

  return `You are Coach, an AI physique optimization assistant inside the Apex fitness app. Be concise, direct, and data-driven.

User: ${profile.name || 'User'}, ${profile.age}yo ${profile.sex}, ${profile.heightIn}in, ${profile.weightLb}lbs, ${profile.bodyFatPercent}% body fat, FFMI ${ffmi}
Goal: ${profile.goalMode ?? 'not set'} | TDEE: ${Math.round(tdee)} kcal
Targets: ${Math.round(targets.proteinG)}g protein, ${Math.round(targets.carbsG)}g carbs, ${Math.round(targets.fatG)}g fat, ${Math.round(targets.calories)} kcal
Today: ${caloriesLogged} kcal logged, ${proteinLogged}g protein, ${waterOz}oz water
Pantry: ${pantryNames.join(', ') || 'none'}${bottlesLine}
Memories:
${memoriesText}

You can take actions by appending a JSON object on the LAST line of your response (nothing after it):
{"action":"...","data":{...}}

Available actions:
- log_food: {"action":"log_food","data":{"description":"Chicken Breast 6oz","calories":280,"protein_g":52,"carbs_g":0,"fat_g":6}}
- log_water: {"action":"log_water","data":{"amount_oz":16}}
- save_recipe: {"action":"save_recipe","data":{"name":"...","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"ingredients":[],"instructions":[]}}
- update_goal: {"action":"update_goal","data":{"goal_mode":"maximize_ffmi"}}
- generate_meal_plan: {"action":"generate_meal_plan","data":{"preferences":"..."}}

When taking an action: respond naturally in text first, then put the JSON on the very last line. Never show raw JSON in your text.

For meal plan requests: check Memories for answers to these 4 questions. Ask them one at a time if unanswered:
1. Which meals are hardest to hit your targets? (breakfast/lunch/dinner/snacks)
2. Any ingredients to avoid?
3. How much time to cook per meal?
4. Any meals to repeat from last week?
Once all 4 are answered, generate using the generate_meal_plan action.

If user mentions a water bottle by name, look up oz from Water bottles and use log_water with the correct amount.`;
}

export async function executeCoachAction(
  userId: string,
  action: CoachAction,
  profile: UserProfile
): Promise<string | null> {
  try {
    switch (action.action) {
      case 'log_food': {
        const { error } = await addFoodLog(userId, {
          description: action.data.description,
          calories: action.data.calories,
          proteinG: action.data.protein_g,
          carbsG: action.data.carbs_g,
          fatG: action.data.fat_g,
        });
        if (!error) return `Logged: ${action.data.description} (${action.data.calories} kcal)`;
        return null;
      }

      case 'log_water': {
        const { error } = await addWaterLog(userId, action.data.amount_oz);
        if (!error) return `Logged: ${action.data.amount_oz}oz water`;
        return null;
      }

      case 'save_recipe': {
        const { error } = await supabase.from('saved_recipes').insert({
          user_id: userId,
          name: action.data.name,
          description: action.data.name,
          calories: action.data.calories,
          protein_g: action.data.protein_g,
          carbs_g: action.data.carbs_g,
          fat_g: action.data.fat_g,
          ingredients: action.data.ingredients ?? [],
          instructions: action.data.instructions ?? [],
        });
        if (!error) return `Saved recipe: ${action.data.name}`;
        return null;
      }

      case 'update_goal': {
        const { error } = await supabase
          .from('profiles')
          .update({ goal_mode: action.data.goal_mode })
          .eq('id', userId);
        if (!error) return `Goal updated: ${action.data.goal_mode.replace(/_/g, ' ')}`;
        return null;
      }

      case 'generate_meal_plan': {
        const { generateMealPlan, saveMealPlan } = await import('@/lib/meal-plan');
        const { data: pantryData } = await supabase
          .from('user_ingredients')
          .select(
            'id, name, brand, serving_size, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving'
          )
          .eq('user_id', userId);

        const ingredients = (pantryData ?? []).map(
          (row: Record<string, unknown>) => ({
            id: row.id as string,
            name: row.name as string,
            brand: row.brand as string | null,
            servingSize: row.serving_size as string | null,
            caloriesPerServing: row.calories_per_serving as number | null,
            proteinGPerServing: row.protein_g_per_serving as number | null,
            carbsGPerServing: row.carbs_g_per_serving as number | null,
            fatGPerServing: row.fat_g_per_serving as number | null,
          })
        );

        const tdee = calculateEstimatedTDEE({
          weightLb: profile.weightLb,
          heightIn: profile.heightIn,
          age: profile.age,
          sex: profile.sex,
        });
        const macros = calculateDailyMacros(Math.round(tdee), profile.weightLb);
        const meals = await generateMealPlan(ingredients, macros, action.data.preferences);

        if (meals.length > 0) {
          await saveMealPlan(meals);
          return 'Meal plan generated! Check the Meals tab.';
        }
        return 'Meal plan generation failed. Try again.';
      }
    }
  } catch (err) {
    console.log('[Coach] action error:', err);
  }
  return null;
}
