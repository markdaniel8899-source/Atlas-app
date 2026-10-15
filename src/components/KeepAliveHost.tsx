import { usePathname } from 'expo-router';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import AssistantScreen from '@/app/(app)/assistant';
import CoursesScreen from '@/app/(app)/courses';
import HomeScreen from '@/app/(app)/dashboard';
import FriendsScreen from '@/app/(app)/friends';
import LeaderboardScreen from '@/app/(app)/leaderboard';
import NotesScreen from '@/app/(app)/notes';
import QuizScreen from '@/app/(app)/quiz';
import RoadmapScreen from '@/app/(app)/roadmap';
import SettingsScreen from '@/app/(app)/settings';
import TimerScreen from '@/app/(app)/timer';

const FADE_MS = 300;
const DEFAULT_ROUTE = '/dashboard';

const TABS: { route: string; Component: ComponentType }[] = [
  { route: '/dashboard', Component: HomeScreen },
  { route: '/roadmap', Component: RoadmapScreen },
  { route: '/courses', Component: CoursesScreen },
  { route: '/notes', Component: NotesScreen },
  { route: '/quiz', Component: QuizScreen },
  { route: '/timer', Component: TimerScreen },
  { route: '/friends', Component: FriendsScreen },
  { route: '/leaderboard', Component: LeaderboardScreen },
  { route: '/assistant', Component: AssistantScreen },
  { route: '/settings', Component: SettingsScreen },
];

function Slot({ active, children }: { active: boolean; children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, opacity]);

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { opacity, zIndex: active ? 1 : 0 }]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

export function KeepAliveHost() {
  const pathname = usePathname();
  const activeRoute = TABS.some((tab) => tab.route === pathname) ? pathname : DEFAULT_ROUTE;
  const [mounted, setMounted] = useState<string[]>([activeRoute]);

  if (!mounted.includes(activeRoute)) {
    setMounted([...mounted, activeRoute]);
  }

  return (
    <View className="flex-1">
      {TABS.filter((tab) => mounted.includes(tab.route)).map((tab) => (
        <Slot key={tab.route} active={tab.route === activeRoute}>
          <tab.Component />
        </Slot>
      ))}
    </View>
  );
}
