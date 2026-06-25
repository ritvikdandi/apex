import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import type { Sex } from '@/lib/tdee-engine';

export type GoalMode = 'maximize_ffmi' | 'target_body_fat' | 'stay_under_bf' | 'recomp';

export type UserProfile = {
  name: string;
  age: number;
  sex: Sex;
  heightIn: number;
  weightLb: number;
  bodyFatPercent: number;
  goalMode: GoalMode | null;
  targetDate: string | null;
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: 30,
  sex: 'male',
  heightIn: 70,
  weightLb: 180,
  bodyFatPercent: 15,
  goalMode: null,
  targetDate: null,
};

type ProfileRow = {
  name: string | null;
  age: number | null;
  sex: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  body_fat_percent: number | null;
  goal_mode: string | null;
  target_date: string | null;
};

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    name: row.name ?? DEFAULT_PROFILE.name,
    age: row.age ?? DEFAULT_PROFILE.age,
    sex: (row.sex as Sex) ?? DEFAULT_PROFILE.sex,
    heightIn: row.height_inches ?? DEFAULT_PROFILE.heightIn,
    weightLb: row.weight_lbs ?? DEFAULT_PROFILE.weightLb,
    bodyFatPercent: row.body_fat_percent ?? DEFAULT_PROFILE.bodyFatPercent,
    goalMode: (row.goal_mode as GoalMode) ?? DEFAULT_PROFILE.goalMode,
    targetDate: row.target_date ?? DEFAULT_PROFILE.targetDate,
  };
}

type ProfileContextValue = {
  profile: UserProfile;
  isLoading: boolean;
  updateProfile: (patch: Partial<UserProfile>) => void;
  saveProfile: () => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(DEFAULT_PROFILE);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('profiles')
      .select('name, age, sex, height_inches, weight_lbs, body_fat_percent, goal_mode, target_date')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.log('[Profile] load error:', error.message);
        }
        if (data) {
          setProfile(rowToProfile(data as ProfileRow));
        } else {
          setProfile(DEFAULT_PROFILE);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  const saveProfile = useCallback(async () => {
    if (!user) return { error: 'Not signed in' };

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: profile.name,
      age: profile.age,
      sex: profile.sex,
      height_inches: profile.heightIn,
      weight_lbs: profile.weightLb,
      body_fat_percent: profile.bodyFatPercent,
      goal_mode: profile.goalMode,
      target_date: profile.targetDate,
    });

    if (error) {
      console.log('[Profile] save error:', error.message);
      return { error: error.message };
    }
    return { error: null };
  }, [user, profile]);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, isLoading, updateProfile, saveProfile }),
    [profile, isLoading, updateProfile, saveProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
