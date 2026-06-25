import { callClaude, callClaudeWithWebSearch, parseJsonFromClaude } from '@/lib/claude';
import type { Macros } from '@/lib/food-log';
import type { UserIngredient } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase';

export type GeneratedRecipe = {
  name: string;
  prepTime: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  instructions: string[];
};

export type SavedRecipe = GeneratedRecipe & { id: string };

export type MealOption = GeneratedRecipe & { matchPercent: number };

type RawRecipe = {
  name: string;
  prep_time?: string;
  description?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  instructions: string[];
  match_percent?: number;
};

function rawToRecipe(raw: RawRecipe): GeneratedRecipe {
  return {
    name: raw.name,
    prepTime: raw.prep_time ?? '',
    description: raw.description ?? '',
    calories: Number(raw.calories) || 0,
    proteinG: Number(raw.protein_g) || 0,
    carbsG: Number(raw.carbs_g) || 0,
    fatG: Number(raw.fat_g) || 0,
    ingredients: raw.ingredients ?? [],
    instructions: raw.instructions ?? [],
  };
}

export function describeIngredient(ingredient: UserIngredient): string {
  const parts: string[] = [ingredient.name];
  if (ingredient.brand) parts.push(`(${ingredient.brand})`);
  if (ingredient.caloriesPerServing != null) {
    parts.push(
      `— ${Math.round(ingredient.caloriesPerServing)} cal, ${Math.round(ingredient.proteinGPerServing ?? 0)}g protein, ` +
        `${Math.round(ingredient.carbsGPerServing ?? 0)}g carbs, ${Math.round(ingredient.fatGPerServing ?? 0)}g fat ` +
        `per ${ingredient.servingSize ?? 'serving'}`
    );
  }
  return `- ${parts.join(' ')}`;
}

function macrosLine(macros: Macros): string {
  return (
    `${Math.round(macros.calories)} cal, ${Math.round(macros.proteinG)}g protein, ` +
    `${Math.round(macros.carbsG)}g carbs, ${Math.round(macros.fatG)}g fat`
  );
}

const RECIPE_SYSTEM_PROMPT =
  'You are a recipe generator for a fitness and nutrition app. Generate exactly 3 distinct recipes. ' +
  'Strict rules: ' +
  '1. Only use ingredients from the pantry list provided (salt, pepper, water, and cooking oil may always be assumed available). ' +
  '2. Use realistic portion sizes. ' +
  '3. Keep any breakfast recipe under 550 calories. ' +
  '4. Aim for each recipe to fit within the remaining daily macro targets provided. ' +
  'Respond with ONLY a JSON array of 3 objects, no markdown, no commentary: ' +
  '[{"name": string, "prep_time": string, "description": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "ingredients": string[], "instructions": string[]}]';

export async function generateRecipes(
  pantryIngredients: UserIngredient[],
  remainingMacros: Macros
): Promise<GeneratedRecipe[]> {
  const pantryText = pantryIngredients.length
    ? pantryIngredients.map(describeIngredient).join('\n')
    : '(empty — assume only basic pantry staples like salt, pepper, oil, water)';

  const prompt = `Pantry:\n${pantryText}\n\nRemaining macros for today: ${macrosLine(remainingMacros)}.`;

  const raw = await callClaude(prompt, RECIPE_SYSTEM_PROMPT, 800, 'generateRecipes');
  const parsed = parseJsonFromClaude<RawRecipe[]>(raw);
  if (!parsed) return [];
  return parsed.map(rawToRecipe);
}

const MEAL_SYSTEM_PROMPT =
  'You are a meal idea generator for a fitness and nutrition app. The user describes what they want to eat. ' +
  'Generate exactly 3 meal options that fit their request and macro target. ' +
  'For each option include a "match_percent" (0-100) estimating how well its macros fit the provided target. ' +
  'Respond with ONLY a JSON array of 3 objects, no markdown, no commentary: ' +
  '[{"name": string, "prep_time": string, "description": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "ingredients": string[], "instructions": string[], "match_percent": number}]';

export async function generateMealOptions(
  query: string,
  macroTarget: Macros,
  pantryOnly: boolean,
  pantryIngredients: UserIngredient[]
): Promise<MealOption[]> {
  const pantryText = pantryIngredients.length ? pantryIngredients.map(describeIngredient).join('\n') : '(empty)';

  const prompt =
    `What the user wants to eat: ${query}\n\n` +
    `Macro target for this meal: ${macrosLine(macroTarget)}.\n\n` +
    (pantryOnly
      ? `Only use ingredients from this pantry:\n${pantryText}`
      : `The user's pantry has:\n${pantryText}\nYou may also suggest ingredients they don't have — search the web for real recipe ideas if helpful.`);

  const raw = pantryOnly
    ? await callClaude(prompt, MEAL_SYSTEM_PROMPT, 800, 'generateMealOptions')
    : await callClaudeWithWebSearch(prompt, MEAL_SYSTEM_PROMPT, 800, 'generateMealOptions');

  const parsed = parseJsonFromClaude<RawRecipe[]>(raw);
  if (!parsed) return [];
  return parsed.map((item) => ({ ...rawToRecipe(item), matchPercent: Math.round(item.match_percent ?? 0) }));
}

const DIRECTIONS_SYSTEM_PROMPT =
  'Write clear cooking instructions for a recipe given its name and ingredients, as a list of steps. ' +
  'Each step string must NOT include its own number or prefix (the UI numbers them automatically). ' +
  'Respond with ONLY a single JSON object, no markdown, no commentary: {"instructions": string[]}.';

export async function generateDirections(name: string, ingredients: string[]): Promise<string[]> {
  const prompt = `Recipe: ${name}\nIngredients:\n${ingredients.map((item) => `- ${item}`).join('\n')}`;
  const raw = await callClaude(prompt, DIRECTIONS_SYSTEM_PROMPT, 200, 'generateDirections');
  const parsed = parseJsonFromClaude<{ instructions: string[] }>(raw);
  return parsed?.instructions ?? [];
}

export async function getSavedRecipes(userId: string): Promise<SavedRecipe[]> {
  const { data, error } = await supabase
    .from('saved_recipes')
    .select('id, name, description, ingredients, instructions, calories, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[Recipes] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prepTime: '',
    description: row.description ?? '',
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    ingredients: (row.ingredients as string[]) ?? [],
    instructions: (row.instructions as string[]) ?? [],
  }));
}

export async function saveRecipe(userId: string, recipe: GeneratedRecipe): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_recipes').insert({
    user_id: userId,
    name: recipe.name,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    calories: recipe.calories,
    protein_g: recipe.proteinG,
    carbs_g: recipe.carbsG,
    fat_g: recipe.fatG,
  });

  if (error) {
    console.log('[Recipes] save error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteSavedRecipe(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_recipes').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    console.log('[Recipes] delete error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

// Extracts the gram weight from a serving-size string like "28g" or "1 oz (28g, about 23 almonds)".
export function parseServingGrams(servingSize: string | null): number | null {
  if (!servingSize) return null;
  const match = servingSize.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  return match ? Number(match[1]) : null;
}
