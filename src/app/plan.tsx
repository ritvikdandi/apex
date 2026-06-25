import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
  getFoodLogCalories,
  getLatestWeeklyFeedback,
  getWeightLogs,
  isScenarioWithinBfLimit,
  loadActivePlan,
  PHASE_LABELS,
  PHASE_SCENARIOS,
  projectScenario,
  saveActivePlan,
  type ScenarioProjection,
  type WeeklyFeedback,
} from '@/lib/phase-planner';
import { calculateDailyMacros, calculateEstimatedTDEE, calculateTrueMaintenance } from '@/lib/tdee-engine';

const CALIBRATION_DAYS = 14;

export default function PlanScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [weightLogs, setWeightLogs] = useState<{ weightLbs: number; loggedAt: string }[]>([]);
  const [foodLogs, setFoodLogs] = useState<{ calories: number; loggedAt: string }[]>([]);
  const [feedback, setFeedback] = useState<WeeklyFeedback | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [startedScenarioId, setStartedScenarioId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getWeightLogs(user.id).then(setWeightLogs);
    getFoodLogCalories(user.id).then(setFoodLogs);
    getLatestWeeklyFeedback(user.id).then(setFeedback);
    loadActivePlan().then((plan) => {
      if (plan) {
        setSelectedScenarioId(plan.id);
        setStartedScenarioId(plan.id);
      }
    });
  }, [user]);

  const estimatedTdee = useMemo(
    () =>
      calculateEstimatedTDEE({
        weightLb: profile.weightLb,
        heightIn: profile.heightIn,
        age: profile.age,
        sex: profile.sex,
      }),
    [profile]
  );

  const trueMaintenance = useMemo(
    () => calculateTrueMaintenance(weightLogs, foodLogs),
    [weightLogs, foodLogs]
  );

  const daysOfData = trueMaintenance?.daysOfData ?? 0;
  const isCalibrated = trueMaintenance !== null && daysOfData >= CALIBRATION_DAYS;
  const displayTdee = isCalibrated ? trueMaintenance!.trueMaintenance : estimatedTdee;
  const calibrationProgress = Math.min(1, daysOfData / CALIBRATION_DAYS);
  const weeksOfData = Math.floor(daysOfData / 7);

  const dailyMacros = useMemo(
    () => calculateDailyMacros(Math.round(displayTdee), profile.weightLb),
    [displayTdee, profile.weightLb]
  );

  const weeksUntilTarget = useMemo(() => {
    if (!profile.targetDate) return null;
    const target = new Date(profile.targetDate).getTime();
    const diffDays = (target - Date.now()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(diffDays / 7));
  }, [profile.targetDate]);

  const targetDateLabel = useMemo(() => {
    if (!profile.targetDate) return '';
    return new Date(profile.targetDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [profile.targetDate]);

  const scenarioProjections = useMemo(() => {
    return PHASE_SCENARIOS.map((scenario) => projectScenario(scenario, profile, displayTdee)).filter(
      (projection) => isScenarioWithinBfLimit(projection, profile.sex)
    );
  }, [profile, displayTdee]);

  const handleSelectScenario = useCallback((id: string) => {
    setSelectedScenarioId((current) => (current === id ? null : id));
  }, []);

  const handleStartPlan = useCallback(async () => {
    if (!selectedScenarioId) return;
    const projection = scenarioProjections.find((item) => item.scenario.id === selectedScenarioId);
    if (!projection) return;
    await saveActivePlan(projection.scenario);
    setStartedScenarioId(projection.scenario.id);
  }, [selectedScenarioId, scenarioProjections]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Plan</Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Your Maintenance</Text>
            <Text style={styles.tdeeValue}>{Math.round(displayTdee)} cal</Text>

            {isCalibrated ? (
              <View style={styles.calibratedBadge}>
                <Text style={styles.calibratedLabel}>
                  Calibrated — {Math.max(2, weeksOfData)} weeks of data
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.estimatedBadge}>
                  <Text style={styles.estimatedLabel}>Estimated</Text>
                </View>
                <Text style={styles.helperText}>
                  Keep logging {Math.max(0, CALIBRATION_DAYS - daysOfData)} more days to unlock true calibration
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${calibrationProgress * 100}%` }]} />
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Daily Targets</Text>
            <Text style={styles.calorieTarget}>{Math.round(dailyMacros.calories)} cal</Text>
            <View style={styles.macroRow}>
              <MacroMiniCard label="PROTEIN" value={`${Math.round(dailyMacros.proteinG)}g`} palette={palette} />
              <MacroMiniCard label="CARBS" value={`${Math.round(dailyMacros.carbsG)}g`} palette={palette} />
              <MacroMiniCard label="FAT" value={`${Math.round(dailyMacros.fatG)}g`} palette={palette} />
            </View>
          </View>

          {weeksUntilTarget !== null && (
            <Text style={styles.countdownText}>
              {weeksUntilTarget} {weeksUntilTarget === 1 ? 'week' : 'weeks'} until {targetDateLabel}
            </Text>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Phase Scenarios</Text>
            <View style={styles.scenariosList}>
              {scenarioProjections.map((projection) => (
                <ScenarioCard
                  key={projection.scenario.id}
                  projection={projection}
                  isSelected={selectedScenarioId === projection.scenario.id}
                  onPress={() => handleSelectScenario(projection.scenario.id)}
                  palette={palette}
                />
              ))}
            </View>

            <Pressable
              onPress={handleStartPlan}
              disabled={!selectedScenarioId}
              style={({ pressed }) => [
                styles.startButton,
                !selectedScenarioId && styles.buttonDisabled,
                pressed && selectedScenarioId && styles.buttonPressed,
              ]}>
              <Text style={styles.startLabel}>
                {startedScenarioId && startedScenarioId === selectedScenarioId ? 'Plan Started ✓' : 'Start This Plan'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Last Feedback</Text>
            {feedback ? (
              <>
                <Text style={styles.feedbackMessage}>{feedback.message}</Text>
                <Text style={styles.feedbackDate}>
                  {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </>
            ) : (
              <Text style={styles.feedbackEmpty}>No check-in feedback yet — keep logging to get your first weekly review.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type ScenarioCardProps = {
  projection: ScenarioProjection;
  isSelected: boolean;
  onPress: () => void;
  palette: AppPalette;
};

function ScenarioCard({ projection, isSelected, onPress, palette }: ScenarioCardProps) {
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { scenario, projectedFfmi, projectedBodyFatPercent, phaseCalories } = projection;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.scenarioCard, isSelected && styles.scenarioCardSelected]}>
      <Text style={styles.scenarioName}>{scenario.name}</Text>
      <Text style={styles.scenarioBreakdown}>{scenario.breakdown}</Text>

      <View style={styles.scenarioStatsRow}>
        <View style={styles.scenarioStat}>
          <Text style={styles.scenarioStatValue}>{projectedFfmi.toFixed(1)}</Text>
          <Text style={styles.scenarioStatLabel}>PROJ. FFMI</Text>
        </View>
        <View style={styles.scenarioStat}>
          <Text style={styles.scenarioStatValue}>{projectedBodyFatPercent.toFixed(1)}%</Text>
          <Text style={styles.scenarioStatLabel}>PROJ. BODY FAT</Text>
        </View>
      </View>

      <Text style={styles.scenarioCalories}>
        {phaseCalories
          .map((entry) => `${PHASE_LABELS[entry.phase]}: ${entry.calories.toLocaleString()} cal/day`)
          .join('  →  ')}
      </Text>
    </Pressable>
  );
}

type MacroMiniCardProps = {
  label: string;
  value: string | number;
  palette: AppPalette;
};

function MacroMiniCard({ label, value, palette }: MacroMiniCardProps) {
  return (
    <View style={[miniStyles.card, { backgroundColor: palette.field }]}>
      <Text style={[miniStyles.value, { color: palette.text }]}>{value}</Text>
      <Text style={[miniStyles.label, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    gap: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
  },
});

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
      paddingHorizontal: Spacing.four,
      paddingBottom: BottomTabInset + Spacing.three,
    },
    themeToggleAnchor: {
      position: 'absolute',
      top: TopOverlayInset,
      right: Spacing.four,
      zIndex: 10,
    },
    scrollContent: {
      gap: Spacing.three,
      paddingTop: Spacing.six,
      paddingBottom: Spacing.six,
    },
    title: {
      fontSize: 34,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    section: {
      gap: Spacing.three,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.two,
    },
    tdeeValue: {
      fontSize: 40,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -1,
    },
    calibratedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.three,
      paddingVertical: 6,
      marginTop: Spacing.one,
    },
    calibratedLabel: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.5,
      color: palette.accent,
    },
    estimatedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.three,
      paddingVertical: 6,
      marginTop: Spacing.one,
    },
    estimatedLabel: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.5,
      color: palette.textSecondary,
    },
    helperText: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
      marginTop: Spacing.one,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.field,
      overflow: 'hidden',
      marginTop: Spacing.one,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: palette.accent,
    },
    calorieTarget: {
      fontSize: 28,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    countdownText: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.textSecondary,
      textAlign: 'center',
    },
    scenariosList: {
      gap: Spacing.three,
    },
    scenarioCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.one,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    scenarioCardSelected: {
      borderColor: palette.accent,
    },
    scenarioName: {
      fontSize: 17,
      fontWeight: 800,
      color: palette.text,
    },
    scenarioBreakdown: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.textSecondary,
      marginBottom: Spacing.two,
    },
    scenarioStatsRow: {
      flexDirection: 'row',
      gap: Spacing.four,
    },
    scenarioStat: {
      gap: 2,
    },
    scenarioStatValue: {
      fontSize: 20,
      fontWeight: 800,
      color: palette.accent,
    },
    scenarioStatLabel: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1,
      color: palette.textSecondary,
    },
    scenarioCalories: {
      fontSize: 12,
      fontWeight: 600,
      color: palette.textSecondary,
      marginTop: Spacing.two,
    },
    startButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    startLabel: {
      fontSize: 16,
      fontWeight: 700,
      color: palette.accentText,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    feedbackMessage: {
      fontSize: 14,
      fontWeight: 500,
      fontStyle: 'italic',
      color: palette.text,
      lineHeight: 20,
    },
    feedbackDate: {
      fontSize: 12,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    feedbackEmpty: {
      fontSize: 14,
      fontWeight: 500,
      fontStyle: 'italic',
      color: palette.textSecondary,
    },
  });
