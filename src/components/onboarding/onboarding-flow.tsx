import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthStep } from '@/components/onboarding/auth-step';
import { GoalStep } from '@/components/onboarding/goal-step';
import { ProfileStep } from '@/components/onboarding/profile-step';
import type { AppPalette } from '@/constants/palette';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { DEFAULT_PROFILE, type UserProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

type Screen = 'welcome' | 'profile' | 'goal' | 'account';

const STEP_NUMBERS: Record<Screen, number> = { welcome: 0, profile: 1, goal: 2, account: 3 };

export function OnboardingFlow() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [screen, setScreen] = useState<Screen>('welcome');
  const [draft, setDraft] = useState<UserProfile>(DEFAULT_PROFILE);

  const updateDraft = (patch: Partial<UserProfile>) => setDraft((current) => ({ ...current, ...patch }));

  if (screen === 'welcome') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.welcomeContent}>
            <View style={styles.logoGlow}>
              <SymbolView
                name={{ ios: 'mountain.2.fill', android: 'landscape', web: 'landscape' }}
                tintColor={palette.accent}
                size={72}
              />
            </View>
            <Text style={styles.logoText}>APEX</Text>
            <Text style={styles.tagline}>Optimize your physique</Text>
          </View>

          <Pressable
            onPress={() => setScreen('profile')}
            style={({ pressed }) => [styles.getStartedButton, pressed && styles.getStartedButtonPressed]}>
            <Text style={styles.getStartedLabel}>Get Started</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const stepNumber = STEP_NUMBERS[screen];
  const canGoBack = screen === 'goal' || screen === 'account';

  const handleBack = () => {
    if (screen === 'goal') setScreen('profile');
    else if (screen === 'account') setScreen('goal');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            {canGoBack ? (
              <Pressable onPress={handleBack} hitSlop={Spacing.two} style={styles.backButton}>
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  tintColor={palette.text}
                  size={22}
                />
              </Pressable>
            ) : (
              <View style={styles.backButton} />
            )}

            <View style={styles.dotsRow}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={[styles.dot, step === stepNumber && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.backButton} />
          </View>

          <View style={styles.stepContent}>
            {screen === 'profile' && (
              <ProfileStep draft={draft} onChange={updateDraft} onContinue={() => setScreen('goal')} />
            )}
            {screen === 'goal' && (
              <GoalStep draft={draft} onChange={updateDraft} onContinue={() => setScreen('account')} />
            )}
            {screen === 'account' && <AuthStep draft={draft} />}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    safeArea: {
      flex: 1,
      width: '100%',
      maxWidth: MaxContentWidth,
      paddingHorizontal: Spacing.five,
    },
    flex: {
      flex: 1,
    },
    welcomeContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
    },
    logoGlow: {
      marginBottom: Spacing.three,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 24,
      elevation: 24,
    },
    logoText: {
      fontSize: 40,
      fontWeight: 800,
      letterSpacing: 6,
      color: palette.text,
    },
    tagline: {
      fontSize: 15,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    getStartedButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: 999,
      backgroundColor: palette.accent,
      marginBottom: Spacing.six,
    },
    getStartedButtonPressed: {
      opacity: 0.85,
    },
    getStartedLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.accentText,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Spacing.four,
      paddingBottom: Spacing.three,
    },
    backButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.field,
    },
    dotActive: {
      backgroundColor: palette.accent,
    },
    stepContent: {
      flex: 1,
      paddingBottom: Spacing.four,
    },
  });
