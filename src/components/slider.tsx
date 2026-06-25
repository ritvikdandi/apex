import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { useAppTheme } from '@/contexts/theme-context';

type SliderProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
};

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 6;

export function Slider({ value, minimumValue, maximumValue, step = 0, onValueChange }: SliderProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  // While dragging, track the live value locally so the thumb tracks the
  // pointer smoothly without pushing updates (and recalculations) to the
  // parent until the user releases.
  const [dragValue, setDragValue] = useState<number | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const valueFromOffset = useCallback(
    (offsetX: number) => {
      const width = trackWidthRef.current;
      if (width <= 0) return minimumValue;
      const ratio = Math.min(1, Math.max(0, offsetX / width));
      let next = minimumValue + ratio * (maximumValue - minimumValue);
      if (step > 0) {
        next = Math.round(next / step) * step;
      }
      return Math.min(maximumValue, Math.max(minimumValue, next));
    },
    [minimumValue, maximumValue, step]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => setDragValue(valueFromOffset(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => setDragValue(valueFromOffset(event.nativeEvent.locationX)),
      onPanResponderRelease: (event) => {
        const next = valueFromOffset(event.nativeEvent.locationX);
        setDragValue(null);
        onValueChange(next);
      },
      onPanResponderTerminate: () => setDragValue(null),
    })
  ).current;

  const displayValue = dragValue ?? value;
  const ratio =
    maximumValue > minimumValue ? (displayValue - minimumValue) / (maximumValue - minimumValue) : 0;
  const thumbOffset = Math.min(1, Math.max(0, ratio)) * trackWidth;

  return (
    <View style={styles.wrapper} onLayout={handleLayout} {...panResponder.panHandlers}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: thumbOffset }]} />
      </View>
      <View style={[styles.thumb, { left: thumbOffset - THUMB_SIZE / 2 }]} />
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    wrapper: {
      height: 40,
      justifyContent: 'center',
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: palette.divider,
      overflow: 'hidden',
    },
    fill: {
      height: TRACK_HEIGHT,
      backgroundColor: palette.accent,
      borderRadius: TRACK_HEIGHT / 2,
    },
    thumb: {
      position: 'absolute',
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: palette.text,
      top: '50%',
      marginTop: -THUMB_SIZE / 2,
    },
  });
