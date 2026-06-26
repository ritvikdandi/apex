import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
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
  updateUserIngredient,
  type IngredientResult,
  type UserIngredient,
} from '@/lib/ingredients';

// ─── Expandable Ingredient Row ───────────────────────────────────────────────

type IngredientRowProps = {
  item: UserIngredient;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (item: UserIngredient) => void;
  onDelete: (id: string) => void;
  palette: AppPalette;
  styles: ReturnType<typeof createStyles>;
};

function IngredientRow({ item, isExpanded, onToggle, onEdit, onDelete, palette, styles }: IngredientRowProps) {
  const anim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, anim]);

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });
  const opacity = anim;

  return (
    <View style={styles.ingredientCard}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.ingredientHeader, pressed && styles.rowPressed]}>
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName}>{item.name}</Text>
          {item.brand ? (
            <Text style={styles.ingredientBrand}>{item.brand}</Text>
          ) : item.caloriesPerServing != null ? (
            <Text style={styles.ingredientMacroSummary}>
              {Math.round(item.caloriesPerServing)} cal · {Math.round(item.proteinGPerServing ?? 0)}p ·{' '}
              {Math.round(item.carbsGPerServing ?? 0)}c · {Math.round(item.fatGPerServing ?? 0)}f
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
      </Pressable>

      <Animated.View style={[styles.expandedSection, { maxHeight, opacity, overflow: 'hidden' }]}>
        <View style={styles.expandedInner}>
          {/* Macro grid */}
          {item.caloriesPerServing != null && (
            <View style={styles.macroGrid}>
              <MacroCell label="Calories" value={`${Math.round(item.caloriesPerServing)}`} unit="kcal" palette={palette} />
              <MacroCell label="Protein" value={`${Math.round(item.proteinGPerServing ?? 0)}`} unit="g" palette={palette} />
              <MacroCell label="Carbs" value={`${Math.round(item.carbsGPerServing ?? 0)}`} unit="g" palette={palette} />
              <MacroCell label="Fat" value={`${Math.round(item.fatGPerServing ?? 0)}`} unit="g" palette={palette} />
            </View>
          )}

          {item.servingSize && (
            <Text style={styles.servingSize}>Per {item.servingSize}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.expandedActions}>
            <Pressable
              onPress={() => onEdit(item)}
              style={({ pressed }) => [styles.editButton, pressed && styles.rowPressed]}>
              <Text style={styles.editButtonLabel}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => onDelete(item.id)}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.rowPressed]}>
              <Text style={styles.deleteButtonLabel}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function MacroCell({ label, value, unit, palette }: { label: string; value: string; unit: string; palette: AppPalette }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: palette.text }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.accent }}>{unit}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

type EditModalProps = {
  item: UserIngredient | null;
  visible: boolean;
  onSave: (id: string, patch: Partial<Omit<UserIngredient, 'id'>>) => Promise<void>;
  onClose: () => void;
  palette: AppPalette;
  styles: ReturnType<typeof createStyles>;
};

function EditIngredientModal({ item, visible, onSave, onClose, palette, styles }: EditModalProps) {
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setCalories(String(Math.round(item.caloriesPerServing ?? 0)));
      setProtein(String(Math.round(item.proteinGPerServing ?? 0)));
      setCarbs(String(Math.round(item.carbsGPerServing ?? 0)));
      setFat(String(Math.round(item.fatGPerServing ?? 0)));
      setServingSize(item.servingSize ?? '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    setIsSaving(true);
    await onSave(item.id, {
      caloriesPerServing: Number(calories) || 0,
      proteinGPerServing: Number(protein) || 0,
      carbsGPerServing: Number(carbs) || 0,
      fatGPerServing: Number(fat) || 0,
      servingSize: servingSize.trim() || null,
    });
    setIsSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{item?.name ?? ''}</Text>

          <View style={styles.modalRow}>
            <MacroInputField label="Calories" value={calories} onChangeText={setCalories} palette={palette} styles={styles} />
            <MacroInputField label="Protein (g)" value={protein} onChangeText={setProtein} palette={palette} styles={styles} />
          </View>
          <View style={styles.modalRow}>
            <MacroInputField label="Carbs (g)" value={carbs} onChangeText={setCarbs} palette={palette} styles={styles} />
            <MacroInputField label="Fat (g)" value={fat} onChangeText={setFat} palette={palette} styles={styles} />
          </View>

          <Text style={styles.modalLabel}>Serving Size</Text>
          <TextInput
            value={servingSize}
            onChangeText={setServingSize}
            placeholder="e.g. 100g, 1 cup"
            placeholderTextColor={palette.textSecondary}
            style={styles.modalInput}
            returnKeyType="done"
          />

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.modalCancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }]}>
              {isSaving ? (
                <ActivityIndicator color={palette.accentText} />
              ) : (
                <Text style={styles.modalSaveLabel}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MacroInputField({ label, value, onChangeText, palette, styles }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  palette: AppPalette;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.modalLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        style={styles.modalInput}
        returnKeyType="next"
        placeholderTextColor={palette.textSecondary}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<UserIngredient | null>(null);

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
    if (expandedId === id) setExpandedId(null);
    deleteUserIngredient(user.id, id);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const handleSaveEdit = async (id: string, patch: Partial<Omit<UserIngredient, 'id'>>) => {
    if (!user) return;
    await updateUserIngredient(user.id, id, patch);
    setEditingItem(null);
    loadIngredients();
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
              <IngredientRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => handleToggleExpand(item.id)}
                onEdit={setEditingItem}
                onDelete={handleDelete}
                palette={palette}
                styles={styles}
              />
            ))}

            {!isLoading && ingredients.length === 0 && (
              <Text style={styles.emptyText}>No ingredients yet. Search above to add some.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <EditIngredientModal
        item={editingItem}
        visible={editingItem !== null}
        onSave={handleSaveEdit}
        onClose={() => setEditingItem(null)}
        palette={palette}
        styles={styles}
      />
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
    // Ingredient card (collapsed + expanded)
    ingredientCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      overflow: 'hidden',
    },
    ingredientHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.three,
      gap: Spacing.two,
    },
    rowPressed: {
      opacity: 0.75,
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
    ingredientBrand: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    ingredientMacroSummary: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    chevron: {
      fontSize: 20,
      fontWeight: 600,
      color: palette.textSecondary,
      transform: [{ rotate: '0deg' }],
    },
    chevronOpen: {
      transform: [{ rotate: '90deg' }],
    },
    // Expanded section
    expandedSection: {},
    expandedInner: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
      gap: Spacing.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.divider,
      paddingTop: Spacing.three,
    },
    macroGrid: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    servingSize: {
      fontSize: 13,
      fontWeight: 500,
      color: palette.textSecondary,
      marginTop: -Spacing.two,
    },
    expandedActions: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    editButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: palette.accent,
    },
    editButtonLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.accent,
    },
    deleteButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: palette.error,
    },
    deleteButtonLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: '#FFFFFF',
    },
    emptyText: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.five,
    },
    // Edit modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.four,
      gap: Spacing.three,
      paddingBottom: Spacing.six,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 700,
      color: palette.text,
    },
    modalRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    modalLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: -Spacing.one,
    },
    modalInput: {
      backgroundColor: palette.field,
      borderRadius: Spacing.two,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
      fontWeight: 500,
      color: palette.text,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    modalCancelBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.field,
    },
    modalCancelLabel: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.text,
    },
    modalSaveBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    modalSaveLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.accentText,
    },
  });
