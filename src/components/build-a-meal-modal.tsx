import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RecipeCard } from '@/components/recipe-card';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { addFoodLog, type Macros } from '@/lib/food-log';
import type { UserIngredient } from '@/lib/ingredients';
import { generateMealOptions, saveRecipe, type MealOption } from '@/lib/recipes';

type BuildAMealModalProps = {
  visible: boolean;
  userId: string;
  pantryIngredients: UserIngredient[];
  remainingMacros: Macros;
  dailyMacros: Macros;
  onClose: () => void;
  onSaved: () => void;
  onLogged: () => void;
};

type MacroTargetMode = 'remaining' | 'full';

export function BuildAMealModal({
  visible,
  userId,
  pantryIngredients,
  remainingMacros,
  dailyMacros,
  onClose,
  onSaved,
  onLogged,
}: BuildAMealModalProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [query, setQuery] = useState('');
  const [macroTargetMode, setMacroTargetMode] = useState<MacroTargetMode>('remaining');
  const [pantryOnly, setPantryOnly] = useState(true);
  const [options, setOptions] = useState<MealOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canGenerate = query.trim().length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setErrorMessage(null);
    const macroTarget = macroTargetMode === 'remaining' ? remainingMacros : dailyMacros;
    const results = await generateMealOptions(query.trim(), macroTarget, pantryOnly, pantryIngredients);
    setIsGenerating(false);
    if (results.length === 0) {
      setErrorMessage("Couldn't generate meal ideas — try again.");
      return;
    }
    setOptions(results);
  };

  const handleSave = async (index: number) => {
    setSavingIndex(index);
    await saveRecipe(userId, options[index]);
    setSavingIndex(null);
    onSaved();
  };

  const handleLog = async (index: number) => {
    setLoggingIndex(index);
    const option = options[index];
    await addFoodLog(userId, {
      description: option.name,
      calories: option.calories,
      proteinG: option.proteinG,
      carbsG: option.carbsG,
      fatG: option.fatG,
    });
    setLoggingIndex(null);
    onLogged();
  };

  const handleClose = () => {
    setQuery('');
    setOptions([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Build a Meal</Text>
            <Pressable onPress={handleClose} hitSlop={Spacing.two}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>What do you want to eat?</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. something high protein and spicy"
                placeholderTextColor={palette.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Macro Target</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setMacroTargetMode('remaining')}
                  style={[styles.toggleButton, macroTargetMode === 'remaining' && styles.toggleButtonActive]}>
                  <Text
                    style={[styles.toggleLabel, macroTargetMode === 'remaining' && styles.toggleLabelActive]}>
                    Remaining Today
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMacroTargetMode('full')}
                  style={[styles.toggleButton, macroTargetMode === 'full' && styles.toggleButtonActive]}>
                  <Text style={[styles.toggleLabel, macroTargetMode === 'full' && styles.toggleLabelActive]}>
                    Full Daily
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ingredients</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setPantryOnly(true)}
                  style={[styles.toggleButton, pantryOnly && styles.toggleButtonActive]}>
                  <Text style={[styles.toggleLabel, pantryOnly && styles.toggleLabelActive]}>Pantry Only</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPantryOnly(false)}
                  style={[styles.toggleButton, !pantryOnly && styles.toggleButtonActive]}>
                  <Text style={[styles.toggleLabel, !pantryOnly && styles.toggleLabelActive]}>
                    Allow Any Ingredient
                  </Text>
                </Pressable>
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={({ pressed }) => [
                styles.generateButton,
                !canGenerate && styles.buttonDisabled,
                pressed && canGenerate && styles.buttonPressed,
              ]}>
              {isGenerating ? (
                <ActivityIndicator color={palette.accentText} />
              ) : (
                <Text style={styles.generateLabel}>Generate</Text>
              )}
            </Pressable>

            <View style={styles.optionsSection}>
              {options.map((option, index) => (
                <RecipeCard
                  key={index}
                  recipe={option}
                  matchPercent={option.matchPercent}
                  onSave={() => handleSave(index)}
                  isSaving={savingIndex === index}
                  onLog={() => handleLog(index)}
                  isLogging={loggingIndex === index}
                />
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '88%',
      backgroundColor: palette.background,
      borderTopLeftRadius: Spacing.four,
      borderTopRightRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 22,
      fontWeight: 800,
      color: palette.text,
    },
    closeLabel: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    fieldGroup: {
      gap: Spacing.two,
      marginBottom: Spacing.three,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    input: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
      fontWeight: 500,
      color: palette.text,
    },
    toggleRow: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderRadius: 999,
      padding: Spacing.half,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: Spacing.two,
      borderRadius: 999,
      alignItems: 'center',
    },
    toggleButtonActive: {
      backgroundColor: palette.field,
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    toggleLabelActive: {
      color: palette.text,
    },
    errorText: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.error,
      marginBottom: Spacing.two,
    },
    generateButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
      marginBottom: Spacing.three,
    },
    generateLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.accentText,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    optionsSection: {
      gap: Spacing.three,
      marginBottom: Spacing.four,
    },
  });
