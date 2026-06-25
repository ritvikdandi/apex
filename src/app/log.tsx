import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
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
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import {
  addFoodLog,
  deleteFoodLog,
  getTodayFoodLogs,
  parseFoodDescription,
  saveRecipeFromEntry,
  type FoodLogEntry,
  type Macros,
  type PendingFoodEntry,
} from '@/lib/food-log';
import { calculateDailyMacros, calculateEstimatedTDEE } from '@/lib/tdee-engine';

export default function LogScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [pending, setPending] = useState<PendingFoodEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEntries = useCallback(() => {
    if (!user) return;
    setIsLoading(true);
    getTodayFoodLogs(user.id).then((data) => {
      setEntries(data);
      setIsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const targets = useMemo<Macros>(() => {
    const tdee = calculateEstimatedTDEE({
      weightLb: profile.weightLb,
      heightIn: profile.heightIn,
      age: profile.age,
      sex: profile.sex,
    });
    return calculateDailyMacros(Math.round(tdee), profile.weightLb);
  }, [profile]);

  const totals = useMemo<Macros>(
    () =>
      entries.reduce(
        (acc, entry) => ({
          calories: acc.calories + entry.calories,
          proteinG: acc.proteinG + entry.proteinG,
          carbsG: acc.carbsG + entry.carbsG,
          fatG: acc.fatG + entry.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [entries]
  );

  const handleSubmit = async () => {
    const description = inputText.trim();
    if (!description || isParsing) return;
    setErrorMessage(null);
    setIsParsing(true);
    const result = await parseFoodDescription(description);
    setIsParsing(false);
    if (!result) {
      setErrorMessage("Couldn't parse that — try rephrasing.");
      return;
    }
    setPending(result);
  };

  const handleConfirm = async () => {
    if (!pending || !user || isSaving) return;
    setIsSaving(true);
    const { error } = await addFoodLog(user.id, pending);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setPending(null);
    setInputText('');
    loadEntries();
  };

  const handleSaveAsRecipe = async () => {
    if (!pending || !user || isSaving) return;
    setIsSaving(true);
    await saveRecipeFromEntry(user.id, pending);
    const { error } = await addFoodLog(user.id, pending);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setPending(null);
    setInputText('');
    loadEntries();
  };

  const handleDiscardPending = () => {
    setPending(null);
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    deleteFoodLog(user.id, id);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <Text style={styles.title}>Log</Text>

              <View style={styles.summaryCard}>
                <View style={styles.calorieRow}>
                  <Text style={styles.calorieValue}>{Math.round(totals.calories)}</Text>
                  <Text style={styles.calorieTarget}>/ {Math.round(targets.calories)} kcal</Text>
                </View>
                <ProgressBar
                  value={totals.calories}
                  target={targets.calories}
                  color={palette.accent}
                  trackColor={palette.field}
                />

                <View style={styles.macroRow}>
                  <MacroStat
                    label="Protein"
                    value={totals.proteinG}
                    target={targets.proteinG}
                    color="#0A84FF"
                    palette={palette}
                  />
                  <MacroStat
                    label="Carbs"
                    value={totals.carbsG}
                    target={targets.carbsG}
                    color="#FF9F0A"
                    palette={palette}
                  />
                  <MacroStat
                    label="Fat"
                    value={totals.fatG}
                    target={targets.fatG}
                    color="#FF453A"
                    palette={palette}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="e.g. 2 eggs and a slice of toast"
                  placeholderTextColor={palette.textSecondary}
                  style={styles.input}
                  editable={!isParsing}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={handleSubmit}
                  disabled={!inputText.trim() || isParsing}
                  style={({ pressed }) => [
                    styles.addButton,
                    (!inputText.trim() || isParsing) && styles.addButtonDisabled,
                    pressed && styles.addButtonPressed,
                  ]}>
                  {isParsing ? (
                    <ActivityIndicator color={palette.accentText} />
                  ) : (
                    <SymbolView
                      name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                      tintColor={palette.accentText}
                      size={18}
                    />
                  )}
                </Pressable>
              </View>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              {pending && (
                <View style={styles.pendingCard}>
                  <Text style={styles.pendingTitle}>{pending.description}</Text>
                  <Text style={styles.pendingMacros}>
                    {Math.round(pending.calories)} kcal · P {Math.round(pending.proteinG)}g · C{' '}
                    {Math.round(pending.carbsG)}g · F {Math.round(pending.fatG)}g
                  </Text>
                  <View style={styles.pendingActions}>
                    <Pressable
                      onPress={handleConfirm}
                      disabled={isSaving}
                      style={({ pressed }) => [
                        styles.pendingPrimaryButton,
                        pressed && styles.addButtonPressed,
                      ]}>
                      {isSaving ? (
                        <ActivityIndicator color={palette.accentText} />
                      ) : (
                        <Text style={styles.pendingPrimaryLabel}>Log It</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleSaveAsRecipe}
                      disabled={isSaving}
                      style={({ pressed }) => [
                        styles.pendingSecondaryButton,
                        pressed && styles.addButtonPressed,
                      ]}>
                      <Text style={styles.pendingSecondaryLabel}>Save as Recipe</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={handleDiscardPending} hitSlop={Spacing.two}>
                    <Text style={styles.pendingCancelLabel}>Discard</Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.sectionLabel}>Today</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.entryRow}>
              <View style={styles.entryInfo}>
                <Text style={styles.entryTitle}>{item.description}</Text>
                <Text style={styles.entryMacros}>
                  {Math.round(item.calories)} kcal · P {Math.round(item.proteinG)}g · C{' '}
                  {Math.round(item.carbsG)}g · F {Math.round(item.fatG)}g
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)} hitSlop={Spacing.two}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  tintColor={palette.textSecondary}
                  size={18}
                />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>Nothing logged yet today. Add your first meal above.</Text>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

type ProgressBarProps = {
  value: number;
  target: number;
  color: string;
  trackColor: string;
};

function ProgressBar({ value, target, color, trackColor }: ProgressBarProps) {
  const ratio = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <View style={[barStyles.track, { backgroundColor: trackColor }]}>
      <View style={[barStyles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});

type MacroStatProps = {
  label: string;
  value: number;
  target: number;
  color: string;
  palette: AppPalette;
};

function MacroStat({ label, value, target, color, palette }: MacroStatProps) {
  return (
    <View style={macroStyles.container}>
      <Text style={[macroStyles.value, { color: palette.text }]}>
        {Math.round(value)}
        <Text style={[macroStyles.unit, { color: palette.textSecondary }]}> / {Math.round(target)}g</Text>
      </Text>
      <ProgressBar value={value} target={target} color={color} trackColor={palette.field} />
      <Text style={[macroStyles.label, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.one,
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
  },
  unit: {
    fontSize: 12,
    fontWeight: 500,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
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
    listContent: {
      paddingBottom: Spacing.six,
    },
    headerSection: {
      gap: Spacing.three,
      paddingTop: Spacing.six,
      paddingBottom: Spacing.two,
    },
    title: {
      fontSize: 34,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    summaryCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    calorieRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.one,
    },
    calorieValue: {
      fontSize: 32,
      fontWeight: 800,
      color: palette.text,
    },
    calorieTarget: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.four,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    input: {
      flex: 1,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
      fontWeight: 500,
      color: palette.text,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
    },
    addButtonDisabled: {
      opacity: 0.4,
    },
    addButtonPressed: {
      opacity: 0.85,
    },
    errorText: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.error,
    },
    pendingCard: {
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.four,
      gap: Spacing.two,
      borderWidth: 1,
      borderColor: palette.accent,
    },
    pendingTitle: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.text,
    },
    pendingMacros: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
    },
    pendingActions: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    pendingPrimaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    pendingPrimaryLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.accentText,
    },
    pendingSecondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
      borderRadius: 999,
      backgroundColor: palette.field,
    },
    pendingSecondaryLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.text,
    },
    pendingCancelLabel: {
      fontSize: 13,
      fontWeight: 600,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.one,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      color: palette.textSecondary,
      marginTop: Spacing.two,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      padding: Spacing.three,
      marginTop: Spacing.two,
      gap: Spacing.three,
    },
    entryInfo: {
      flex: 1,
      gap: 2,
    },
    entryTitle: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.text,
    },
    entryMacros: {
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
