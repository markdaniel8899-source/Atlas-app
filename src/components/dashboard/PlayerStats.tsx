import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { GlassCard } from '@/components/ui/glass-card';
import { SoftGlow } from '@/components/ui/soft-glow';
import { getRankFromXP } from '@/lib/gamification';
import type { Profile } from '@/lib/db/types';

import { RankBadge } from './RankBadge';

interface Props {
  profile: Profile | null;
  loading: boolean;
}

function Skeleton() {
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <GlassCard className="p-6">
      <Animated.View style={{ opacity: pulse }} className="gap-5">
        <View className="flex-row gap-8">
          <View className="h-11 w-36 rounded-xl bg-white/[0.06]" />
          <View className="h-11 w-36 rounded-xl bg-white/[0.06]" />
        </View>
        <View className="h-2.5 w-full rounded-full bg-white/[0.05]" />
      </Animated.View>
    </GlassCard>
  );
}

export function PlayerStats({ profile, loading }: Props) {
  if (loading) return <Skeleton />;

  const rankData = getRankFromXP(profile?.xp ?? 0);
  const streak = profile?.streak ?? 0;

  return (
    <GlassCard className="relative overflow-hidden p-6">
      <SoftGlow color="#cf9eff" opacity={0.12} radius={144} style={{ top: -112, right: -64 }} />

      <View className="relative flex-row flex-wrap items-center gap-x-10 gap-y-6">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-400/[0.08]">
            <Flame size={20} color="#ff8f52" />
          </View>
          <View>
            <Text allowFontScaling={false} className="font-sans-semibold text-xl tabular-nums text-white">
              {streak}
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-0.5 text-xs font-medium uppercase tracking-[0.22em] text-white/35">
              day streak
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3 rounded-xl border border-transparent p-1">
          <RankBadge rank={rankData.tier.key} tier={rankData.current.step} size={44} />
          <View>
            <Text allowFontScaling={false} className="font-sans-semibold text-lg text-white">
              {rankData.name}
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-0.5 text-xs font-medium uppercase tracking-[0.22em] text-white/35">
              current rank
            </Text>
          </View>
        </View>

        <View className="ml-auto items-end">
          <Text allowFontScaling={false} className="font-mono text-lg tabular-nums text-white">
            {rankData.xpInto}
            <Text className="text-white/30"> / {rankData.xpNeed}</Text>
            <Text className="ml-2 text-xs text-[#cf9eff]">XP</Text>
          </Text>
          <Text
            allowFontScaling={false}
            className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-white/35">
            to {rankData.nextRankName ?? 'max rank'}
          </Text>
        </View>
      </View>

      <View className="relative mt-6">
        <ProgressBar percent={rankData.percent} colors={rankData.tier.gradientColors} />
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <Text allowFontScaling={false} className="min-w-0 flex-1 text-xs text-white/35" numberOfLines={1}>
            {Math.round(rankData.percent)}% of {rankData.name} complete
          </Text>
          <Text allowFontScaling={false} className="shrink-0 text-xs text-white/50" numberOfLines={1}>
            {profile ? `@${profile.username}` : 'unlinked profile'}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}
