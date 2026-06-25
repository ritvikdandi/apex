import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OnboardingTextInput } from '@/components/onboarding/onboarding-input';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import type { UserProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

type ProfileStepProps = {
  draft: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onContinue: () => void;
};

function splitFeetInches(totalIn: number) {
  return { feet: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}

export function ProfileStep({ draft, onChange, onContinue }: ProfileStepProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const { feet, inches } = splitFeetInches(draft.heightIn);
  const [feetText, setFeetText] = useState(String(feet));
  const [inchesText, setInchesText] = useState(String(inches));
  const [ageText, setAgeText] = useState(String(draft.age));
  const [weightText, setWeightText] = useState(String(draft.weightLb));
  const [bodyFatText, setBodyFatText] = useState(String(draft.bodyFatPercent));

  const commitHeight = (nextFeet: string, nextInches: string) => {
    const f = Number(nextFeet);
    const i = Number(nextInches);
    if (Number.isFinite(f) && Number.isFinite(i)) {
      onChange({ heightIn: Math.max(0, f) * 12 + Math.max(0, i) });
    }
  };

  const canContinue = draft.name.trim().length > 0;

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>About You</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself so we can personalize your plan.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Name</Text>
          <OnboardingTextInput
            value={draft.name}
            onChangeText={(text) => onChange({ name: text })}
            placeholder="Your name"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Age</Text>
          <OnboardingTextInput
            value={ageText}
            onChangeText={(text) => {
              setAgeText(text);
              const parsed = Number(text);
              if (text.trim().length > 0 && Number.isFinite(parsed)) onChange({ age: parsed });
            }}
            keyboardType="number-pad"
            placeholder="30"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Sex</Text>
          <View style={styles.sexRow}>
            <Pressable
              onPress={() => onChange({ sex: 'male' })}
              style={[styles.sexCard, draft.sex === 'male' && styles.sexCardSelected]}>
              <Text style={[styles.sexCardLabel, draft.sex === 'male' && styles.sexCardLabelSelected]}>
                Male
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onChange({ sex: 'female' })}
              style={[styles.sexCard, draft.sex === 'female' && styles.sexCardSelected]}>
              <Text style={[styles.sexCardLabel, draft.sex === 'female' && styles.sexCardLabelSelected]}>
                Female
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Height</Text>
          <View style={styles.row}>
            <View style={styles.unitInputWrap}>
              <OnboardingTextInput
                value={feetText}
                onChangeText={(text) => {
                  setFeetText(text);
                  commitHeight(text, inchesText);
                }}
                keyboardType="number-pad"
                style={styles.unitInput}
              />
              <Text style={styles.unitLabel}>ft</Text>
            </View>
            <View style={styles.unitInputWrap}>
              <OnboardingTextInput
                value={inchesText}
                onChangeText={(text) => {
                  setInchesText(text);
                  commitHeight(feetText, text);
                }}
                keyboardType="number-pad"
                style={styles.unitInput}
              />
              <Text style={styles.unitLabel}>in</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Weight</Text>
          <View style={styles.unitInputWrap}>
            <OnboardingTextInput
              value={weightText}
              onChangeText={(text) => {
                setWeightText(text);
                const parsed = Number(text);
                if (text.trim().length > 0 && Number.isFinite(parsed)) onChange({ weightLb: parsed });
              }}
              keyboardType="decimal-pad"
              style={styles.flexInput}
            />
            <Text style={styles.unitLabel}>lb</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Body Fat %</Text>
          <View style={styles.unitInputWrap}>
            <OnboardingTextInput
              value={bodyFatText}
              onChangeText={(text) => {
                setBodyFatText(text);
                const parsed = Number(text);
                if (text.trim().length > 0 && Number.isFinite(parsed)) onChange({ bodyFatPercent: parsed });
              }}
              keyboardType="decimal-pad"
              style={styles.flexInput}
            />
            <Text style={styles.unitLabel}>%</Text>
          </View>
        </View>
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
      gap: Spacing.four,
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
    },
    fieldGroup: {
      gap: Spacing.two,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.three,
      minWidth: 0,
    },
    sexRow: {
      flexDirection: 'row',
      gap: Spacing.three,
    },
    sexCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: Spacing.three,
      backgroundColor: palette.surface,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    sexCardSelected: {
      borderColor: palette.accent,
    },
    sexCardLabel: {
      fontSize: 16,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    sexCardLabelSelected: {
      color: palette.text,
    },
    unitInputWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    unitInput: {
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
    },
    flexInput: {
      flex: 1,
      minWidth: 0,
    },
    unitLabel: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.textSecondary,
      minWidth: 18,
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
