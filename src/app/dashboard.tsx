import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasWordmark } from '@/components/ui/atlas-wordmark';
import { GlassCard } from '@/components/ui/glass-card';
import { MeshBackground } from '@/components/ui/mesh-background';
import { PrimaryButton } from '@/components/ui/primary-button';
import { supabase } from '@/lib/supabase';

export default function DashboardScreen() {
  const [displayName, setDisplayName] = useState('there');

  useEffect(() => {
    let cancelled = false;

    supabase?.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled || !data.user) return;
        const metadata = data.user.user_metadata as { name?: string } | undefined;
        const fallback = data.user.email?.split('@')[0];
        setDisplayName(metadata?.name || fallback || 'there');
      })
      .catch(() => {
        // Session lookup is best-effort; the greeting falls back to "there".
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-void">
      <MeshBackground />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="h-16 flex-row items-center justify-between px-6">
          <AtlasWordmark size="sm" />
        </View>

        <View className="flex-1 justify-center gap-6 px-7">
          <View className="gap-2">
            <Text
              allowFontScaling={false}
              className="font-mono-medium text-[11px] uppercase tracking-[1.6px] text-star">
              Dashboard
            </Text>
            <Text
              allowFontScaling={false}
              className="font-syne-bold text-[32px] leading-[38px] text-white">
              Hi {displayName}, here&apos;s your terrain.
            </Text>
            <Text
              allowFontScaling={false}
              className="font-sans text-[15px] leading-[22px] text-body">
              Player stats, focus timer, today&apos;s focus and the activity heatmap are the next
              build step.
            </Text>
          </View>

          <GlassCard className="p-6">
            <Text
              allowFontScaling={false}
              className="font-sans text-[14px] leading-[20px] text-white/60">
              Signed in. This shell is the landing point for the five dashboard sections from the
              web audit.
            </Text>
          </GlassCard>

          <PrimaryButton label="Sign out" variant="outline" onPress={() => void signOut()} />
        </View>
      </SafeAreaView>
    </View>
  );
}
