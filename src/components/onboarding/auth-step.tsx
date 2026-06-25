import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingTextInput } from '@/components/onboarding/onboarding-input';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import type { UserProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type AuthStepProps = {
  draft: UserProfile;
};

export function AuthStep({ draft }: AuthStepProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { signIn } = useAuth();

  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = email.trim().length > 0 && password.length >= 6;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    if (mode === 'sign-in') {
      const { error: signInError } = await signIn(email.trim(), password);
      setIsSubmitting(false);
      if (signInError) setError(signInError);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: data.user.id,
        name: draft.name,
        age: draft.age,
        sex: draft.sex,
        height_inches: draft.heightIn,
        weight_lbs: draft.weightLb,
        body_fat_percent: draft.bodyFatPercent,
        goal_mode: draft.goalMode,
        target_date: draft.targetDate,
      });
      if (insertError) {
        setIsSubmitting(false);
        setError(insertError.message);
        return;
      }
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <View style={styles.content}>
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign-up'
            ? "We'll save your profile so your plan is ready when you sign in."
            : 'Sign in to pick up where you left off.'}
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('sign-up')}
            style={[styles.modeButton, mode === 'sign-up' && styles.modeButtonActive]}>
            <Text style={[styles.modeLabel, mode === 'sign-up' && styles.modeLabelActive]}>
              Create Account
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('sign-in')}
            style={[styles.modeButton, mode === 'sign-in' && styles.modeButtonActive]}>
            <Text style={[styles.modeLabel, mode === 'sign-in' && styles.modeLabelActive]}>Sign In</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <OnboardingTextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <OnboardingTextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Min 6 characters"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!isValid || isSubmitting}
        style={({ pressed }) => [
          styles.continueButton,
          (!isValid || isSubmitting) && styles.continueButtonDisabled,
          pressed && isValid && !isSubmitting && styles.continueButtonPressed,
        ]}>
        {isSubmitting ? (
          <ActivityIndicator color={palette.accentText} />
        ) : (
          <Text style={styles.continueLabel}>{mode === 'sign-up' ? 'Create Account' : 'Sign In'}</Text>
        )}
      </Pressable>
    </>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    content: {
      flex: 1,
      gap: Spacing.four,
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
    modeRow: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderRadius: 999,
      padding: Spacing.half,
    },
    modeButton: {
      flex: 1,
      paddingVertical: Spacing.two,
      borderRadius: 999,
      alignItems: 'center',
    },
    modeButtonActive: {
      backgroundColor: palette.field,
    },
    modeLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    modeLabelActive: {
      color: palette.text,
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
    errorText: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.error,
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
