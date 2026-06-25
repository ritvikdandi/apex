import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import type { GeneratedRecipe } from '@/lib/recipes';

type RecipeCardProps = {
  recipe: GeneratedRecipe;
  matchPercent?: number;
  onSave?: () => void;
  isSaving?: boolean;
  onLog?: () => void;
  isLogging?: boolean;
  onDelete?: () => void;
};

export function RecipeCard({ recipe, matchPercent, onSave, isSaving, onLog, isLogging, onDelete }: RecipeCardProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{recipe.name}</Text>
        {matchPercent != null ? (
          <View style={styles.matchPill}>
            <Text style={styles.matchLabel}>{matchPercent}% match</Text>
          </View>
        ) : recipe.prepTime ? (
          <View style={styles.prepPill}>
            <Text style={styles.prepLabel}>{recipe.prepTime}</Text>
          </View>
        ) : null}
      </View>

      {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

      <View style={styles.macroRow}>
        <MacroMiniCard label="CAL" value={Math.round(recipe.calories)} palette={palette} />
        <MacroMiniCard label="P" value={`${Math.round(recipe.proteinG)}g`} palette={palette} />
        <MacroMiniCard label="C" value={`${Math.round(recipe.carbsG)}g`} palette={palette} />
        <MacroMiniCard label="F" value={`${Math.round(recipe.fatG)}g`} palette={palette} />
      </View>

      {recipe.ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ingredients</Text>
          {recipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.listItem}>
              {'•'} {ingredient}
            </Text>
          ))}
        </View>
      )}

      {recipe.instructions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Instructions</Text>
          {recipe.instructions.map((step, index) => (
            <Text key={index} style={styles.listItem}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      {(onSave || onLog || onDelete) && (
        <View style={styles.actionRow}>
          {onSave && (
            <Pressable
              onPress={onSave}
              disabled={isSaving}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}>
              {isSaving ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <Text style={styles.outlineLabel}>Save Recipe</Text>
              )}
            </Pressable>
          )}
          {onLog && (
            <Pressable
              onPress={onLog}
              disabled={isLogging}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              {isLogging ? (
                <ActivityIndicator color={palette.accentText} />
              ) : (
                <Text style={styles.primaryLabel}>Log This Meal</Text>
              )}
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}>
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    name: {
      flex: 1,
      fontSize: 18,
      fontWeight: 800,
      color: palette.text,
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
    matchPill: {
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    matchLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: palette.accent,
    },
    description: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.two,
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
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    outlineButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: palette.divider,
    },
    outlineLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.text,
    },
    primaryButton: {
      flex: 1,
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
    deleteButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
      borderRadius: 999,
    },
    deleteLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.error,
    },
    buttonPressed: {
      opacity: 0.85,
    },
  });
