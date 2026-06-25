import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RecipeCard } from '@/components/recipe-card';
import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import type { UserIngredient } from '@/lib/ingredients';
import { generateDirections, parseServingGrams, saveRecipe, type GeneratedRecipe } from '@/lib/recipes';

type RecipeBuilderModalProps = {
  visible: boolean;
  userId: string;
  pantryIngredients: UserIngredient[];
  onClose: () => void;
  onSaved: () => void;
};

type RecipeRow = {
  key: string;
  ingredient: UserIngredient;
  quantityText: string;
};

export function RecipeBuilderModal({ visible, userId, pantryIngredients, onClose, onSaved }: RecipeBuilderModalProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [recipeName, setRecipeName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [isGeneratingDirections, setIsGeneratingDirections] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const matches = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();
    if (trimmed.length < 1) return [];
    const addedIds = new Set(rows.map((row) => row.ingredient.id));
    return pantryIngredients
      .filter((item) => !addedIds.has(item.id) && item.name.toLowerCase().includes(trimmed))
      .slice(0, 5);
  }, [searchText, pantryIngredients, rows]);

  const handleAddIngredient = (ingredient: UserIngredient) => {
    setRows((current) => [
      ...current,
      { key: `${ingredient.id}-${Date.now()}`, ingredient, quantityText: '100' },
    ]);
    setSearchText('');
  };

  const handleRemoveRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const handleQuantityChange = (key: string, text: string) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, quantityText: text } : row)));
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const grams = Number(row.quantityText) || 0;
        const servingGrams = parseServingGrams(row.ingredient.servingSize) ?? 100;
        const ratio = servingGrams > 0 ? grams / servingGrams : 0;
        return {
          calories: acc.calories + (row.ingredient.caloriesPerServing ?? 0) * ratio,
          proteinG: acc.proteinG + (row.ingredient.proteinGPerServing ?? 0) * ratio,
          carbsG: acc.carbsG + (row.ingredient.carbsGPerServing ?? 0) * ratio,
          fatG: acc.fatG + (row.ingredient.fatGPerServing ?? 0) * ratio,
        };
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  }, [rows]);

  const ingredientLines = useMemo(
    () => rows.map((row) => `${row.quantityText || 0}g ${row.ingredient.name}`),
    [rows]
  );

  const canGenerateDirections = recipeName.trim().length > 0 && rows.length > 0 && !isGeneratingDirections;
  const canSave = recipeName.trim().length > 0 && rows.length > 0 && !isSaving;

  const handleGenerateDirections = async () => {
    if (!canGenerateDirections) return;
    setIsGeneratingDirections(true);
    setErrorMessage(null);
    const result = await generateDirections(recipeName.trim(), ingredientLines);
    setIsGeneratingDirections(false);
    if (result.length === 0) {
      setErrorMessage("Couldn't generate directions — try again.");
      return;
    }
    setInstructions(result);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setErrorMessage(null);

    const recipe: GeneratedRecipe = {
      name: recipeName.trim(),
      prepTime: '',
      description: '',
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      ingredients: ingredientLines,
      instructions,
    };

    const { error } = await saveRecipe(userId, recipe);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error);
      return;
    }

    setRecipeName('');
    setSearchText('');
    setRows([]);
    setInstructions([]);
    onSaved();
    onClose();
  };

  const previewRecipe: GeneratedRecipe = {
    name: recipeName.trim() || 'New Recipe',
    prepTime: '',
    description: '',
    calories: totals.calories,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
    ingredients: ingredientLines,
    instructions,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Create Recipe</Text>
            <Pressable onPress={onClose} hitSlop={Spacing.two}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Recipe Name</Text>
              <TextInput
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="e.g. Protein Pancakes"
                placeholderTextColor={palette.textSecondary}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Add Ingredients</Text>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search your pantry"
                placeholderTextColor={palette.textSecondary}
                style={styles.input}
              />
              {matches.length > 0 && (
                <View style={styles.dropdown}>
                  {matches.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => handleAddIngredient(item)}
                      style={({ pressed }) => [styles.dropdownRow, pressed && styles.dropdownRowPressed]}>
                      <Text style={styles.dropdownName}>{item.name}</Text>
                      {item.brand && <Text style={styles.dropdownBrand}>{item.brand}</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {rows.length > 0 && (
              <View style={styles.rowsSection}>
                {rows.map((row) => (
                  <View key={row.key} style={styles.ingredientRow}>
                    <Text style={styles.ingredientName} numberOfLines={1}>
                      {row.ingredient.name}
                    </Text>
                    <TextInput
                      value={row.quantityText}
                      onChangeText={(text) => handleQuantityChange(row.key, text)}
                      keyboardType="decimal-pad"
                      style={styles.quantityInput}
                    />
                    <Text style={styles.quantityUnit}>g</Text>
                    <Pressable onPress={() => handleRemoveRow(row.key)} hitSlop={Spacing.two}>
                      <Text style={styles.removeLabel}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {rows.length > 0 && (
              <View style={styles.previewSection}>
                <RecipeCard recipe={previewRecipe} />
              </View>
            )}

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <Pressable
              onPress={handleGenerateDirections}
              disabled={!canGenerateDirections}
              style={({ pressed }) => [
                styles.outlineButton,
                !canGenerateDirections && styles.buttonDisabled,
                pressed && canGenerateDirections && styles.buttonPressed,
              ]}>
              {isGeneratingDirections ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <Text style={styles.outlineLabel}>Generate Directions</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveButton,
                !canSave && styles.buttonDisabled,
                pressed && canSave && styles.buttonPressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color={palette.accentText} />
              ) : (
                <Text style={styles.saveLabel}>Save Recipe</Text>
              )}
            </Pressable>
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
      position: 'relative',
      zIndex: 10,
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
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.one,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      borderWidth: 1,
      borderColor: palette.divider,
      overflow: 'hidden',
      zIndex: 20,
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    dropdownRowPressed: {
      backgroundColor: palette.field,
    },
    dropdownName: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: 600,
      color: palette.text,
    },
    dropdownBrand: {
      fontSize: 13,
      fontWeight: 700,
      color: palette.accent,
    },
    rowsSection: {
      gap: Spacing.two,
      marginBottom: Spacing.three,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      padding: Spacing.three,
    },
    ingredientName: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: 600,
      color: palette.text,
    },
    quantityInput: {
      width: 56,
      textAlign: 'center',
      backgroundColor: palette.field,
      borderRadius: Spacing.two,
      paddingVertical: Spacing.one,
      paddingHorizontal: Spacing.one,
      fontSize: 14,
      fontWeight: 600,
      color: palette.text,
    },
    quantityUnit: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    removeLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.error,
    },
    previewSection: {
      marginBottom: Spacing.three,
    },
    errorText: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.error,
      marginBottom: Spacing.two,
    },
    outlineButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: palette.divider,
      marginBottom: Spacing.two,
    },
    outlineLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.text,
    },
    saveButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
      marginBottom: Spacing.four,
    },
    saveLabel: {
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
  });
