import { callClaude, parseJsonFromClaude } from '@/lib/claude';
import { supabase } from '@/lib/supabase';

export type IngredientResult = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string | null;
  caloriesPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
  isAiEstimate?: boolean;
};

export type UserIngredient = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string | null;
  caloriesPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
  fatGPerServing: number | null;
};

const USDA_API_KEY = 'DEMO_KEY';

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 503 && attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
      return response;
    } catch {
      if (attempt === retries - 1) return null;
    }
  }
  return null;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

async function searchUsda(query: string): Promise<IngredientResult[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&dataType=Branded&pageSize=8`;
  const response = await fetchWithRetry(url);
  if (!response || !response.ok) return [];

  const json = await response.json();
  const foods = (json.foods ?? []) as Record<string, any>[];

  return foods.map((food) => {
    const label = food.labelNutrients ?? {};
    const servingSize =
      food.servingSize && food.servingSizeUnit ? `${food.servingSize}${food.servingSizeUnit}` : null;

    return {
      id: `usda-${food.fdcId}`,
      name: titleCase(food.description ?? ''),
      brand: food.brandName || food.brandOwner || null,
      servingSize,
      caloriesPerServing: label.calories?.value ?? null,
      proteinGPerServing: label.protein?.value ?? null,
      carbsGPerServing: label.carbohydrates?.value ?? null,
      fatGPerServing: label.fat?.value ?? null,
    };
  });
}

async function searchOpenFoodFacts(query: string): Promise<IngredientResult[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,serving_size,nutriments,code`;
  const response = await fetchWithRetry(url);
  if (!response || !response.ok) return [];

  const json = await response.json();
  const products = (json.products ?? []) as Record<string, any>[];

  return products
    .filter((product) => product.product_name)
    .map((product) => {
      const nutriments = product.nutriments ?? {};
      const hasServing = nutriments['energy-kcal_serving'] != null;
      const servingSize = hasServing ? (product.serving_size ?? null) : '100g';

      return {
        id: `off-${product.code ?? product.product_name}`,
        name: product.product_name,
        brand: product.brands ? product.brands.split(',')[0].trim() : null,
        servingSize,
        caloriesPerServing: hasServing
          ? nutriments['energy-kcal_serving']
          : (nutriments['energy-kcal_100g'] ?? null),
        proteinGPerServing: hasServing
          ? nutriments['proteins_serving']
          : (nutriments['proteins_100g'] ?? null),
        carbsGPerServing: hasServing
          ? nutriments['carbohydrates_serving']
          : (nutriments['carbohydrates_100g'] ?? null),
        fatGPerServing: hasServing ? nutriments['fat_serving'] : (nutriments['fat_100g'] ?? null),
      };
    });
}

export async function searchIngredients(query: string): Promise<IngredientResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let results = await searchUsda(trimmed);
  if (results.length < 3) {
    const fallback = await searchOpenFoodFacts(trimmed);
    results = [...results, ...fallback];
  }

  const aiOption: IngredientResult = {
    id: 'ai-estimate',
    name: `✦ Generic ${trimmed} (AI estimate)`,
    brand: null,
    servingSize: null,
    caloriesPerServing: null,
    proteinGPerServing: null,
    carbsGPerServing: null,
    fatGPerServing: null,
    isAiEstimate: true,
  };

  return [...results.slice(0, 5), aiOption];
}

const ESTIMATE_SYSTEM_PROMPT =
  'Estimate nutrition facts for one typical serving of a food. Respond with ONLY a single JSON object, ' +
  'no markdown, no commentary: ' +
  '{"serving_size": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}.';

type EstimatedMacros = {
  servingSize: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export async function estimateIngredientMacros(name: string): Promise<EstimatedMacros | null> {
  const cleanName = name
    .replace(/^✦\s*Generic\s*/i, '')
    .replace(/\s*\(AI estimate\)\s*$/i, '')
    .trim();

  const raw = await callClaude(`Food: ${cleanName}`, ESTIMATE_SYSTEM_PROMPT, 100, 'estimateIngredientMacros');
  const parsed = parseJsonFromClaude<{
    serving_size: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>(raw);
  if (!parsed) return null;

  return {
    servingSize: parsed.serving_size,
    calories: Number(parsed.calories) || 0,
    proteinG: Number(parsed.protein_g) || 0,
    carbsG: Number(parsed.carbs_g) || 0,
    fatG: Number(parsed.fat_g) || 0,
  };
}

export async function getUserIngredients(userId: string): Promise<UserIngredient[]> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .select(
      'id, name, brand, serving_size, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[Ingredients] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    servingSize: row.serving_size,
    caloriesPerServing: row.calories_per_serving,
    proteinGPerServing: row.protein_g_per_serving,
    carbsGPerServing: row.carbs_g_per_serving,
    fatGPerServing: row.fat_g_per_serving,
  }));
}

export async function addUserIngredient(
  userId: string,
  ingredient: Omit<UserIngredient, 'id'>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_ingredients').insert({
    user_id: userId,
    name: ingredient.name,
    brand: ingredient.brand,
    serving_size: ingredient.servingSize,
    calories_per_serving: ingredient.caloriesPerServing,
    protein_g_per_serving: ingredient.proteinGPerServing,
    carbs_g_per_serving: ingredient.carbsGPerServing,
    fat_g_per_serving: ingredient.fatGPerServing,
  });

  if (error) {
    console.log('[Ingredients] insert error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteUserIngredient(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_ingredients').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    console.log('[Ingredients] delete error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function updateUserIngredient(
  userId: string,
  id: string,
  patch: Partial<Omit<UserIngredient, 'id'>>
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.brand !== undefined) update.brand = patch.brand;
  if (patch.servingSize !== undefined) update.serving_size = patch.servingSize;
  if (patch.caloriesPerServing !== undefined) update.calories_per_serving = patch.caloriesPerServing;
  if (patch.proteinGPerServing !== undefined) update.protein_g_per_serving = patch.proteinGPerServing;
  if (patch.carbsGPerServing !== undefined) update.carbs_g_per_serving = patch.carbsGPerServing;
  if (patch.fatGPerServing !== undefined) update.fat_g_per_serving = patch.fatGPerServing;

  const { error } = await supabase
    .from('user_ingredients')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.log('[Ingredients] update error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}
