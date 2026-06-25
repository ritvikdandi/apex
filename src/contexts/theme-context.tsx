import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { DarkPalette, LightPalette, type AppPalette } from '@/constants/palette';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  scheme: ResolvedScheme;
  palette: AppPalette;
  cycleMode: () => void;
};

const MODE_ORDER: ThemeMode[] = ['auto', 'light', 'dark'];

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('auto');

  const scheme: ResolvedScheme =
    mode === 'auto' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const palette = scheme === 'light' ? LightPalette : DarkPalette;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      palette,
      cycleMode: () => {
        setMode((current) => MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length]);
      },
    }),
    [mode, scheme, palette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
