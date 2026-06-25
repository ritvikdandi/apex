import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FfmiScale } from '@/components/ffmi-scale';
import { HeightParameterInput } from '@/components/height-parameter-input';
import { ParameterInput } from '@/components/parameter-input';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useBodyStats } from '@/contexts/body-stats-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { calculateFfmi, categorizeFfmi } from '@/lib/ffmi';

export default function CalculatorScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { heightIn, bodyFatPercent, setHeightIn, setBodyFatPercent } = useBodyStats();

  const [weightLb, setWeightLb] = useState(180);

  const { ffmi, normalizedFfmi } = useMemo(
    () => calculateFfmi({ heightIn, weightLb, bodyFatPercent }),
    [heightIn, weightLb, bodyFatPercent]
  );
  const category = categorizeFfmi(normalizedFfmi);
  const fatFreeMassLb = weightLb * (1 - bodyFatPercent / 100);

  // Ease derived stats toward their new values instead of snapping.
  const animatedFatFreeMassLb = useAnimatedNumber(fatFreeMassLb);
  const animatedFfmi = useAnimatedNumber(ffmi);
  const animatedNormalizedFfmi = useAnimatedNumber(normalizedFfmi);

  const StatRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.statRow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.inputsCard}>
              <HeightParameterInput
                label="Height"
                valueIn={heightIn}
                minimumValueIn={36}
                maximumValueIn={96}
                onChange={setHeightIn}
              />
              <ParameterInput
                label="Weight"
                value={weightLb}
                unit="lb"
                minimumValue={65}
                maximumValue={350}
                step={1}
                precision={0}
                onChange={setWeightLb}
              />
              <ParameterInput
                label="Body fat"
                value={bodyFatPercent}
                unit="%"
                minimumValue={0}
                maximumValue={100}
                step={0.5}
                precision={1}
                onChange={setBodyFatPercent}
              />
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.statsGroup}>
                <View style={styles.statsColumn}>
                  <StatRow label="Fat Free Mass" value={`${animatedFatFreeMassLb.toFixed(2)} lbs`} />
                  <StatRow label="Body Fat" value={`${bodyFatPercent.toFixed(1)} %`} />
                </View>
                <View style={styles.statsColumn}>
                  <StatRow label="FFMI" value={animatedFfmi.toFixed(2)} />
                  <StatRow label="Normalized FFMI" value={animatedNormalizedFfmi.toFixed(2)} />
                </View>
              </View>

              <View style={styles.resultColumn}>
                <Text style={styles.resultValue}>{animatedNormalizedFfmi.toFixed(1)}</Text>
                <Text style={styles.resultCategory}>{category}</Text>
              </View>
            </View>

            <View style={styles.scaleCard}>
              <FfmiScale value={animatedNormalizedFfmi} />
            </View>
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
    inputsCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.four,
    },
    summaryCard: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.five,
    },
    statsGroup: {
      flex: 2,
      flexDirection: 'row',
      gap: Spacing.five,
    },
    statsColumn: {
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.four,
    },
    statRow: {
      gap: Spacing.half,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    statValue: {
      fontSize: 18,
      fontWeight: 700,
      color: palette.text,
    },
    resultColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: palette.divider,
    },
    resultValue: {
      fontSize: 72,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -1,
    },
    resultCategory: {
      fontSize: 17,
      fontWeight: 600,
      color: palette.accent,
    },
    scaleCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
    },
  });
