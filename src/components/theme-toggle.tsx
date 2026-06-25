import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme, type ThemeMode } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';

const MODE_GLYPH: Record<ThemeMode, string> = {
  auto: '◐',
  light: '☀',
  dark: '☾',
};

const MODE_LABEL: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps = {}) {
  const { mode, palette, cycleMode } = useAppTheme();

  return (
    <Pressable
      onPress={cycleMode}
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        styles.toggle,
        compact && styles.toggleCompact,
        { backgroundColor: palette.surface, borderColor: palette.divider, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.glyph, { color: palette.text }]}>{MODE_GLYPH[mode]}</Text>
      {!compact && (
        <Text style={[styles.label, { color: palette.textSecondary }]}>{MODE_LABEL[mode]}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleCompact: {
    paddingHorizontal: Spacing.two,
  },
  glyph: {
    fontSize: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
  },
});
