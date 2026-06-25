import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/contexts/auth-context';
import { BodyStatsProvider } from '@/contexts/body-stats-context';
import { ProfileProvider } from '@/contexts/profile-context';
import { AppThemeProvider } from '@/contexts/theme-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <BodyStatsProvider>
              <AnimatedSplashOverlay />
              <AuthGate>
                <AppTabs />
              </AuthGate>
            </BodyStatsProvider>
          </ProfileProvider>
        </AuthProvider>
      </AppThemeProvider>
    </ThemeProvider>
  );
}
