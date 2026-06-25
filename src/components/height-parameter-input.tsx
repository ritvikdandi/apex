import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Slider } from '@/components/slider';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

type HeightParameterInputProps = {
  label: string;
  valueIn: number;
  minimumValueIn: number;
  maximumValueIn: number;
  onChange: (valueIn: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function splitFeetInches(totalIn: number) {
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return { feet, inches };
}

export function HeightParameterInput({
  label,
  valueIn,
  minimumValueIn,
  maximumValueIn,
  onChange,
}: HeightParameterInputProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const { feet, inches } = splitFeetInches(valueIn);
  const [feetText, setFeetText] = useState(() => String(feet));
  const [inchesText, setInchesText] = useState(() => String(inches));
  const [isFocused, setIsFocused] = useState(false);

  // Keep the feet/inches fields in sync with slider-driven changes, but don't
  // fight the user's keystrokes while they're actively typing.
  useEffect(() => {
    if (!isFocused) {
      setFeetText(String(feet));
      setInchesText(String(inches));
    }
  }, [feet, inches, isFocused]);

  const commit = (nextFeet: number, nextInches: number) => {
    onChange(clamp(nextFeet * 12 + nextInches, minimumValueIn, maximumValueIn));
  };

  const handleFeetChange = (next: string) => {
    setFeetText(next);
    const parsed = Number(next);
    if (next.trim().length > 0 && Number.isFinite(parsed)) {
      commit(parsed, Number(inchesText) || 0);
    }
  };

  const handleInchesChange = (next: string) => {
    setInchesText(next);
    const parsed = Number(next);
    if (next.trim().length > 0 && Number.isFinite(parsed)) {
      commit(Number(feetText) || 0, parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const synced = splitFeetInches(valueIn);
    setFeetText(String(synced.feet));
    setInchesText(String(synced.inches));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={feetText}
            onChangeText={handleFeetChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.inputUnit}>ft</Text>
          <TextInput
            value={inchesText}
            onChangeText={handleInchesChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.inputUnit}>in</Text>
        </View>
      </View>

      <Slider
        value={valueIn}
        minimumValue={minimumValueIn}
        maximumValue={maximumValueIn}
        step={1}
        onValueChange={onChange}
      />
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      gap: Spacing.two,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    input: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.text,
      backgroundColor: palette.field,
      borderRadius: Spacing.two,
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.two,
      width: 48,
      textAlign: 'right',
    },
    inputUnit: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.textSecondary,
    },
  });
