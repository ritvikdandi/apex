import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, Svg } from 'react-native-svg';

import { ThemeToggle } from '@/components/theme-toggle';
import type { AppPalette } from '@/constants/palette';
import { BottomTabInset, MaxContentWidth, Spacing, TopOverlayInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { addWaterLog, defaultWaterGoalOz, getTodayWaterLogs, resetTodayWaterLogs, type WaterLogEntry } from '@/lib/water';

const QUICK_AMOUNTS_OZ = [8, 16, 24];
const RING_SIZE = 240;
const RING_STROKE = 18;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function motivationalLabel(progress: number): string {
  if (progress >= 1) return 'Goal reached! 💧';
  if (progress >= 0.75) return 'Almost done!';
  if (progress >= 0.4) return 'Halfway there!';
  return 'Stay hydrated';
}

export default function WaterScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { user } = useAuth();
  const { profile } = useProfile();

  const [entries, setEntries] = useState<WaterLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goalOz = defaultWaterGoalOz(profile.weightLb);

  const loadEntries = useCallback(() => {
    if (!user) return;
    getTodayWaterLogs(user.id).then((data) => {
      setEntries(data);
      setIsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const todayTotalOz = useMemo(() => entries.reduce((sum, entry) => sum + entry.amountOz, 0), [entries]);
  const progress = goalOz > 0 ? Math.min(1, todayTotalOz / goalOz) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const handleLog = async (amountOz: number) => {
    if (!user || isLogging || amountOz <= 0) return;
    setIsLogging(true);
    setErrorMessage(null);
    const { error } = await addWaterLog(user.id, amountOz);
    if (error) {
      setErrorMessage(error);
    } else {
      loadEntries();
    }
    setIsLogging(false);
  };

  const handleLogCustom = () => {
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    handleLog(amount);
    setCustomAmount('');
  };

  const handleReset = async () => {
    if (!user || isLogging) return;
    setIsLogging(true);
    setErrorMessage(null);
    const { error } = await resetTodayWaterLogs(user.id);
    if (error) {
      setErrorMessage(error);
    } else {
      loadEntries();
    }
    setIsLogging(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {Platform.OS !== 'web' && (
          <View style={styles.themeToggleAnchor}>
            <ThemeToggle />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>Water</Text>

          <View style={styles.ringSection}>
            <View style={styles.ringWrapper}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={palette.field}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={palette.accent}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
                  fill="none"
                />
              </Svg>

              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={styles.ringValue}>{isLoading ? '–' : Math.round(todayTotalOz)}</Text>
                <Text style={styles.ringTarget}>of {Math.round(goalOz)} oz</Text>
                <Text style={styles.ringMotivation}>{motivationalLabel(progress)}</Text>
              </View>
            </View>
          </View>

          {errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Quick Add</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS_OZ.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => handleLog(amount)}
                disabled={isLogging}
                style={({ pressed }) => [
                  styles.quickCard,
                  pressed && styles.buttonPressed,
                  isLogging && styles.buttonDisabled,
                ]}>
                <Text style={styles.quickLabel}>+{amount} oz</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Custom Amount</Text>
          <View style={styles.customRow}>
            <TextInput
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="Amount in oz"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
              style={styles.customInput}
              onSubmitEditing={handleLogCustom}
              returnKeyType="done"
            />
            <Pressable
              onPress={handleLogCustom}
              disabled={isLogging || !customAmount.trim()}
              style={({ pressed }) => [
                styles.addButton,
                (isLogging || !customAmount.trim()) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}>
              {isLogging ? <ActivityIndicator color={palette.accentText} /> : <Text style={styles.addLabel}>Add</Text>}
            </Pressable>
          </View>

          <Pressable
            onPress={handleReset}
            disabled={isLogging}
            style={({ pressed }) => [styles.resetButton, pressed && styles.buttonPressed]}>
            <Text style={styles.resetLabel}>Reset Today</Text>
          </Pressable>
        </View>
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
    content: {
      flex: 1,
      gap: Spacing.three,
      paddingTop: Spacing.six,
    },
    title: {
      fontSize: 34,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -0.5,
    },
    ringSection: {
      alignItems: 'center',
      paddingVertical: Spacing.four,
    },
    ringWrapper: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      gap: Spacing.one,
    },
    ringValue: {
      fontSize: 56,
      fontWeight: 800,
      color: palette.text,
      letterSpacing: -1,
    },
    ringTarget: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    ringMotivation: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.accent,
      marginTop: Spacing.one,
    },
    errorCard: {
      backgroundColor: palette.error,
      borderRadius: Spacing.three,
      padding: Spacing.three,
    },
    errorText: {
      fontSize: 14,
      fontWeight: 600,
      color: palette.accentText,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: palette.textSecondary,
    },
    quickRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    quickCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.four,
      borderRadius: Spacing.three,
      backgroundColor: palette.surface,
    },
    quickLabel: {
      fontSize: 17,
      fontWeight: 800,
      color: palette.accent,
    },
    customRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    customInput: {
      flex: 1,
      backgroundColor: palette.surface,
      borderRadius: Spacing.three,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
      fontWeight: 500,
      color: palette.text,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
    },
    addButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.five,
      borderRadius: Spacing.three,
      backgroundColor: palette.accent,
    },
    addLabel: {
      fontSize: 15,
      fontWeight: 700,
      color: palette.accentText,
    },
    resetButton: {
      alignItems: 'center',
      paddingVertical: Spacing.three,
    },
    resetLabel: {
      fontSize: 14,
      fontWeight: 700,
      color: palette.error,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonPressed: {
      opacity: 0.85,
    },
  });
