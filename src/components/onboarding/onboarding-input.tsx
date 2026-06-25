import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

export function OnboardingTextInput({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const { palette } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholderTextColor={palette.textSecondary}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        { backgroundColor: palette.surface, color: palette.text },
        { borderColor: isFocused ? palette.accent : 'transparent' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1.5,
  },
});
