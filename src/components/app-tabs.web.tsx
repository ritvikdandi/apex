import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';

const TAB_BAR_DEFAULT_HEIGHT = 49;
const PILL_PADDING = 8;
const OUTER_BACKGROUND = '#000000';
const PILL_CONTAINER_BACKGROUND = '#0a0a0a';
const ACTIVE_PILL_BACKGROUND = 'rgba(0, 255, 135, 0.15)';
const ACTIVE_COLOR = '#00FF87';
const INACTIVE_COLOR = '#555555';

const TABS = [
  { name: 'home', href: '/', label: 'Home' },
  { name: 'log', href: '/log', label: 'Log' },
  { name: 'pantry', href: '/pantry', label: 'Pantry' },
  { name: 'recipes', href: '/recipes', label: 'Recipes' },
  { name: 'meal-plan', href: '/meal-plan', label: 'Meals' },
  { name: 'water', href: '/water', label: 'Water' },
  { name: 'plan', href: '/plan', label: 'Plan' },
  { name: 'profile', href: '/profile', label: 'Profile' },
] as const satisfies { name: string; href: string; label: string }[];

type TabLayout = { x: number; width: number };

export default function AppTabs() {
  const [barHeight, setBarHeight] = useState(TAB_BAR_DEFAULT_HEIGHT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [layouts, setLayouts] = useState<Record<number, TabLayout>>({});

  const activeLayout = layouts[activeIndex];
  const allLayouts = Object.values(layouts);
  const groupBounds =
    allLayouts.length === TABS.length
      ? {
          start: Math.min(...allLayouts.map((l) => l.x)),
          end: Math.max(...allLayouts.map((l) => l.x + l.width)),
        }
      : null;

  return (
    <Tabs>
      <TabSlot style={{ flex: 1, paddingTop: barHeight }} />
      <TabList asChild>
        <View
          style={styles.outerBar}
          onLayout={(event: LayoutChangeEvent) => setBarHeight(event.nativeEvent.layout.height)}>
          {groupBounds && (
            <View
              style={[
                styles.pillBackground,
                {
                  transform: [{ translateX: groupBounds.start - PILL_PADDING }],
                  width: groupBounds.end - groupBounds.start + PILL_PADDING * 2,
                },
              ]}
            />
          )}
          {activeLayout && (
            <View
              style={[
                styles.activePill,
                { transform: [{ translateX: activeLayout.x }], width: activeLayout.width },
              ]}
            />
          )}
          {TABS.map((tab, index) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton
                index={index}
                onMeasured={(layout) => setLayouts((current) => ({ ...current, [index]: layout }))}
                onActive={setActiveIndex}>
                {tab.label}
              </TabButton>
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  index: number;
  onMeasured: (layout: TabLayout) => void;
  onActive: (index: number) => void;
};

function TabButton({ children, isFocused, index, onMeasured, onActive, ...props }: TabButtonProps) {
  useEffect(() => {
    if (isFocused) onActive(index);
  }, [isFocused, index, onActive]);

  const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Pressable
      {...props}
      onLayout={(event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        onMeasured({ x, width });
      }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Text style={[styles.tabLabel, { color }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: OUTER_BACKGROUND,
    paddingVertical: PILL_PADDING,
  },
  pillBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 50,
    backgroundColor: PILL_CONTAINER_BACKGROUND,
  },
  activePill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 20,
    backgroundColor: ACTIVE_PILL_BACKGROUND,
    transitionProperty: 'transform, width',
    transitionDuration: '200ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  tabButton: {
    zIndex: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
