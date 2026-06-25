import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

export type BodyStats = {
  heightIn: number;
  bodyFatPercent: number;
};

type BodyStatsContextValue = BodyStats & {
  setHeightIn: (value: number) => void;
  setBodyFatPercent: (value: number) => void;
};

const DEFAULT_BODY_STATS: BodyStats = {
  heightIn: 70,
  bodyFatPercent: 15,
};

const BodyStatsContext = createContext<BodyStatsContextValue | null>(null);

export function BodyStatsProvider({ children }: PropsWithChildren) {
  const [heightIn, setHeightIn] = useState(DEFAULT_BODY_STATS.heightIn);
  const [bodyFatPercent, setBodyFatPercent] = useState(DEFAULT_BODY_STATS.bodyFatPercent);

  const value = useMemo<BodyStatsContextValue>(
    () => ({ heightIn, bodyFatPercent, setHeightIn, setBodyFatPercent }),
    [heightIn, bodyFatPercent]
  );

  return <BodyStatsContext.Provider value={value}>{children}</BodyStatsContext.Provider>;
}

export function useBodyStats(): BodyStatsContextValue {
  const context = useContext(BodyStatsContext);
  if (!context) {
    throw new Error('useBodyStats must be used within a BodyStatsProvider');
  }
  return context;
}
