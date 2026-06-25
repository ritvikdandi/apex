import { callClaude, parseJsonFromClaude } from '@/lib/claude';
import { supabase } from '@/lib/supabase';

export type Macros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FoodLogEntry = Macros & {
  id: string;
  description: string;
  loggedAt: string;
};

export type SavedRecipe = Macros & {
  id: string;
  name: string;
  description: string | null;
};

const PARSE_SYSTEM_PROMPT =
  'You parse natural-language food descriptions into nutrition estimates. ' +
  'Respond with ONLY a single JSON object, no markdown, no commentary: ' +
  '{"description": string (4 words max, Title Case), "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}. ' +
  'Use realistic USDA-based estimates for the portions described.';

type ParsedFood = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type PendingFoodEntry = {
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export async function parseFoodDescription(input: string): Promise<PendingFoodEntry | null> {
  const raw = await callClaude(input, PARSE_SYSTEM_PROMPT, 400, 'parseFoodDescription');
  const parsed = parseJsonFromClaude<ParsedFood>(raw);
  if (!parsed) return null;

  return {
    description: parsed.description,
    calories: Number(parsed.calories) || 0,
    proteinG: Number(parsed.protein_g) || 0,
    carbsG: Number(parsed.carbs_g) || 0,
    fatG: Number(parsed.fat_g) || 0,
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayFoodLogs(userId: string): Promise<FoodLogEntry[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select('id, description, calories, protein_g, carbs_g, fat_g, logged_at')
    .eq('user_id', userId)
    .eq('logged_at', todayDate())
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[FoodLog] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    loggedAt: row.logged_at,
  }));
}

export async function addFoodLog(
  userId: string,
  entry: PendingFoodEntry
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('food_logs').insert({
    user_id: userId,
    description: entry.description,
    calories: entry.calories,
    protein_g: entry.proteinG,
    carbs_g: entry.carbsG,
    fat_g: entry.fatG,
    logged_at: todayDate(),
  });

  if (error) {
    console.log('[FoodLog] insert error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function saveRecipeFromEntry(
  userId: string,
  entry: PendingFoodEntry
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_recipes').insert({
    user_id: userId,
    name: entry.description,
    description: entry.description,
    ingredients: [],
    instructions: [],
    calories: entry.calories,
    protein_g: entry.proteinG,
    carbs_g: entry.carbsG,
    fat_g: entry.fatG,
  });

  if (error) {
    console.log('[SavedRecipes] insert error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function getSavedRecipes(userId: string): Promise<SavedRecipe[]> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .select('id, name, description, calories, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[SavedRecipes] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
  }));
}

export async function deleteFoodLog(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    console.log('[FoodLog] delete error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function logRecipe(userId: string, recipe: SavedRecipe): Promise<{ error: string | null }> {
  return addFoodLog(userId, {
    description: recipe.name,
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
  });
}
