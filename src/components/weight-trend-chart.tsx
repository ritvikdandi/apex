import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

export type WeightTrendPoint = {
  label: string;
  value: number;
};

type WeightTrendChartProps = {
  data: WeightTrendPoint[];
  unit?: string;
};

const CHART_HEIGHT = 110;
const MIN_BAR_HEIGHT = 14;

export function WeightTrendChart({ data, unit = 'lb' }: WeightTrendChartProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const change = data[data.length - 1].value - data[0].value;
  const changeSign = change > 0 ? '+' : change < 0 ? '−' : '';
  const changeLabel = `${changeSign}${Math.abs(change).toFixed(1)} ${unit} this week`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>7-DAY TREND</Text>
        <Text style={styles.change}>{changeLabel}</Text>
      </View>

      <View style={styles.chart}>
        {data.map((point, index) => {
          const ratio = (point.value - min) / range;
          const barHeight = MIN_BAR_HEIGHT + ratio * (CHART_HEIGHT - MIN_BAR_HEIGHT);
          const isLatest = index === data.length - 1;
          return (
            <View key={point.label} style={styles.column}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight, backgroundColor: isLatest ? palette.accent : palette.divider },
                  ]}
                />
              </View>
              <Text style={[styles.dayLabel, isLatest && styles.dayLabelActive]}>
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      gap: Spacing.three,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    title: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 2,
      color: palette.textSecondary,
    },
    change: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: CHART_HEIGHT + Spacing.four,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
    },
    column: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.two,
    },
    track: {
      height: CHART_HEIGHT,
      width: 8,
      justifyContent: 'flex-end',
    },
    bar: {
      width: 8,
      borderRadius: Spacing.one,
    },
    dayLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    dayLabelActive: {
      color: palette.text,
    },
  });
