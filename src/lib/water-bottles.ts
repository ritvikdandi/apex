import { supabase } from '@/lib/supabase';

export type WaterBottle = {
  id: string;
  name: string;
  sizeOz: number;
  createdAt: string;
};

export async function getWaterBottles(userId: string): Promise<WaterBottle[]> {
  const { data, error } = await supabase
    .from('water_bottles')
    .select('id, name, size_oz, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('[WaterBottles] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sizeOz: row.size_oz,
    createdAt: row.created_at,
  }));
}

export async function addWaterBottle(
  userId: string,
  name: string,
  sizeOz: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('water_bottles').insert({
    user_id: userId,
    name,
    size_oz: sizeOz,
  });

  if (error) {
    console.log('[WaterBottles] insert error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteWaterBottle(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('water_bottles').delete().eq('id', id).eq('user_id', userId);

  if (error) {
    console.log('[WaterBottles] delete error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}
