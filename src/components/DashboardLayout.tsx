import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Settings } from 'lucide-react-native';

import { NavigationDrawer } from '@/components/NavigationDrawer';
import { AtlasWordmark } from '@/components/ui/atlas-wordmark';
import { MeshBackground } from '@/components/ui/mesh-background';

type Props = {
  children: ReactNode;
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
      <View className="bg-white/[0.04]">{children}</View>
    </View>
  );
}

export function DashboardLayout({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View className="flex-1 bg-void">
      <MeshBackground />

      <SafeAreaView className="flex-1" edges={['top']}>
        <HeaderShell>
          <View className="h-16 flex-row items-center justify-between px-5">
            <Pressable
              onPress={() => setDrawerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06]">
              <Menu size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/dashboard')}
              accessibilityRole="button"
              accessibilityLabel="Go to home"
              hitSlop={8}>
              <AtlasWordmark size="sm" />
            </Pressable>

            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06]">
              <Settings size={18} color="rgba(255,255,255,0.7)" strokeWidth={1.9} />
            </Pressable>
          </View>
        </HeaderShell>

        <View className="flex-1">{children}</View>
      </SafeAreaView>

      <NavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}
