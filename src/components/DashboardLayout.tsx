import { router, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings } from 'lucide-react-native';

import { NavigationDrawer } from '@/components/NavigationDrawer';
import { MeshBackground } from '@/components/ui/mesh-background';

type Props = {
  children: ReactNode;
};

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/roadmap': 'Roadmap',
  '/courses': 'Courses',
  '/notes': 'Notes',
  '/quiz': 'Quiz',
  '/timer': 'Timer',
  '/friends': 'Friends',
  '/leaderboard': 'Leaderboard',
  '/assistant': 'AI Assistant',
  '/settings': 'Settings',
};

function HeaderShell({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <View
        className="border-b border-white/[0.05] bg-white/[0.03]"
        // @ts-expect-error -- web-only backdrop blur
        style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        {children}
      </View>
    );
  }

  return (
    <View className="overflow-hidden border-b border-white/[0.05]">
      <BlurView
        intensity={28}
        tint="dark"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View className="bg-white/[0.03]">{children}</View>
    </View>
  );
}

export function DashboardLayout({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const title = TITLES[pathname] ?? 'Dashboard';

  return (
    <View className="flex-1 bg-void">
      <MeshBackground />

      <SafeAreaView className="flex-1" edges={['top']}>
        <HeaderShell>
          <View className="h-16 flex-row items-center justify-between px-4">
            <View className="min-w-0 flex-1 flex-row items-center gap-3">
              <Pressable
                onPress={() => setDrawerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
                hitSlop={8}
                className="p-2">
                <Menu size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
              </Pressable>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                className="min-w-0 flex-1 font-sans-medium text-base tracking-[-0.02em] text-white">
                {title}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
              className="shrink-0 p-2">
              <Settings size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.9} />
            </Pressable>
          </View>
        </HeaderShell>

        <View className="flex-1">{children}</View>
      </SafeAreaView>

      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}
