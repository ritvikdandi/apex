import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { FFMI_SCALE, FFMI_SCALE_MAX, FFMI_SCALE_MIN } from '@/lib/ffmi';

type FfmiScaleProps = {
  value: number;
};

const SEGMENT_COUNT = 60;
const MARKER_SIZE = 14;
const SCALE_RANGE = FFMI_SCALE_MAX - FFMI_SCALE_MIN;

const GRADIENT_STOPS = [
  ...FFMI_SCALE.map((band) => ({ value: band.from, color: band.color })),
  { value: FFMI_SCALE[FFMI_SCALE.length - 1].to, color: FFMI_SCALE[FFMI_SCALE.length - 1].color },
];

const TICKS = Array.from({ length: SCALE_RANGE + 1 }, (_, index) => FFMI_SCALE_MIN + index);

function hexToRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function colorAt(value: number): string {
  const clamped = Math.min(FFMI_SCALE_MAX, Math.max(FFMI_SCALE_MIN, value));
  let lower = GRADIENT_STOPS[0];
  let upper = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (clamped >= GRADIENT_STOPS[i].value && clamped <= GRADIENT_STOPS[i + 1].value) {
      lower = GRADIENT_STOPS[i];
      upper = GRADIENT_STOPS[i + 1];
      break;
    }
  }
  const span = upper.value - lower.value || 1;
  const t = (clamped - lower.value) / span;
  const a = hexToRgb(lower.color);
  const b = hexToRgb(upper.color);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

const SEGMENT_COLORS = Array.from({ length: SEGMENT_COUNT }, (_, index) =>
  colorAt(FFMI_SCALE_MIN + ((index + 0.5) / SEGMENT_COUNT) * SCALE_RANGE)
);

export function FfmiScale({ value }: FfmiScaleProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [width, setWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const ratio = (Math.min(FFMI_SCALE_MAX, Math.max(FFMI_SCALE_MIN, value)) - FFMI_SCALE_MIN) / SCALE_RANGE;
  const markerLeft = ratio * width - MARKER_SIZE / 2;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FFMI SCALE</Text>

      <View style={styles.scaleArea} onLayout={handleLayout}>
        {width > 0 && <View style={[styles.marker, { left: markerLeft }]} />}

        <View style={styles.gradientBar}>
          {SEGMENT_COLORS.map((color, index) => (
            <View key={index} style={[styles.segment, { backgroundColor: color }]} />
          ))}
        </View>

        {width > 0 &&
          FFMI_SCALE.map((band) => {
            const left = ((band.from - FFMI_SCALE_MIN) / SCALE_RANGE) * width;
            const bandWidth = ((band.to - band.from) / SCALE_RANGE) * width;
            return (
              <View key={band.label} style={[styles.bandLabel, { left, width: bandWidth }]}>
                <Text style={styles.bandLabelText} numberOfLines={1}>
                  {band.label}
                </Text>
              </View>
            );
          })}
      </View>

      <View style={styles.tickRow}>
        {TICKS.map((tick) => (
          <Text key={tick} style={styles.tickText}>
            {tick}
          </Text>
        ))}
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      gap: Spacing.three,
    },
    title: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 2,
      color: palette.textSecondary,
    },
    scaleArea: {
      paddingTop: MARKER_SIZE + Spacing.one,
      paddingBottom: Spacing.five,
    },
    marker: {
      position: 'absolute',
      top: Spacing.one,
      width: 0,
      height: 0,
      borderLeftWidth: MARKER_SIZE / 2,
      borderRightWidth: MARKER_SIZE / 2,
      borderTopWidth: MARKER_SIZE,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: palette.text,
    },
    gradientBar: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 7,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
      height: '100%',
    },
    bandLabel: {
      position: 'absolute',
      bottom: 0,
      alignItems: 'center',
      overflow: 'hidden',
    },
    bandLabelText: {
      fontSize: 10,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    tickRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tickText: {
      fontSize: 12,
      fontWeight: 500,
      color: palette.textSecondary,
    },
  });
