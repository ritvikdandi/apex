import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { WeightTrendChart, type WeightTrendPoint } from '@/components/weight-trend-chart';
import { WeightLogModal } from '@/components/weight-log-modal';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useBodyStats } from '@/contexts/body-stats-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { calculateFfmi, categorizeFfmi } from '@/lib/ffmi';

const INITIAL_WEIGHT_TREND: WeightTrendPoint[] = [
  { label: 'Mon', value: 181.2 },
  { label: 'Tue', value: 180.8 },
  { label: 'Wed', value: 181.6 },
  { label: 'Thu', value: 180.4 },
  { label: 'Fri', value: 179.9 },
  { label: 'Sat', value: 180.1 },
  { label: 'Sun', value: 179.6 },
];

export default function HomeScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { heightIn, bodyFatPercent } = useBodyStats();

  const [weightTrend, setWeightTrend] = useState(INITIAL_WEIGHT_TREND);
  const [logModalVisible, setLogModalVisible] = useState(false);

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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <View style={styles.content}>
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

          <View style={styles.bottomSection}>
            <WeightTrendChart data={weightTrend} />
          </View>
        </View>
      </SafeAreaView>

      <WeightLogModal
        visible={logModalVisible}
        initialWeightLb={todayWeight}
        onSave={handleSaveWeight}
        onClose={() => setLogModalVisible(false)}
      />
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
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: Spacing.six,
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
      marginTop: Spacing.five,
      paddingVertical: Spacing.four,
      paddingHorizontal: Spacing.six,
      borderRadius: 999,
      backgroundColor: palette.accent,
      boxShadow: '0 0 20px #00FF87',
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
    bottomSection: {
      marginTop: Spacing.three,
      paddingBottom: Spacing.three,
    },
  });
