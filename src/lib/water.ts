import { supabase } from '@/lib/supabase';

export type WaterLogEntry = {
  id: string;
  amountOz: number;
  loggedAt: string;
  createdAt: string;
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultWaterGoalOz(weightLb: number): number {
  return Math.round(weightLb * 0.5);
}

export async function getTodayWaterLogs(userId: string): Promise<WaterLogEntry[]> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('id, amount_oz, logged_at, created_at')
    .eq('user_id', userId)
    .eq('logged_at', todayDate())
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[Water] load error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    amountOz: row.amount_oz,
    loggedAt: row.logged_at,
    createdAt: row.created_at,
  }));
}

export async function addWaterLog(userId: string, amountOz: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('water_logs').insert({
    user_id: userId,
    amount_oz: amountOz,
    logged_at: todayDate(),
  });

  if (error) {
    console.log('[Water] insert error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function resetTodayWaterLogs(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('water_logs')
    .delete()
    .eq('user_id', userId)
    .eq('logged_at', todayDate());

  if (error) {
    console.log('[Water] reset error:', error.message);
    return { error: error.message };
  }
  return { error: null };
}
