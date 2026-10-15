import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Loader, Medal, Trophy, Zap } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { useUserId } from '@/hooks/useUserId';
import { RevealText } from '@/components/ui/reveal-text';
import { fetchWeeklyLeaderboard } from '@/lib/db/leaderboard';
import { getRankFromXP } from '@/lib/gamification';
import type { LeaderboardEntry } from '@/lib/db/types';

const PODIUM: Record<
  number,
  {
    positionColor: string;
    icon: string;
    zapColor: string;
    weeklyColor: string;
    gradient: readonly [string, string, string] | null;
    solid: string | null;
    border: string;
    shine: string;
  }
> = {
  1: {
    positionColor: '#facc15',
    icon: '🥇',
    zapColor: '#fde047',
    weeklyColor: 'rgba(254,240,138,0.7)',
    gradient: null,
    solid: 'rgba(250,204,21,0.15)',
    border: 'rgba(250,204,21,0.4)',
    shine: 'rgba(255,255,255,0.2)',
  },
  2: {
    positionColor: '#e5e7eb',
    icon: '🥈',
    zapColor: '#e5e7eb',
    weeklyColor: 'rgba(243,244,246,0.8)',
    gradient: [
      'rgba(203,213,225,0.2)',
      'rgba(161,161,170,0.15)',
      'rgba(161,161,161,0.1)',
    ],
    solid: null,
    border: 'rgba(161,161,170,0.4)',
    shine: 'rgba(255,255,255,0.4)',
  },
  3: {
    positionColor: '#d8b4fe',
    icon: '🥉',
    zapColor: '#d8b4fe',
    weeklyColor: 'rgba(233,213,255,0.8)',
    gradient: [
      'rgba(192,132,252,0.2)',
      'rgba(167,139,250,0.15)',
      'rgba(232,121,249,0.1)',
    ],
    solid: null,
    border: 'rgba(192,132,252,0.4)',
    shine: 'rgba(233,213,255,0.3)',
  },
};

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-700 to-slate-800"
      style={{ width: size, height: size }}>
      {entry.avatarUrl ? (
        <Image
          source={{ uri: entry.avatarUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text
          allowFontScaling={false}
          className="font-sans-semibold text-white"
          style={{ fontSize: size * 0.32 }}>
          {entry.initials}
        </Text>
      )}
    </View>
  );
}

function YouBadge() {
  return (
    <View className="shrink-0 rounded-full border border-white/40 bg-white/15 px-3 py-1">
      <Text
        allowFontScaling={false}
        className="font-sans-bold text-xs uppercase tracking-wider text-white">
        You
      </Text>
    </View>
  );
}

function RankPill({ totalXp }: { totalXp: number }) {
  const rank = getRankFromXP(totalXp);
  return (
    <View
      className="rounded-md border px-3 py-1.5"
      style={{
        borderColor: rank.tier.pillBorder,
        backgroundColor: rank.tier.pillBg,
      }}>
      <Text
        allowFontScaling={false}
        className="font-sans-semibold text-base"
        style={{ color: rank.tier.pillText }}>
        {rank.name}
      </Text>
    </View>
  );
}

function Streak({ days }: { days: number }) {
  return (
    <View className="flex-row items-center gap-1">
      <Flame size={12} color="rgba(252,211,77,0.8)" />
      <Text
        allowFontScaling={false}
        className="font-sans text-base text-white/55">
        {days}d
      </Text>
    </View>
  );
}

function PodiumShine({ color }: { color: string }) {
  const x = useState(() => new Animated.Value(-160))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 420,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: 420,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      className="overflow-hidden rounded-xl">
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 110,
          transform: [{ translateX: x }, { skewX: '-28deg' }],
          opacity: 0.7,
        }}>
        <LinearGradient
          colors={['transparent', color, color, 'transparent']}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

function PodiumRow({
  entry,
  place,
}: {
  entry: LeaderboardEntry;
  place: number;
}) {
  const style = PODIUM[place];

  return (
    <View
      className="relative overflow-hidden rounded-xl border"
      style={{
        borderColor: style.border,
        backgroundColor: style.solid ?? undefined,
      }}>
      {style.gradient ? (
        <LinearGradient
          colors={style.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <PodiumShine color={style.shine} />

      <View className="flex-row items-center gap-2.5 px-3.5 py-3.5">
        <View className="w-9 shrink-0 flex-col items-center justify-center gap-0.5">
          <Text allowFontScaling={false} className="text-base leading-none">
            {style.icon}
          </Text>
          <Text
            allowFontScaling={false}
            className="font-sans-bold text-base tracking-tight"
            style={{ color: style.positionColor }}>
            {place}
          </Text>
        </View>

        <Avatar entry={entry} size={48} />

        <View className="min-w-0 flex-1 justify-center">
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              className="font-sans-semibold text-base tracking-tight text-white"
              style={{ flexShrink: 1 }}>
              {entry.displayName}
            </Text>
            {entry.isYou ? <YouBadge /> : null}
          </View>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              className="font-sans text-base text-white/55"
              style={{ flexShrink: 1 }}>
              @{entry.username}
            </Text>
            <RankPill totalXp={entry.totalXp} />
            <Streak days={entry.streak} />
          </View>
        </View>

        <View className="shrink-0 items-end pl-1">
          <View className="flex-row items-center gap-1">
            <Zap size={14} color={style.zapColor} />
            <Text
              allowFontScaling={false}
              className="font-sans-bold text-[16px] tracking-tight text-white">
              {entry.weeklyXp.toLocaleString()}
            </Text>
          </View>
          <Text
            allowFontScaling={false}
            className="font-sans-medium text-xs uppercase tracking-[0.16em]"
            style={{ color: style.weeklyColor }}>
            weekly XP
          </Text>
        </View>
      </View>
    </View>
  );
}

function RegularRow({
  entry,
  place,
}: {
  entry: LeaderboardEntry;
  place: number;
}) {
  return (
    <View
      className={`flex-row items-center gap-4 rounded-xl border bg-white/[0.05] p-4 ${
        entry.isYou ? 'border-white/10 ring-1 ring-star/40' : 'border-white/10'
      }`}>
      <View className="w-11 shrink-0 flex-col items-center justify-center gap-0.5">
        <Text
          allowFontScaling={false}
          className="font-sans-bold text-base tracking-tight text-white/40">
          {place}
        </Text>
      </View>

      <Avatar entry={entry} size={48} />

      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="max-w-[60%] font-sans-semibold text-base tracking-tight text-white">
            {entry.displayName}
          </Text>
          {entry.isYou ? <YouBadge /> : null}
        </View>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-1">
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className="font-sans text-base text-white/55">
            @{entry.username}
          </Text>
          <RankPill totalXp={entry.totalXp} />
          <Streak days={entry.streak} />
        </View>
      </View>

      <View className="shrink-0 items-end">
        <View className="flex-row items-center gap-1.5">
          <Zap size={16} color="rgba(147,197,253,0.8)" />
          <Text
            allowFontScaling={false}
            className="font-sans-bold text-lg tracking-tight text-white">
            {entry.weeklyXp.toLocaleString()}
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          className="font-sans-medium text-xs uppercase tracking-[0.18em] text-white/35">
          weekly XP
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const userId = useUserId();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    void fetchWeeklyLeaderboard(userId, 50).then((rows) => {
      setEntries(rows);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 600);
  }, [load]);

  const you = entries.find((entry) => entry.isYou);

  const myRank = useMemo(() => {
    if (!you) return null;
    const index = entries.findIndex((entry) => entry.id === you.id);
    return index >= 0 ? index + 1 : null;
  }, [entries, you]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48, gap: 28 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#9db4ff"
          colors={['#9db4ff']}
          progressBackgroundColor="#0a0a1a"
        />
      }>
      <View className="gap-2 pt-2">
        <Text
          allowFontScaling={false}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9db4ff]">
          This week
        </Text>
        <RevealText
          text="Leaderboard."
          className="mt-1 font-syne-semibold text-[32px] leading-[40px] tracking-[-0.04em] text-white"
        />
        <Text
          allowFontScaling={false}
          className="mt-1 text-base text-white/45">
          Ranked by weekly XP - resets every Monday 00:00 UTC
        </Text>

        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          {myRank != null ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3">
              <Trophy size={16} color="#9db4ff" />
              <Text
                allowFontScaling={false}
                className="font-sans-semibold text-base text-star">
                Your rank #{myRank}
              </Text>
            </View>
          ) : null}
          {you ? (
            <View className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3">
              <Zap size={16} color="rgba(147,197,253,0.8)" />
              <Text
                allowFontScaling={false}
                className="font-sans text-base text-white/70">
                {you.weeklyXp.toLocaleString()}
              </Text>
              <Text
                allowFontScaling={false}
                className="font-sans text-base text-white/40">
                XP this week
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="flex-row items-center gap-2 py-4">
          <Loader size={16} color="rgba(255,255,255,0.4)" />
          <Text
            allowFontScaling={false}
            className="font-sans text-base text-white/40">
            Loading leaderboard...
          </Text>
        </View>
      ) : entries.length === 0 ? (
        <GlassCard className="items-center gap-1.5 p-8">
          <Medal size={28} color="rgba(255,255,255,0.25)" />
          <Text
            allowFontScaling={false}
            className="mt-3 font-sans-semibold text-lg tracking-tight text-white">
            Nobody on the board yet
          </Text>
          <Text
            allowFontScaling={false}
            className="mt-1.5 max-w-xs text-center text-base leading-relaxed text-white/45">
            Study, finish quizzes and keep your streak alive to claim the
            first spot this week.
          </Text>
        </GlassCard>
      ) : (
        <View className="gap-3">
          {entries.map((entry, index) =>
            index < 3 ? (
              <PodiumRow key={entry.id} entry={entry} place={index + 1} />
            ) : (
              <RegularRow key={entry.id} entry={entry} place={index + 1} />
            ),
          )}
        </View>
      )}
    </ScrollView>
  );
}
