import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingTextInput } from '@/components/onboarding/onboarding-input';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import type { GoalMode, UserProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

type GoalStepProps = {
  draft: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onContinue: () => void;
};

const GOAL_MODE_OPTIONS: { mode: GoalMode; label: string; description: string }[] = [
  {
    mode: 'maximize_ffmi',
    label: 'Maximize FFMI by date',
    description: 'Build as much muscle as possible by your target date.',
  },
  {
    mode: 'target_body_fat',
    label: 'Hit a target body fat %',
    description: 'Cut or recomp toward a specific body fat percentage.',
  },
  {
    mode: 'stay_under_bf',
    label: 'Stay under a BF% while building',
    description: 'Lean bulk — gain muscle without exceeding a body fat ceiling.',
  },
  {
    mode: 'recomp',
    label: 'Recomp only',
    description: 'Maintain weight while shifting fat to muscle.',
  },
];

const SHOWS_TARGET_DATE: GoalMode[] = ['maximize_ffmi', 'target_body_fat'];

export function GoalStep({ draft, onChange, onContinue }: GoalStepProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const canContinue = draft.goalMode !== null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Set Your Goal</Text>
        <Text style={styles.subtitle}>This shapes your calorie and macro targets.</Text>

        {GOAL_MODE_OPTIONS.map((option) => {
          const selected = draft.goalMode === option.mode;
          return (
            <Pressable
              key={option.mode}
              onPress={() => onChange({ goalMode: option.mode })}
              style={[styles.goalCard, selected && styles.goalCardSelected]}>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected && <View style={styles.radioInner} />}
              </View>
              <View style={styles.goalTextGroup}>
                <Text style={styles.goalLabel}>{option.label}</Text>
                <Text style={styles.goalDescription}>{option.description}</Text>
              </View>
            </Pressable>
          );
        })}

        {draft.goalMode && SHOWS_TARGET_DATE.includes(draft.goalMode) && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Target Date</Text>
            <OnboardingTextInput
              value={draft.targetDate ?? ''}
              onChangeText={(text) => onChange({ targetDate: text || null })}
              placeholder="YYYY-MM-DD"
            />
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={onContinue}
        disabled={!canContinue}
        style={({ pressed }) => [
          styles.continueButton,
          !canContinue && styles.continueButtonDisabled,
          pressed && canContinue && styles.continueButtonPressed,
        ]}>
        <Text style={styles.continueLabel}>Continue</Text>
      </Pressable>
    </>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    scrollContent: {
      gap: Spacing.three,
      paddingBottom: Spacing.four,
    },
    title: {
      fontSize: 28,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: 500,
      color: palette.textSecondary,
      marginTop: -Spacing.two,
      marginBottom: Spacing.two,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.three,
      padding: Spacing.four,
      borderRadius: Spacing.three,
      backgroundColor: palette.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    goalCardSelected: {
      borderColor: palette.accent,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: palette.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    radioOuterSelected: {
      borderColor: palette.accent,
    },
    radioInner: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: palette.accent,
    },
    goalTextGroup: {
      flex: 1,
      gap: 2,
    },
    goalLabel: {
      fontSize: 16,
      fontWeight: 700,
      color: palette.text,
    },
    goalDescription: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    fieldGroup: {
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    continueButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: 999,
      backgroundColor: palette.accent,
      marginTop: Spacing.three,
    },
    continueButtonDisabled: {
      opacity: 0.4,
    },
    continueButtonPressed: {
      opacity: 0.85,
    },
    continueLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.accentText,
    },
  });
