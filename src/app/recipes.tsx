import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BuildAMealModal } from '@/components/build-a-meal-modal';
import { RecipeBuilderModal } from '@/components/recipe-builder-modal';
import { RecipeCard } from '@/components/recipe-card';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { addFoodLog, getTodayFoodLogs, type Macros } from '@/lib/food-log';
import { getUserIngredients, type UserIngredient } from '@/lib/ingredients';
import {
  deleteSavedRecipe,
  generateRecipes,
  getSavedRecipes,
  saveRecipe,
  type GeneratedRecipe,
  type SavedRecipe,
} from '@/lib/recipes';
import { calculateDailyMacros, calculateEstimatedTDEE } from '@/lib/tdee-engine';

export default function RecipesScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [pantryIngredients, setPantryIngredients] = useState<UserIngredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [generatedRecipes, setGeneratedRecipes] = useState<GeneratedRecipe[]>([]);
  const [loggedTotals, setLoggedTotals] = useState<Macros>({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const [isGenerating, setIsGenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBuildMealModal, setShowBuildMealModal] = useState(false);

  const loadPantry = useCallback(() => {
    if (!user) return;
    getUserIngredients(user.id).then(setPantryIngredients);
  }, [user]);

  const loadSavedRecipes = useCallback(() => {
    if (!user) return;
    getSavedRecipes(user.id).then(setSavedRecipes);
  }, [user]);

  const loadTodayLogs = useCallback(() => {
    if (!user) return;
    getTodayFoodLogs(user.id).then((entries) => {
      setLoggedTotals(
        entries.reduce(
          (acc, entry) => ({
            calories: acc.calories + entry.calories,
            proteinG: acc.proteinG + entry.proteinG,
            carbsG: acc.carbsG + entry.carbsG,
            fatG: acc.fatG + entry.fatG,
          }),
          { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
        )
      );
    });
  }, [user]);

  useEffect(() => {
    loadPantry();
    loadSavedRecipes();
    loadTodayLogs();
  }, [loadPantry, loadSavedRecipes, loadTodayLogs]);

  const dailyMacros = useMemo<Macros>(() => {
    const tdee = calculateEstimatedTDEE({
      weightLb: profile.weightLb,
      heightIn: profile.heightIn,
      age: profile.age,
      sex: profile.sex,
    });
    return calculateDailyMacros(Math.round(tdee), profile.weightLb);
  }, [profile]);

  const remainingMacros = useMemo<Macros>(
    () => ({
      calories: Math.max(0, dailyMacros.calories - loggedTotals.calories),
      proteinG: Math.max(0, dailyMacros.proteinG - loggedTotals.proteinG),
      carbsG: Math.max(0, dailyMacros.carbsG - loggedTotals.carbsG),
      fatG: Math.max(0, dailyMacros.fatG - loggedTotals.fatG),
    }),
    [dailyMacros, loggedTotals]
  );

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    const results = await generateRecipes(pantryIngredients, remainingMacros);
    setIsGenerating(false);
    if (results.length === 0) {
      setErrorMessage("Couldn't generate recipes — try again.");
      return;
    }
    setGeneratedRecipes(results);
  };

  const handleSaveGenerated = async (index: number) => {
    if (!user) return;
    setSavingIndex(index);
    await saveRecipe(user.id, generatedRecipes[index]);
    setSavingIndex(null);
    loadSavedRecipes();
  };

  const handleLogGenerated = async (index: number) => {
    if (!user) return;
    setLoggingIndex(index);
    const recipe = generatedRecipes[index];
    await addFoodLog(user.id, {
      description: recipe.name,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
    });
    setLoggingIndex(null);
    loadTodayLogs();
  };

  const handleLogSaved = async (recipe: SavedRecipe) => {
    if (!user) return;
    setLoggingIndex(-1);
    await addFoodLog(user.id, {
      description: recipe.name,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
    });
    setLoggingIndex(null);
    loadTodayLogs();
  };

  const handleDeleteSaved = (id: string) => {
    if (!user) return;
    setDeletingId(id);
    setSavedRecipes((current) => current.filter((item) => item.id !== id));
    deleteSavedRecipe(user.id, id).finally(() => setDeletingId(null));
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Recipes</Text>

          <View style={styles.topButtonRow}>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}>
              <Text style={styles.outlineLabel}>Create Recipe</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowBuildMealModal(true)}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}>
              <Text style={styles.outlineLabel}>Build a Meal</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            Using {pantryIngredients.length} ingredient{pantryIngredients.length === 1 ? '' : 's'} from your pantry
          </Text>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <Pressable
            onPress={handleGenerate}
            disabled={isGenerating}
            style={({ pressed }) => [
              styles.generateButton,
              isGenerating && styles.buttonDisabled,
              pressed && !isGenerating && styles.buttonPressed,
            ]}>
            {isGenerating ? (
              <ActivityIndicator color={palette.accentText} />
            ) : (
              <Text style={styles.generateLabel}>Generate Recipes</Text>
            )}
          </Pressable>

          <View style={styles.recipesSection}>
            {generatedRecipes.map((recipe, index) => (
              <RecipeCard
                key={index}
                recipe={recipe}
                onSave={() => handleSaveGenerated(index)}
                isSaving={savingIndex === index}
                onLog={() => handleLogGenerated(index)}
                isLogging={loggingIndex === index}
              />
            ))}
          </View>

          <View style={styles.savedHeaderRow}>
            <Text style={styles.sectionTitle}>Saved Recipes</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>{savedRecipes.length}</Text>
            </View>
          </View>

          {savedRecipes.length === 0 ? (
            <Text style={styles.emptyText}>No saved recipes yet. Generate some above!</Text>
          ) : (
            <View style={styles.recipesSection}>
              {savedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onLog={() => handleLogSaved(recipe)}
                  isLogging={loggingIndex === -1}
                  onDelete={() => handleDeleteSaved(recipe.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {user && (
        <RecipeBuilderModal
          visible={showCreateModal}
          userId={user.id}
          pantryIngredients={pantryIngredients}
          onClose={() => setShowCreateModal(false)}
          onSaved={loadSavedRecipes}
        />
      )}

      {user && (
        <BuildAMealModal
          visible={showBuildMealModal}
          userId={user.id}
          pantryIngredients={pantryIngredients}
          remainingMacros={remainingMacros}
          dailyMacros={dailyMacros}
          onClose={() => setShowBuildMealModal(false)}
          onSaved={loadSavedRecipes}
          onLogged={loadTodayLogs}
        />
      )}
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    safeArea: {
      flex: 1,
      width: '100%',
      maxWidth: MaxContentWidth,
      paddingHorizontal: Spacing.four,
      paddingBottom: BottomTabInset + Spacing.three,
    },
    themeToggleAnchor: {
      position: 'absolute',
      top: TopOverlayInset,
      right: Spacing.four,
      zIndex: 10,
    },
    scrollContent: {
      gap: Spacing.three,
      paddingTop: Spacing.six,
      paddingBottom: Spacing.six,
    },
    title: {
      fontSize: 34,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    topButtonRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    outlineButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: palette.divider,
    },
    outlineLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.text,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    errorText: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.error,
    },
    generateButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    generateLabel: {
      fontSize: 16,
      fontWeight: 700,
      color: palette.accentText,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    recipesSection: {
      gap: Spacing.three,
    },
    savedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.two,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    countBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: palette.field,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: palette.textSecondary,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.three,
    },
  });
