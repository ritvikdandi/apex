import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import type { PlannedMeal } from '@/lib/meal-plan';

type MealPlanCardProps = {
  meal: PlannedMeal;
  onLog: () => void;
  isLogging?: boolean;
};

export function MealPlanCard({ meal, onLog, isLogging }: MealPlanCardProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{meal.slot.toUpperCase()}</Text>
        </View>
        {meal.prepTime ? (
          <View style={styles.prepPill}>
            <Text style={styles.prepLabel}>{meal.prepTime}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name}>{meal.name}</Text>

      <View style={styles.macroRow}>
        <MacroMiniCard label="CAL" value={Math.round(meal.calories)} palette={palette} />
        <MacroMiniCard label="P" value={`${Math.round(meal.proteinG)}g`} palette={palette} />
        <MacroMiniCard label="C" value={`${Math.round(meal.carbsG)}g`} palette={palette} />
        <MacroMiniCard label="F" value={`${Math.round(meal.fatG)}g`} palette={palette} />
      </View>

      <Pressable onPress={() => setExpanded((current) => !current)} hitSlop={Spacing.two}>
        <Text style={styles.toggleLabel}>{expanded ? 'Hide details' : 'Show ingredients & instructions'}</Text>
      </Pressable>

      {expanded && (
        <>
          {meal.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Ingredients</Text>
              {meal.ingredients.map((ingredient, index) => (
                <Text key={index} style={styles.listItem}>
                  {'•'} {ingredient}
                </Text>
              ))}
            </View>
          )}

          {meal.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Instructions</Text>
              {meal.instructions.map((step, index) => (
                <Text key={index} style={styles.listItem}>
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
          )}
        </>
      )}

      <Pressable
        onPress={onLog}
        disabled={isLogging || meal.logged}
        style={({ pressed }) => [
          meal.logged ? styles.loggedButton : styles.primaryButton,
          pressed && !meal.logged && styles.buttonPressed,
        ]}>
        {isLogging ? (
          <ActivityIndicator color={palette.accentText} />
        ) : (
          <Text style={meal.logged ? styles.loggedLabel : styles.primaryLabel}>
            {meal.logged ? 'Logged ✓' : 'Log This Meal'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

type MacroMiniCardProps = {
  label: string;
  value: string | number;
  palette: AppPalette;
};

function MacroMiniCard({ label, value, palette }: MacroMiniCardProps) {
  return (
    <View style={[miniStyles.card, { backgroundColor: palette.field }]}>
      <Text style={[miniStyles.value, { color: palette.text }]}>{value}</Text>
      <Text style={[miniStyles.label, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    gap: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
  },
});

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    badge: {
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    badgeLabel: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: 1.5,
      color: palette.accent,
    },
    prepPill: {
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    prepLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    name: {
      fontSize: 18,
      fontWeight: 800,
      color: palette.text,
    },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: 700,
      color: palette.accent,
    },
    section: {
      gap: Spacing.one,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    listItem: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.text,
      lineHeight: 20,
    },
    primaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    primaryLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.accentText,
    },
    loggedButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: palette.field,
    },
    loggedLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    buttonPressed: {
      opacity: 0.85,
    },
  });
