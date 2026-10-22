import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Flame, Medal, Trophy, WifiOff, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ScreenFooter,
  ScreenHeading,
  ScreenShell,
} from "../components/screen-shell";
import { RankBadge } from "../components/gamification/rank-badge";
import { readCache, writeCache } from "../lib/data-cache";
import { getRankFromXP } from "../lib/gamification";
import { fetchWeeklyLeaderboard } from "../lib/db/leaderboard";
import type { LeaderboardEntry } from "../lib/db/leaderboard";
import { pngAvatarUrl } from "../lib/dicebear";
import { ensureOnline } from "../lib/net";
import { useReducedMotion } from "../hooks/use-reduced-motion";
import { colors, fonts } from "../theme/theme";

/** Premium glassy card configs for podium positions (1st, 2nd, 3rd). */
const PODIUM_STYLE: Record<
  number,
  {
    icon: string;
    positionColor: string;
    borderColor: string;
    zapColor: string;
    weeklyColor: string;
    gradient: readonly [string, string, ...string[]];
    shine: string;
  }
> = {
  1: {
    icon: "🥇",
    positionColor: "#facc15",
    borderColor: "rgba(234,179,8,0.4)",
    zapColor: "#fde047",
    weeklyColor: "rgba(254,240,138,0.7)",
    gradient: [
      "rgba(234,179,8,0.15)",
      "rgba(234,179,8,0.10)",
      "rgba(234,179,8,0.04)",
    ],
    shine: "rgba(255,255,255,0.20)",
  },
  2: {
    icon: "🥈",
    positionColor: "#e5e7eb",
    borderColor: "rgba(209,213,219,0.4)",
    zapColor: "#e5e7eb",
    weeklyColor: "rgba(243,244,246,0.8)",
    gradient: [
      "rgba(203,213,225,0.20)",
      "rgba(209,213,219,0.15)",
      "rgba(212,212,216,0.10)",
    ],
    shine: "rgba(255,255,255,0.40)",
  },
  3: {
    icon: "🥉",
    positionColor: "#d8b4fe",
    borderColor: "rgba(192,132,252,0.4)",
    zapColor: "#d8b4fe",
    weeklyColor: "rgba(233,213,255,0.8)",
    gradient: [
      "rgba(192,132,252,0.20)",
      "rgba(167,139,250,0.15)",
      "rgba(232,121,249,0.10)",
    ],
    shine: "rgba(233,213,255,0.30)",
  },
};

/** Sweeping reflection band inside the podium cards. */
function PodiumShine({
  tint,
  anim,
}: {
  tint: string;
  anim: Animated.Value;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shineBand,
        {
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-160, 720],
              }),
            },
            { rotate: "18deg" },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={["transparent", tint, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function Avatar({ entry, size = 48 }: { entry: LeaderboardEntry; size?: number }) {
  const uri = pngAvatarUrl(entry.avatarUrl);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{entry.initials}</Text>
        </View>
      )}
    </View>
  );
}

function RankChip({
  entry,
  withBadge,
}: {
  entry: LeaderboardEntry;
  withBadge?: boolean;
}) {
  const rank = getRankFromXP(entry.totalXp);
  return (
    <View
      style={[
        styles.rankChip,
        { borderColor: rank.tier.border, backgroundColor: rank.tier.bg },
      ]}
    >
      {withBadge ? (
        <RankBadge rank={rank.tier.key} tier={rank.current.step} size={24} />
      ) : null}
      <Text style={[styles.rankChipText, { color: rank.tier.text }]}>
        {rank.name}
      </Text>
    </View>
  );
}

const LeaderRow = memo(function LeaderRow({
  entry,
  place,
  shine,
  compact,
}: {
  entry: LeaderboardEntry;
  place: number | null;
  shine: Animated.Value;
  compact?: boolean;
}) {
  const podium = place != null ? PODIUM_STYLE[place] : undefined;

  if (podium) {
    return (
      <View
        style={[
          styles.podiumCard,
          compact && styles.podiumCardCompact,
          { borderColor: podium.borderColor },
        ]}
      >
        <LinearGradient
          colors={podium.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <PodiumShine tint={podium.shine} anim={shine} />

        <View style={[styles.positionCol, compact && styles.positionColCompact]}>
          <Text style={styles.podiumIcon}>{podium.icon}</Text>
          <Text style={[styles.podiumNumber, { color: podium.positionColor }]}>
            {place}
          </Text>
        </View>

        <Avatar entry={entry} size={compact ? 48 : 52} />

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {entry.displayName}
            </Text>
            {entry.isYou ? (
              <View style={styles.youChip}>
                <Text style={styles.youChipText}>You</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.username}>
              @{entry.username}
            </Text>
            <RankChip entry={entry} withBadge />
            <View style={styles.streakChip}>
              <Flame size={12} color="rgba(252,211,77,0.8)" />
              <Text style={styles.streakText}>{entry.streak}d</Text>
            </View>
          </View>
        </View>

        <View style={styles.score}>
          <View style={styles.scoreRow}>
            <Zap size={16} color={podium.zapColor} />
            <Text style={styles.scoreValue}>
              {entry.weeklyXp.toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.scoreLabel, { color: podium.weeklyColor }]}>
            weekly XP
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rowCard, entry.isYou && styles.rowCardYou]}>
      <View style={styles.positionCol}>
        <Text style={styles.rowNumber}>{place ?? "-"}</Text>
      </View>

      <Avatar entry={entry} size={48} />

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {entry.displayName}
          </Text>
          {entry.isYou ? (
            <View style={styles.youChip}>
              <Text style={styles.youChipText}>You</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.username}>
            @{entry.username}
          </Text>
          <RankChip entry={entry} />
          <View style={styles.streakChip}>
            <Flame size={12} color="rgba(252,211,77,0.8)" />
            <Text style={styles.streakText}>{entry.streak}d</Text>
          </View>
        </View>
      </View>

      <View style={styles.score}>
        <View style={styles.scoreRow}>
          <Zap size={16} color="rgba(147,197,253,0.8)" />
          <Text style={styles.scoreValue}>
            {entry.weeklyXp.toLocaleString()}
          </Text>
        </View>
        <Text style={styles.scoreLabelRegular}>weekly XP</Text>
      </View>
    </View>
  );
});

const CACHE_KEY = "leaderboard.weekly";
const YOU_CACHE_KEY = "leaderboard.weekly.you";
const RANK_CACHE_KEY = "leaderboard.weekly.rank";

/**
 * The board is refetched on every focus, but the payload is usually
 * identical. Skipping the state commit keeps the 50 mounted rows from
 * re-rendering right after a tab switch.
 */
function sameBoard(a: LeaderboardEntry[], b: LeaderboardEntry[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id ||
      left.weeklyXp !== right.weeklyXp ||
      left.totalXp !== right.totalXp ||
      left.streak !== right.streak ||
      left.displayName !== right.displayName ||
      left.username !== right.username ||
      left.avatarUrl !== right.avatarUrl ||
      left.initials !== right.initials ||
      left.isYou !== right.isYou
    ) {
      return false;
    }
  }
  return true;
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    () => readCache<LeaderboardEntry[]>(CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(
    () => readCache<LeaderboardEntry[]>(CACHE_KEY) === null,
  );
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [you, setYou] = useState<LeaderboardEntry | null>(
    () => readCache<LeaderboardEntry>(YOU_CACHE_KEY) ?? null,
  );
  const [yourRank, setYourRank] = useState<number | null>(
    () => readCache<number>(RANK_CACHE_KEY) ?? null,
  );
  const firstFocus = useRef(true);
  const shine = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const compact = width < 360;

  // Tabs stay mounted, so re-pull the board (silently, cache stays visible)
  // every time this tab is focused after the first mount.
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      // Let the tab transition finish before committing the refreshed board;
      // re-rendering 50 rows mid-animation was the worst switch stutter.
      const timer = setTimeout(() => setReloadKey((key) => key + 1), 420);
      return () => clearTimeout(timer);
    }, []),
  );

  // One shared sweep for all three podium cards, and only while this tab is
  // focused. Infinite loop.
  useFocusEffect(
    useCallback(() => {
      shine.stopAnimation();
      shine.setValue(0);
      if (reduceMotion) return;
      const loop = () => {
        const animation = Animated.timing(shine, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        });
        animation.start(() => {
          shine.setValue(0);
          loop();
        });
      };
      loop();
      return () => {
        shine.stopAnimation();
      };
    }, [shine, reduceMotion]),
  );

  useEffect(() => {
    let cancelled = false;
    if (readCache<LeaderboardEntry[]>(CACHE_KEY) === null) setLoading(true);
    setFailed(false);
    fetchWeeklyLeaderboard(50)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const cached = readCache<LeaderboardEntry[]>(CACHE_KEY);
          if (!cached || !sameBoard(cached, result.entries)) {
            setEntries(result.entries);
            writeCache(CACHE_KEY, result.entries);
          }
          setYou(result.you);
          setYourRank(result.yourRank);
          writeCache(YOU_CACHE_KEY, result.you);
          writeCache(RANK_CACHE_KEY, result.yourRank);
        }
        setFailed(!result.ok);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    void (async () => {
      if (!(await ensureOnline())) return;
      setReloadKey((key) => key + 1);
    })();
  };

  const youEntry = you ?? entries.find((entry) => entry.isYou) ?? null;
  const myRank =
    yourRank ??
    (() => {
      const index = entries.findIndex((entry) => entry.isYou);
      return index >= 0 ? index + 1 : null;
    })();
  const pinnedYou = youEntry && !entries.some((entry) => entry.isYou)
    ? youEntry
    : null;
  const podiumEntries = entries.slice(0, 3);
  const rankedEntries = entries.slice(3);

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {(myRank !== null || youEntry) && (
        <View style={styles.rankChipsRow}>
          {myRank !== null ? (
            <View style={styles.rankChipBig}>
              <Trophy size={16} color={colors.star} />
              <Text style={styles.rankChipBigText}>Your rank #{myRank}</Text>
            </View>
          ) : null}
          {youEntry ? (
            <View style={styles.xpChipBig}>
              <Zap size={16} color="rgba(147,197,253,0.8)" />
              <Text style={styles.xpChipValue}>
                {youEntry.weeklyXp.toLocaleString()}
              </Text>
              <Text style={styles.xpChipLabel}>XP this week</Text>
            </View>
          ) : null}
        </View>
      )}

      {pinnedYou ? (
        <LeaderRow
          entry={pinnedYou}
          place={myRank}
          shine={shine}
          compact={compact}
        />
      ) : null}

      {podiumEntries.map((entry, index) => (
        <LeaderRow
          key={entry.id}
          entry={entry}
          place={index + 1}
          shine={shine}
          compact={compact}
        />
      ))}
    </View>
  );

  const renderRow = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => <LeaderRow entry={item} place={index + 4} shine={shine} />;

  return (
    <ScreenShell title="Leaderboard" scrollable={false} hideFooter>
      <ScreenHeading
        eyebrow="This week"
        title="Leaderboard."
        subtitle="Ranked by weekly XP · resets every Monday 00:00 UTC"
      />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.w40} />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      ) : failed && entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <WifiOff size={28} color={colors.w20} />
          <Text style={styles.emptyTitle}>Couldn’t load the leaderboard</Text>
          <Text style={styles.emptyText}>
            Check your internet connection, then try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={retry}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryPressed,
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Medal size={28} color={colors.w20} />
          <Text style={styles.emptyTitle}>Nobody on the board yet</Text>
          <Text style={styles.emptyText}>
            Study, finish quizzes and keep your streak alive to claim the
            first spot this week.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rankedEntries}
          keyExtractor={(entry) => entry.id}
          renderItem={renderRow}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={ScreenFooter}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  rankChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  rankChipBig: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rankChipBigText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.star,
  },
  xpChipBig: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  xpChipValue: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w70,
  },
  xpChipLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.5,
    color: colors.white,
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  retryButton: {
    marginTop: 16,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.lilac,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  listHeader: {
    gap: 12,
  },
  podiumCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  podiumCardCompact: {
    gap: 10,
    padding: 12,
  },
  shineBand: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 80,
  },
  positionCol: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  positionColCompact: {
    width: 36,
  },
  podiumIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  podiumNumber: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
  },
  rowNumber: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.w40,
  },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b3244",
  },
  avatarInitials: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
    color: colors.white,
  },
  youChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w40,
    backgroundColor: colors.w15,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  youChipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.white,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 4,
  },
  username: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.55)",
  },
  rankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankChipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "rgba(252,211,77,0.8)",
  },
  score: {
    alignItems: "flex-end",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: -0.4,
    color: colors.white,
  },
  scoreLabel: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  scoreLabelRegular: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.w35,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    padding: 16,
  },
  rowCardYou: {
    borderColor: "rgba(157,180,255,0.4)",
  },
});
