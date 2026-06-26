import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useProfile } from '@/contexts/profile-context';
import {
  COACH_DAILY_LIMIT,
  buildSystemPrompt,
  checkIsPaid,
  executeCoachAction,
  getDailyMessageCount,
  getRecentCoachMessages,
  incrementDailyCount,
  parseCoachAction,
  saveCoachMessage,
  type CoachMessage,
} from '@/lib/coach';
import { callClaudeWithMessages } from '@/lib/claude';

const COACH_GREEN = '#00FF87';
const OVERLAY_BG = '#111111';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const OVERLAY_HEIGHT = Math.round(SCREEN_HEIGHT * 0.75);

// Platform-specific position helpers
const fixedStyle = Platform.OS === 'web' ? ({ position: 'fixed' } as object) : {};
const absoluteFullFixed =
  Platform.OS === 'web'
    ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as object)
    : StyleSheet.absoluteFillObject;

export function CoachOverlay() {
  const { user } = useAuth();
  const { profile } = useProfile();

  const [isOpen, setIsOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmPill, setConfirmPill] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(OVERLAY_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (isOpen && user) {
      getRecentCoachMessages(user.id).then(setMessages);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  const openOverlay = useCallback(async () => {
    if (!user) return;

    const paid = await checkIsPaid(user.id);
    if (!paid) {
      setShowPaywall(true);
      return;
    }

    slideAnim.setValue(OVERLAY_HEIGHT);
    backdropAnim.setValue(0);
    setIsOpen(true);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver,
      }),
    ]).start();
  }, [user, slideAnim, backdropAnim, useNativeDriver]);

  const closeOverlay = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: OVERLAY_HEIGHT,
        duration: 250,
        useNativeDriver,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver,
      }),
    ]).start(() => setIsOpen(false));
  }, [slideAnim, backdropAnim, useNativeDriver]);

  const showConfirmation = (text: string) => {
    setConfirmPill(text);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmPill(null), 3000);
  };

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !user || isSending) return;

    const count = await getDailyMessageCount();
    if (count >= COACH_DAILY_LIMIT) {
      setMessages((prev) => [
        ...prev,
        {
          id: `limit-${Date.now()}`,
          role: 'assistant',
          content: `You've reached your ${COACH_DAILY_LIMIT} message daily limit. Check back tomorrow!`,
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    const userMsg: CoachMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      await Promise.all([saveCoachMessage(user.id, 'user', text), incrementDailyCount()]);

      const systemPrompt = await buildSystemPrompt(user.id, profile);

      // Send last 6 messages (5 history + current)
      const history = [...messages.slice(-5), userMsg].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const isMealPlan = text.toLowerCase().includes('meal plan');
      const rawResponse = await callClaudeWithMessages(
        history,
        systemPrompt,
        isMealPlan ? 600 : 400,
        'coachChat'
      );

      const { displayText, action } = parseCoachAction(rawResponse);

      await saveCoachMessage(user.id, 'assistant', displayText);

      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now() + 1}`,
          role: 'assistant',
          content: displayText,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (action) {
        const pill = await executeCoachAction(user.id, action, profile);
        if (pill) showConfirmation(pill);
      }
    } catch (err) {
      console.log('[CoachOverlay] send error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I couldn't connect right now. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [inputText, user, isSending, messages, profile]);

  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Pressable
          onPress={openOverlay}
          style={[styles.fab, fixedStyle]}
          accessibilityLabel="Open Coach">
          <Text style={styles.fabIcon}>💬</Text>
        </Pressable>
      )}

      {/* Paywall sheet */}
      {showPaywall && (
        <Pressable
          style={[styles.backdrop, absoluteFullFixed, { zIndex: 10001 }]}
          onPress={() => setShowPaywall(false)}>
          <View style={styles.paywallCard}>
            <Text style={styles.paywallTitle}>Upgrade to Coach</Text>
            <Text style={styles.paywallBody}>
              AI Coach is a premium feature. Upgrade to get personalized coaching, food logging via
              chat, and AI meal plan generation.
            </Text>
            <Pressable style={styles.paywallDismiss} onPress={() => setShowPaywall(false)}>
              <Text style={styles.paywallDismissLabel}>Maybe Later</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Backdrop */}
      {isOpen && (
        <Animated.View
          style={[
            styles.backdrop,
            absoluteFullFixed,
            { zIndex: 10001, opacity: backdropAnim },
          ]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOverlay} />
        </Animated.View>
      )}

      {/* Overlay panel */}
      {isOpen && (
        <Animated.View
          style={[
            styles.overlay,
            fixedStyle,
            { transform: [{ translateY: slideAnim }], zIndex: 10002 },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Coach</Text>
              <View style={styles.onlineDot} />
            </View>
            <Pressable onPress={closeOverlay} hitSlop={Spacing.two} style={styles.closeBtn}>
              <Text style={styles.closeBtnLabel}>✕</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    Hey! I'm Coach. Ask me anything about your nutrition or training, or tell me to
                    log food and water.
                  </Text>
                </View>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isSending && (
                <View style={[styles.bubbleWrapper, styles.bubbleWrapperCoach]}>
                  <View style={[styles.bubble, styles.bubbleCoach]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextCoach]}>• • •</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Confirmation pill */}
            {confirmPill && (
              <View style={styles.confirmRow}>
                <View style={styles.confirmPill}>
                  <Text style={styles.confirmPillText}>✓ {confirmPill}</Text>
                </View>
              </View>
            )}

            {/* Input bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask Coach..."
                placeholderTextColor="#555555"
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={Platform.OS !== 'web' ? handleSend : undefined}
                editable={!isSending}
              />
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || isSending}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!inputText.trim() || isSending) && styles.sendBtnDisabled,
                  pressed && styles.sendBtnPressed,
                ]}>
                <Text style={styles.sendBtnLabel}>↑</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperCoach]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    // position overridden per-platform inline — base here for native
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 24 : BottomTabInset + 16,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 10000,
    backgroundColor: COACH_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COACH_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 22,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlay: {
    // position overridden per-platform inline — base here for native
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: OVERLAY_HEIGHT,
    backgroundColor: OVERLAY_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COACH_GREEN,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnLabel: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    paddingTop: Spacing.six,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 22,
  },
  bubbleWrapper: {
    maxWidth: '80%',
  },
  bubbleWrapperUser: {
    alignSelf: 'flex-end',
  },
  bubbleWrapperCoach: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  bubbleUser: {
    backgroundColor: COACH_GREEN,
    borderBottomRightRadius: 4,
  },
  bubbleCoach: {
    backgroundColor: '#1e1e1e',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#000000',
    fontWeight: '500',
  },
  bubbleTextCoach: {
    color: '#FFFFFF',
  },
  confirmRow: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  confirmPill: {
    backgroundColor: 'rgba(0, 255, 135, 0.12)',
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: COACH_GREEN,
  },
  confirmPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COACH_GREEN,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
    backgroundColor: OVERLAY_BG,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.three : Spacing.two,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COACH_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 2,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendBtnPressed: {
    opacity: 0.75,
  },
  sendBtnLabel: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '800',
    marginTop: -2,
  },
  paywallCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  paywallTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paywallBody: {
    fontSize: 15,
    color: '#888888',
    lineHeight: 22,
  },
  paywallDismiss: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#2a2a2a',
    marginTop: Spacing.two,
  },
  paywallDismissLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
