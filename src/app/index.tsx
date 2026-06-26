import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { WeightTrendChart, type WeightTrendPoint } from '@/components/weight-trend-chart';
import { WeightLogModal } from '@/components/weight-log-modal';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useBodyStats } from '@/contexts/body-stats-context';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { calculateFfmi, categorizeFfmi, FFMI_SCALE } from '@/lib/ffmi';
import {
  calculateStreaks,
  calculateWeeklyConsistency,
  checkFfmiMilestone,
  checkTodayTargets,
  updateTodayData,
  type Streaks,
} from '@/lib/streaks';

const INITIAL_WEIGHT_TREND: WeightTrendPoint[] = [
  { label: 'Mon', value: 181.2 },
  { label: 'Tue', value: 180.8 },
  { label: 'Wed', value: 181.6 },
  { label: 'Thu', value: 180.4 },
  { label: 'Fri', value: 179.9 },
  { label: 'Sat', value: 180.1 },
  { label: 'Sun', value: 179.6 },
];

function consistencyColor(score: number): string {
  if (score >= 70) return '#00FF87';
  if (score >= 50) return '#FF9F0A';
  return '#FF3B30';
}

const FFMI_CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  FFMI_SCALE.map((s) => [s.label, s.color])
);

export default function HomeScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { heightIn, bodyFatPercent } = useBodyStats();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [weightTrend, setWeightTrend] = useState(INITIAL_WEIGHT_TREND);
  const [logModalVisible, setLogModalVisible] = useState(false);

  const [streaks, setStreaks] = useState<Streaks>({ protein: 0, water: 0, logging: 0 });
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [milestoneCategory, setMilestoneCategory] = useState<string | null>(null);

  const milestoneAnim = useRef(new Animated.Value(0)).current;

  const todayWeight = weightTrend[weightTrend.length - 1].value;
  const { normalizedFfmi } = calculateFfmi({ weightLb: todayWeight, heightIn, bodyFatPercent });
  const animatedNormalizedFfmi = useAnimatedNumber(normalizedFfmi);
  const ffmiCategory = categorizeFfmi(normalizedFfmi);

  const handleSaveWeight = (weightLb: number) => {
    setWeightTrend((current) => {
      const next = [...current];
      next[next.length - 1] = { ...next[next.length - 1], value: weightLb };
      return next;
    });
    setLogModalVisible(false);
  };

  // Load streaks and consistency on mount (when user + profile available)
  const loadStreakData = useCallback(async () => {
    if (!user?.id || !profile) return;

    try {
      const today = await checkTodayTargets(user.id, {
        weightLb: profile.weightLb,
        heightIn: profile.heightIn,
        age: profile.age,
        sex: profile.sex,
      });
      await updateTodayData(today);

      const [streakResult, consistency] = await Promise.all([
        calculateStreaks(),
        calculateWeeklyConsistency(),
      ]);

      setStreaks(streakResult);
      setConsistencyScore(consistency);
    } catch (err) {
      console.log('[Home] streak load error:', err);
    }
  }, [user?.id, profile]);

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  // Check FFMI milestone whenever category changes
  useEffect(() => {
    if (!ffmiCategory) return;
    checkFfmiMilestone(ffmiCategory).then((category) => {
      if (category) {
        setMilestoneCategory(category);
        milestoneAnim.setValue(0);
        Animated.spring(milestoneAnim, {
          toValue: 1,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [ffmiCategory, milestoneAnim]);

  const dismissMilestone = () => {
    Animated.timing(milestoneAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setMilestoneCategory(null));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* FFMI Hero */}
          <View style={styles.topSection}>
            <Text style={styles.ffmiLabel}>FFMI</Text>
            <Text style={styles.ffmiValue}>{animatedNormalizedFfmi.toFixed(1)}</Text>
            <Text style={styles.ffmiCaption}>{ffmiCategory}</Text>
          </View>

          <Pressable
            onPress={() => setLogModalVisible(true)}
            style={({ pressed }) => [styles.logButton, pressed && styles.logButtonPressed]}>
            <SymbolView
              name={{ ios: 'plus', android: 'add', web: 'add' }}
              tintColor={palette.accentText}
              size={20}
            />
            <Text style={styles.logButtonLabel}>Log Weight</Text>
          </Pressable>

          {/* 7-day weight trend */}
          <View style={styles.chartSection}>
            <WeightTrendChart data={weightTrend} />
          </View>

          {/* Weekly Consistency Score */}
          {consistencyScore !== null && (
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>THIS WEEK</Text>
              <Text style={[styles.consistencyScore, { color: consistencyColor(consistencyScore) }]}>
                {consistencyScore}%
              </Text>
              <Text style={styles.consistencySubLabel}>of days you hit your targets</Text>
            </View>
          )}

          {/* Streaks */}
          <View style={[styles.card, styles.streaksCard]}>
            <Text style={styles.cardSectionLabel}>STREAKS</Text>
            <View style={styles.streaksRow}>
              <StreakColumn count={streaks.protein} label="Protein" />
              <View style={styles.streakDivider} />
              <StreakColumn count={streaks.water} label="Water" />
              <View style={styles.streakDivider} />
              <StreakColumn count={streaks.logging} label="Logging" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <WeightLogModal
        visible={logModalVisible}
        initialWeightLb={todayWeight}
        onSave={handleSaveWeight}
        onClose={() => setLogModalVisible(false)}
      />

      {/* FFMI Milestone Modal */}
      {milestoneCategory && (
        <Animated.View
          style={[
            styles.milestoneOverlay,
            Platform.OS === 'web' ? ({ position: 'fixed' } as object) : {},
            {
              opacity: milestoneAnim,
              transform: [{ scale: milestoneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}>
          <View style={styles.milestoneCenterContent}>
            <Text
              style={[
                styles.milestoneCategoryName,
                { color: FFMI_CATEGORY_COLORS[milestoneCategory] ?? '#00FF87' },
              ]}>
              {milestoneCategory}
            </Text>
            <Text style={styles.milestoneReachedLabel}>
              You reached {milestoneCategory}!
            </Text>
            <Text style={[styles.milestoneFFMINumber, { color: FFMI_CATEGORY_COLORS[milestoneCategory] ?? '#00FF87' }]}>
              {normalizedFfmi.toFixed(1)}
            </Text>
            <Pressable
              onPress={dismissMilestone}
              style={({ pressed }) => [styles.milestoneDismiss, pressed && { opacity: 0.8 }]}>
              <Text style={styles.milestoneDismissLabel}>Keep pushing</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function StreakColumn({ count, label }: { count: number; label: string }) {
  const isHot = count > 6;
  const isGreen = count > 2;
  const numberColor = isGreen ? '#00FF87' : '#FFFFFF';

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: Spacing.one }}>
      <Text style={{ fontSize: 36, fontWeight: '800', color: numberColor, letterSpacing: -1 }}>
        {count}
        {isHot && ' 🔥'}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Text>
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
      paddingHorizontal: Spacing.four,
      paddingBottom: BottomTabInset + Spacing.three,
    },
    themeToggleAnchor: {
      position: 'absolute',
      top: TopOverlayInset,
      right: Spacing.four,
      zIndex: 10,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
      gap: Spacing.four,
      flexGrow: 1,
    },
    topSection: {
      alignItems: 'center',
      gap: 0,
    },
    ffmiLabel: {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 4,
      color: palette.textSecondary,
    },
    ffmiValue: {
      fontSize: 96,
      fontWeight: 800,
      lineHeight: 100,
      color: palette.text,
      letterSpacing: -2,
      textShadowColor: '#00FF87',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 20,
    },
    ffmiCaption: {
      fontSize: 16,
      fontWeight: 600,
      color: palette.accent,
    },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      paddingVertical: Spacing.four,
      paddingHorizontal: Spacing.six,
      borderRadius: 999,
      backgroundColor: palette.accent,
      boxShadow: '0 0 20px #00FF87',
      alignSelf: 'center',
    },
    logButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    logButtonLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.accentText,
    },
    chartSection: {
      marginTop: -Spacing.two,
    },
    // Shared card style
    card: {
      backgroundColor: '#111111',
      borderRadius: Spacing.three,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    cardSectionLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 2,
      color: '#666666',
    },
    // Consistency card
    consistencyScore: {
      fontSize: 56,
      fontWeight: 800,
      letterSpacing: -1,
    },
    consistencySubLabel: {
      fontSize: 13,
      fontWeight: 500,
      color: '#666666',
      marginTop: -Spacing.two,
    },
    // Streaks card
    streaksCard: {},
    streaksRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    streakDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: '#2a2a2a',
    },
    // Milestone overlay
    milestoneOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10003,
    },
    milestoneCenterContent: {
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.five,
    },
    milestoneCategoryName: {
      fontSize: 48,
      fontWeight: 800,
      letterSpacing: -1,
      textAlign: 'center',
    },
    milestoneReachedLabel: {
      fontSize: 22,
      fontWeight: 600,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    milestoneFFMINumber: {
      fontSize: 64,
      fontWeight: 800,
      letterSpacing: -2,
      marginVertical: Spacing.three,
    },
    milestoneDismiss: {
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.six,
      borderRadius: 999,
      backgroundColor: '#00FF87',
      marginTop: Spacing.two,
    },
    milestoneDismissLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: '#000000',
    },
  });
