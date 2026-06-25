import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
  addUserIngredient,
  deleteUserIngredient,
  estimateIngredientMacros,
  getUserIngredients,
  searchIngredients,
  type IngredientResult,
  type UserIngredient,
} from '@/lib/ingredients';

export default function PantryScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();

  const [ingredients, setIngredients] = useState<UserIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<IngredientResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<IngredientResult | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadIngredients = useCallback(() => {
    if (!user) return;
    setIsLoading(true);
    getUserIngredients(user.id).then((data) => {
      setIngredients(data);
      setIsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  useEffect(() => {
    if (selected) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const handle = setTimeout(() => {
      searchIngredients(trimmed).then((data) => {
        setResults(data);
        setShowDropdown(true);
      });
    }, 500);

    return () => clearTimeout(handle);
  }, [query, selected]);

  const handleChangeQuery = (text: string) => {
    setQuery(text);
    setSelected(null);
  };

  const handleSelectResult = (item: IngredientResult) => {
    setQuery(item.isAiEstimate ? query.trim() : item.name);
    setSelected(item);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (results.length > 0) setShowDropdown(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    blurTimeoutRef.current = setTimeout(() => setShowDropdown(false), 150);
  };

  const handleAdd = async () => {
    const name = query.trim();
    if (!name || !user || isAdding) return;
    setIsAdding(true);
    setErrorMessage(null);

    let ingredientData: Omit<UserIngredient, 'id'>;

    if (selected && !selected.isAiEstimate && selected.caloriesPerServing != null) {
      ingredientData = {
        name: selected.name,
        brand: selected.brand,
        servingSize: selected.servingSize,
        caloriesPerServing: selected.caloriesPerServing,
        proteinGPerServing: selected.proteinGPerServing,
        carbsGPerServing: selected.carbsGPerServing,
        fatGPerServing: selected.fatGPerServing,
      };
    } else {
      const estimate = await estimateIngredientMacros(name);
      if (!estimate) {
        setErrorMessage("Couldn't estimate macros — try again.");
        setIsAdding(false);
        return;
      }
      ingredientData = {
        name,
        brand: null,
        servingSize: estimate.servingSize,
        caloriesPerServing: estimate.calories,
        proteinGPerServing: estimate.proteinG,
        carbsGPerServing: estimate.carbsG,
        fatGPerServing: estimate.fatG,
      };
    }

    const { error } = await addUserIngredient(user.id, ingredientData);
    setIsAdding(false);
    if (error) {
      setErrorMessage(error);
      return;
    }

    setQuery('');
    setSelected(null);
    setResults([]);
    setShowDropdown(false);
    loadIngredients();
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    setIngredients((current) => current.filter((item) => item.id !== id));
    deleteUserIngredient(user.id, id);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>My Pantry</Text>
          <Text style={styles.subtitle}>
            Ingredients you have on hand — used to generate recipes and meal plans.
          </Text>

          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={handleChangeQuery}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Search for an ingredient"
                placeholderTextColor={palette.textSecondary}
                style={[styles.searchInput, isFocused && styles.searchInputFocused]}
              />
              <Pressable
                onPress={handleAdd}
                disabled={!query.trim() || isAdding}
                style={({ pressed }) => [
                  styles.addButton,
                  (!query.trim() || isAdding) && styles.addButtonDisabled,
                  pressed && styles.addButtonPressed,
                ]}>
                {isAdding ? (
                  <ActivityIndicator color={palette.accentText} />
                ) : (
                  <Text style={styles.addLabel}>Add</Text>
                )}
              </Pressable>
            </View>

            {showDropdown && results.length > 0 && (
              <View style={styles.dropdown}>
                {results.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectResult(item)}
                    style={({ pressed }) => [styles.dropdownRow, pressed && styles.dropdownRowPressed]}>
                    {item.isAiEstimate ? (
                      <Text style={styles.dropdownAiLabel}>{item.name}</Text>
                    ) : (
                      <>
                        <Text style={styles.dropdownName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.brand && (
                          <Text style={styles.dropdownBrand} numberOfLines={1}>
                            {item.brand}
                          </Text>
                        )}
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <View style={styles.listSection}>
            {ingredients.map((item) => (
              <View key={item.id} style={styles.ingredientRow}>
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  {item.caloriesPerServing != null && (
                    <Text style={styles.ingredientMacros}>
                      {Math.round(item.caloriesPerServing)}cal · {Math.round(item.proteinGPerServing ?? 0)}p
                      · {Math.round(item.carbsGPerServing ?? 0)}c · {Math.round(item.fatGPerServing ?? 0)}f
                      {item.servingSize ? ` per ${item.servingSize}` : ''}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => handleDelete(item.id)} hitSlop={Spacing.two}>
                  <SymbolView
                    name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                    tintColor={palette.error}
                    size={20}
                  />
                </Pressable>
              </View>
            ))}

            {!isLoading && ingredients.length === 0 && (
              <Text style={styles.emptyText}>No ingredients yet. Search above to add some.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
    subtitle: {
      fontSize: 15,
      fontWeight: 500,
      color: palette.textSecondary,
      marginTop: -Spacing.two,
    },
    searchSection: {
      position: 'relative',
      zIndex: 9999,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
      fontWeight: 500,
      color: palette.text,
      borderWidth: 1.5,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
    },
    searchInputFocused: {
      borderColor: palette.accent,
    },
    addButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    addButtonDisabled: {
      opacity: 0.4,
    },
    addButtonPressed: {
      opacity: 0.85,
    },
    addLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.accentText,
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
      zIndex: 9999,
      elevation: 12,
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
    dropdownAiLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: 600,
      color: palette.accent,
    },
    errorText: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.error,
    },
    listSection: {
      gap: Spacing.two,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      padding: Spacing.three,
      gap: Spacing.three,
    },
    ingredientInfo: {
      flex: 1,
      gap: 2,
    },
    ingredientName: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.text,
    },
    ingredientMacros: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.five,
    },
  });
