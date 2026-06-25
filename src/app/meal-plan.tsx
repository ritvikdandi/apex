import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealPlanCard } from '@/components/meal-plan-card';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { addFoodLog, type Macros } from '@/lib/food-log';
import { getUserIngredients, type UserIngredient } from '@/lib/ingredients';
import { generateMealPlan, loadMealPlan, saveMealPlan, type PlannedMeal } from '@/lib/meal-plan';
import { calculateDailyMacros, calculateEstimatedTDEE } from '@/lib/tdee-engine';

export default function MealPlanScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [pantryIngredients, setPantryIngredients] = useState<UserIngredient[]>([]);
  const [preferences, setPreferences] = useState('');
  const [meals, setMeals] = useState<PlannedMeal[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);
  const [isLoggingAll, setIsLoggingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPantry = useCallback(() => {
    if (!user) return;
    getUserIngredients(user.id).then(setPantryIngredients);
  }, [user]);

  useEffect(() => {
    loadPantry();
    loadMealPlan().then((saved) => {
      if (saved && saved.length > 0) setMeals(saved);
    });
  }, [loadPantry]);

  const dailyMacros = useMemo<Macros>(() => {
    const tdee = calculateEstimatedTDEE({
      weightLb: profile.weightLb,
      heightIn: profile.heightIn,
      age: profile.age,
      sex: profile.sex,
    });
    return calculateDailyMacros(Math.round(tdee), profile.weightLb);
  }, [profile]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    const results = await generateMealPlan(pantryIngredients, dailyMacros, preferences);
    setIsGenerating(false);
    if (results.length === 0) {
      setErrorMessage("Couldn't generate a meal plan — try again.");
      return;
    }
    setMeals(results);
    saveMealPlan(results);
  };

  const handleLogMeal = async (index: number) => {
    if (!user || !meals || meals[index].logged) return;
    setLoggingIndex(index);
    const meal = meals[index];
    await addFoodLog(user.id, {
      description: meal.name,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
    });
    const next = meals.map((item, itemIndex) => (itemIndex === index ? { ...item, logged: true } : item));
    setMeals(next);
    saveMealPlan(next);
    setLoggingIndex(null);
  };

  const handleLogAll = async () => {
    if (!user || !meals || isLoggingAll) return;
    setIsLoggingAll(true);
    const next = [...meals];
    for (let index = 0; index < next.length; index++) {
      if (next[index].logged) continue;
      const meal = next[index];
      await addFoodLog(user.id, {
        description: meal.name,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      });
      next[index] = { ...meal, logged: true };
    }
    setMeals(next);
    saveMealPlan(next);
    setIsLoggingAll(false);
  };

  const totals = useMemo<Macros>(() => {
    if (!meals) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    return meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        proteinG: acc.proteinG + meal.proteinG,
        carbsG: acc.carbsG + meal.carbsG,
        fatG: acc.fatG + meal.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  }, [meals]);

  const accuracyPercent = useMemo(() => {
    if (!meals || dailyMacros.calories === 0) return 0;
    const diff = Math.abs(totals.calories - dailyMacros.calories) / dailyMacros.calories;
    return Math.max(0, Math.round(100 - diff * 100));
  }, [meals, totals, dailyMacros]);

  const allLogged = meals ? meals.every((meal) => meal.logged) : false;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Meals</Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Describe how you like to eat (optional)</Text>
            <TextInput
              value={preferences}
              onChangeText={setPreferences}
              placeholder="e.g. overnight oats for breakfast, protein shake as snack, whole block of tofu for dinner..."
              placeholderTextColor={palette.textSecondary}
              multiline
              numberOfLines={3}
              style={styles.preferencesInput}
            />
          </View>

          <View style={styles.targetsCard}>
            <Text style={styles.sectionLabel}>Daily Macro Targets</Text>
            <View style={styles.macroRow}>
              <MacroMiniCard label="CAL" value={Math.round(dailyMacros.calories)} palette={palette} />
              <MacroMiniCard label="P" value={`${Math.round(dailyMacros.proteinG)}g`} palette={palette} />
              <MacroMiniCard label="C" value={`${Math.round(dailyMacros.carbsG)}g`} palette={palette} />
              <MacroMiniCard label="F" value={`${Math.round(dailyMacros.fatG)}g`} palette={palette} />
            </View>
          </View>

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
              <Text style={styles.generateLabel}>Generate Full Day Meal Plan</Text>
            )}
          </Pressable>

          {meals && meals.length > 0 && (
            <>
              <View style={styles.mealsSection}>
                {meals.map((meal, index) => (
                  <MealPlanCard
                    key={index}
                    meal={meal}
                    onLog={() => handleLogMeal(index)}
                    isLogging={loggingIndex === index}
                  />
                ))}
              </View>

              <Pressable
                onPress={handleLogAll}
                disabled={isLoggingAll || allLogged}
                style={({ pressed }) => [
                  styles.generateButton,
                  (isLoggingAll || allLogged) && styles.buttonDisabled,
                  pressed && !(isLoggingAll || allLogged) && styles.buttonPressed,
                ]}>
                {isLoggingAll ? (
                  <ActivityIndicator color={palette.accentText} />
                ) : (
                  <Text style={styles.generateLabel}>{allLogged ? 'All Meals Logged ✓' : 'Log All Meals'}</Text>
                )}
              </Pressable>

              <View style={styles.totalsCard}>
                <View style={styles.totalsHeaderRow}>
                  <Text style={styles.sectionLabel}>Daily Totals</Text>
                  <View style={styles.accuracyBadge}>
                    <Text style={styles.accuracyLabel}>{accuracyPercent}% accuracy</Text>
                  </View>
                </View>
                <View style={styles.macroRow}>
                  <MacroMiniCard label="CAL" value={Math.round(totals.calories)} palette={palette} />
                  <MacroMiniCard label="P" value={`${Math.round(totals.proteinG)}g`} palette={palette} />
                  <MacroMiniCard label="C" value={`${Math.round(totals.carbsG)}g`} palette={palette} />
                  <MacroMiniCard label="F" value={`${Math.round(totals.fatG)}g`} palette={palette} />
                </View>
                <Pressable
                  onPress={handleGenerate}
                  disabled={isGenerating}
                  style={({ pressed }) => [
                    styles.outlineButton,
                    isGenerating && styles.buttonDisabled,
                    pressed && !isGenerating && styles.buttonPressed,
                  ]}>
                  <Text style={styles.outlineLabel}>Regenerate</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
    section: {
      gap: Spacing.two,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    preferencesInput: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      padding: Spacing.three,
      fontSize: 15,
      fontWeight: 500,
      color: palette.text,
      minHeight: 80,
      textAlignVertical: 'top',
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    targetsCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.two,
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
    mealsSection: {
      gap: Spacing.three,
    },
    totalsCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    totalsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accuracyBadge: {
      backgroundColor: palette.field,
      borderRadius: 999,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    accuracyLabel: {
      fontSize: 12,
      fontWeight: 700,
      color: palette.accent,
    },
    outlineButton: {
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
  });
