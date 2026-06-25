import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AppPalette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

type WeightLogModalProps = {
  visible: boolean;
  initialWeightLb: number;
  onSave: (weightLb: number) => void;
  onClose: () => void;
};

export function WeightLogModal({ visible, initialWeightLb, onSave, onClose }: WeightLogModalProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setText(initialWeightLb.toFixed(1));
    }
  }, [visible, initialWeightLb]);

  const parsed = Number(text);
  const isValid = text.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave(parsed);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Log Weight</Text>
          <Text style={styles.subtitle}>Enter today&apos;s bodyweight</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="0.0"
              placeholderTextColor={palette.textSecondary}
              keyboardType="decimal-pad"
              style={styles.input}
              autoFocus
            />
            <Text style={styles.unit}>lb</Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.saveButton,
              !isValid && styles.saveButtonDisabled,
              pressed && isValid && styles.saveButtonPressed,
            ]}>
            <Text style={styles.saveLabel}>Save</Text>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={Spacing.two}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
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
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.four,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: palette.surface,
      borderRadius: Spacing.four,
      padding: Spacing.five,
      gap: Spacing.three,
    },
    title: {
      fontSize: 22,
      fontWeight: 700,
      color: palette.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      fontWeight: 500,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: -Spacing.two,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: Spacing.two,
    },
    input: {
      fontSize: 48,
      fontWeight: 800,
      color: palette.text,
      minWidth: 120,
      textAlign: 'right',
      paddingVertical: Spacing.two,
    },
    unit: {
      fontSize: 20,
      fontWeight: 600,
      color: palette.textSecondary,
    },
    saveButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.three,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonPressed: {
      opacity: 0.85,
    },
    saveLabel: {
      fontSize: 17,
      fontWeight: 700,
      color: palette.accentText,
    },
    cancelLabel: {
      fontSize: 15,
      fontWeight: 600,
      color: palette.textSecondary,
      textAlign: 'center',
    },
  });
