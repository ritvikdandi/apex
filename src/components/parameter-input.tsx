import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Slider } from '@/components/slider';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

type ParameterInputProps = {
  label: string;
  value: number;
  unit: string;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  precision?: number;
  onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ParameterInput({
  label,
  value,
  unit,
  minimumValue,
  maximumValue,
  step = 1,
  precision = 0,
  onChange,
}: ParameterInputProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [text, setText] = useState(() => value.toFixed(precision));
  const [isFocused, setIsFocused] = useState(false);

  // Keep the text field in sync with slider-driven changes, but don't fight
  // the user's keystrokes while they're actively typing.
  useEffect(() => {
    if (!isFocused) {
      setText(value.toFixed(precision));
    }
  }, [value, precision, isFocused]);

  const handleChangeText = (next: string) => {
    setText(next);
    const parsed = Number(next);
    if (next.trim().length > 0 && Number.isFinite(parsed)) {
      onChange(clamp(parsed, minimumValue, maximumValue));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setText(value.toFixed(precision));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.inputUnit}>{unit}</Text>
        </View>
      </View>

      <Slider
        value={value}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
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
      minWidth: 72,
      textAlign: 'right',
    },
    inputUnit: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.textSecondary,
    },
  });
