import AsyncStorage from '@react-native-async-storage/async-storage';

import { callClaude, parseJsonFromClaude } from '@/lib/claude';
import type { Macros } from '@/lib/food-log';
import { describeIngredient } from '@/lib/recipes';
import type { UserIngredient } from '@/lib/ingredients';

export type MealSlot = 'breakfast' | 'snack' | 'lunch' | 'dinner';

export type PlannedMeal = {
  slot: MealSlot;
  name: string;
  prepTime: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  instructions: string[];
  logged: boolean;
};

type RawMeal = {
  slot: MealSlot;
  name: string;
  prep_time?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  instructions: string[];
};

function rawToMeal(raw: RawMeal): PlannedMeal {
  return {
    slot: raw.slot,
    name: raw.name,
    prepTime: raw.prep_time ?? '',
    calories: Number(raw.calories) || 0,
    proteinG: Number(raw.protein_g) || 0,
    carbsG: Number(raw.carbs_g) || 0,
    fatG: Number(raw.fat_g) || 0,
    ingredients: raw.ingredients ?? [],
    instructions: raw.instructions ?? [],
    logged: false,
  };
}

function macrosLine(macros: Macros): string {
  return (
    `${Math.round(macros.calories)} cal, ${Math.round(macros.proteinG)}g protein, ` +
    `${Math.round(macros.carbsG)}g carbs, ${Math.round(macros.fatG)}g fat`
  );
}

const MEAL_PLAN_SYSTEM_PROMPT =
  'You are a full-day meal plan generator for a fitness and nutrition app. ' +
  'Generate exactly 5 meals for one day, in this exact order: breakfast, snack, lunch, snack, dinner. ' +
  'Strict rules: ' +
  '1. Only use ingredients from the pantry list provided (salt, pepper, water, and cooking oil may always be assumed available). ' +
  '2. Use realistic, strict portion sizes. ' +
  "3. Follow the user's eating preferences exactly if provided. " +
  '4. Never repeat the same primary ingredient across meals unless the user explicitly asked for repetition. ' +
  '5. Distribute the daily calorie target roughly as: breakfast 25%, snack 15%, lunch 30%, snack 15%, dinner 25%. ' +
  '6. Each instruction step string must NOT include its own number or prefix (the UI numbers them automatically). ' +
  'Respond with ONLY a JSON array of exactly 5 objects, no markdown, no commentary: ' +
  '[{"slot": "breakfast"|"snack"|"lunch"|"dinner", "name": string, "prep_time": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "ingredients": string[], "instructions": string[]}]';

export async function generateMealPlan(
  pantryIngredients: UserIngredient[],
  dailyMacros: Macros,
  preferences: string
): Promise<PlannedMeal[]> {
  const pantryText = pantryIngredients.length
    ? pantryIngredients.map(describeIngredient).join('\n')
    : '(empty — assume only basic pantry staples like salt, pepper, oil, water)';

  const prompt =
    `Pantry:\n${pantryText}\n\n` +
    `Daily targets: ${macrosLine(dailyMacros)}.\n\n` +
    (preferences.trim()
      ? `User's eating preferences: ${preferences.trim()}`
      : 'User has no specific eating preferences.');

  const raw = await callClaude(prompt, MEAL_PLAN_SYSTEM_PROMPT, 3000, 'generateMealPlan');
  const parsed = parseJsonFromClaude<RawMeal[]>(raw);
  if (!parsed) return [];
  return parsed.map(rawToMeal);
}

const STORAGE_PREFIX = 'apex:meal-plan:';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveMealPlan(meals: PlannedMeal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_PREFIX + todayDate(), JSON.stringify(meals));
}

export async function loadMealPlan(): Promise<PlannedMeal[] | null> {
  const raw = await AsyncStorage.getItem(STORAGE_PREFIX + todayDate());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlannedMeal[];
  } catch {
    return null;
  }
}
