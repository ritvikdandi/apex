import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FfmiScale } from '@/components/ffmi-scale';
import { HeightParameterInput } from '@/components/height-parameter-input';
import { ParameterInput } from '@/components/parameter-input';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile, type GoalMode } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { calculateFfmi, categorizeFfmi } from '@/lib/ffmi';

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

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function ProfileScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile, saveProfile } = useProfile();

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { normalizedFfmi } = useMemo(
    () =>
      calculateFfmi({
        weightLb: profile.weightLb,
        heightIn: profile.heightIn,
        bodyFatPercent: profile.bodyFatPercent,
      }),
    [profile.weightLb, profile.heightIn, profile.bodyFatPercent]
  );
  const animatedFfmi = useAnimatedNumber(normalizedFfmi);
  const category = categorizeFfmi(normalizedFfmi);

  const handleSave = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    const { error } = await saveProfile();
    if (error) {
      setErrorMessage(error);
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={palette.accent} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.name}>{profile.name || 'Your Profile'}</Text>
              <View style={styles.ffmiRow}>
                <Text style={styles.ffmiValue}>{animatedFfmi.toFixed(1)}</Text>
                <View style={styles.ffmiLabels}>
                  <Text style={styles.ffmiLabel}>FFMI</Text>
                  <Text style={styles.ffmiCategory}>{category}</Text>
                </View>
              </View>
            </View>

            <View style={styles.scaleCard}>
              <FfmiScale value={animatedFfmi} />
            </View>

            <View style={styles.fieldsCard}>
              <Text style={styles.sectionLabel}>About You</Text>

              <View style={styles.nameFieldRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={profile.name}
                  onChangeText={(text) => updateProfile({ name: text })}
                  placeholder="Your name"
                  placeholderTextColor={palette.textSecondary}
                  style={styles.nameInput}
                />
              </View>

              <ParameterInput
                label="Age"
                value={profile.age}
                unit="yrs"
                minimumValue={13}
                maximumValue={100}
                step={1}
                precision={0}
                onChange={(value) => updateProfile({ age: Math.round(value) })}
              />

              <View style={styles.sexRow}>
                <Text style={styles.fieldLabel}>Sex</Text>
                <View style={styles.sexToggle}>
                  <Pressable
                    onPress={() => updateProfile({ sex: 'male' })}
                    style={[styles.sexOption, profile.sex === 'male' && styles.sexOptionActive]}>
                    <Text style={[styles.sexLabel, profile.sex === 'male' && styles.sexLabelActive]}>
                      Male
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateProfile({ sex: 'female' })}
                    style={[styles.sexOption, profile.sex === 'female' && styles.sexOptionActive]}>
                    <Text style={[styles.sexLabel, profile.sex === 'female' && styles.sexLabelActive]}>
                      Female
                    </Text>
                  </Pressable>
                </View>
              </View>

              <HeightParameterInput
                label="Height"
                valueIn={profile.heightIn}
                minimumValueIn={36}
                maximumValueIn={96}
                onChange={(value) => updateProfile({ heightIn: value })}
              />

              <ParameterInput
                label="Weight"
                value={profile.weightLb}
                unit="lb"
                minimumValue={65}
                maximumValue={350}
                step={1}
                precision={0}
                onChange={(value) => updateProfile({ weightLb: value })}
              />

              <ParameterInput
                label="Body fat"
                value={profile.bodyFatPercent}
                unit="%"
                minimumValue={3}
                maximumValue={50}
                step={0.5}
                precision={1}
                onChange={(value) => updateProfile({ bodyFatPercent: value })}
              />
            </View>

            <View style={styles.fieldsCard}>
              <Text style={styles.sectionLabel}>Goal</Text>

              {GOAL_MODE_OPTIONS.map((option) => {
                const selected = profile.goalMode === option.mode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => updateProfile({ goalMode: option.mode })}
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

              {profile.goalMode && SHOWS_TARGET_DATE.includes(profile.goalMode) && (
                <View style={styles.nameFieldRow}>
                  <Text style={styles.fieldLabel}>Target Date</Text>
                  <TextInput
                    value={profile.targetDate ?? ''}
                    onChangeText={(text) => updateProfile({ targetDate: text || null })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.textSecondary}
                    style={styles.nameInput}
                  />
                </View>
              )}
            </View>

            {errorMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSave}
              disabled={saveStatus === 'saving'}
              style={({ pressed }) => [
                styles.saveButton,
                saveStatus === 'saving' && styles.saveButtonDisabled,
                pressed && saveStatus !== 'saving' && styles.saveButtonPressed,
              ]}>
              {saveStatus === 'saving' ? (
                <ActivityIndicator color={palette.accentText} />
              ) : (
                <Text style={styles.saveLabel}>{saveStatus === 'saved' ? 'Saved' : 'Save Changes'}</Text>
              )}
            </Pressable>

            <View style={styles.fieldsCard}>
              <Text style={styles.sectionLabel}>Account</Text>
              <View style={styles.accountRow}>
                <Text style={styles.fieldLabel}>Signed in as</Text>
                <Text style={styles.accountEmail}>{user?.email}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => signOut()}
              style={({ pressed }) => [styles.signOutCard, pressed && styles.saveButtonPressed]}>
              <Text style={styles.signOutLabel}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
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
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeToggleAnchor: {
      position: 'absolute',
      top: TopOverlayInset,
      right: Spacing.four,
      zIndex: 10,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.six + Spacing.two,
      paddingBottom: BottomTabInset + Spacing.four,
      gap: Spacing.four,
    },
    headerSection: {
      gap: Spacing.two,
    },
    name: {
      fontSize: 28,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    ffmiRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.two,
    },
    ffmiValue: {
      fontSize: 56,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -1,
    },
    ffmiLabels: {
      paddingBottom: Spacing.one,
      gap: 2,
    },
    ffmiLabel: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 2,
      color: palette.textSecondary,
    },
    ffmiCategory: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.accent,
    },
    scaleCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
    },
    fieldsCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.four,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: palette.textSecondary,
    },
    nameFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.three,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    nameInput: {
      flex: 1,
      fontSize: 17,
      fontWeight: 700,
      color: palette.text,
      backgroundColor: palette.field,
      borderRadius: Spacing.two,
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.three,
      textAlign: 'right',
    },
    sexRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sexToggle: {
      flexDirection: 'row',
      backgroundColor: palette.field,
      borderRadius: 999,
      padding: Spacing.half,
      gap: Spacing.half,
    },
    sexOption: {
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.four,
      borderRadius: 999,
    },
    sexOptionActive: {
      backgroundColor: palette.accent,
    },
    sexLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    sexLabelActive: {
      color: palette.accentText,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.three,
      padding: Spacing.three,
      borderRadius: Spacing.three,
      backgroundColor: palette.field,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    goalCardSelected: {
      borderColor: palette.accent,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
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
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: palette.accent,
    },
    goalTextGroup: {
      flex: 1,
      gap: 2,
    },
    goalLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.text,
    },
    goalDescription: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    errorCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      padding: Spacing.three,
      borderWidth: 1,
      borderColor: palette.error,
    },
    errorText: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.error,
    },
    saveButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonPressed: {
      opacity: 0.85,
    },
    saveLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.accentText,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accountEmail: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.text,
    },
    signOutCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: Spacing.four,
      backgroundColor: palette.surface,
    },
    signOutLabel: {
      fontSize: 16,
      fontWeight: 700,
      color: palette.error,
    },
  });
