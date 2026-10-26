import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Flame } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "../ui/card";
import { Glow } from "../ui/glow";
import { RankBadge } from "../gamification/rank-badge";
import { RankProgressionModal } from "../gamification/rank-progression-modal";
import { getRankFromXP } from "../../lib/gamification";
import type { Profile } from "../../lib/db/types";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { useResponsive } from "../../hooks/use-responsive";
import { colors, ease, fonts } from "../../theme/theme";

interface PlayerStatsProps {
  profile: Profile | null;
  loading: boolean;
}

function LoadingCard() {
  const pulse = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();
  const { compact } = useResponsive();
  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Card>
      <Animated.View style={{ opacity: pulse, gap: 20 }}>
        <View
          style={[
            styles.skeletonRow,
            compact && styles.skeletonRowCompact,
          ]}
        >
          <View
            style={[
              styles.skeletonStreakBlock,
              compact && styles.skeletonStreakBlockCompact,
            ]}
          >
            <View
              style={[
                styles.skeletonFlameBox,
                compact && styles.skeletonFlameBoxCompact,
              ]}
            />
            <View style={styles.skeletonCellValue} />
          </View>
          <View
            style={[
              styles.skeletonRankBlock,
              compact && styles.skeletonRankBlockCompact,
            ]}
          >
            <View
              style={[
                styles.skeletonRankBadge,
                compact && styles.skeletonRankBadgeCompact,
              ]}
            />
            <View style={styles.skeletonRankTextCol}>
              <View style={styles.skeletonRankName} />
              <View style={styles.skeletonRankMicro} />
            </View>
          </View>
        </View>
        <View style={styles.skeletonBar} />
      </Animated.View>
    </Card>
  );
}

export function PlayerStats({ profile, loading }: PlayerStatsProps) {
  const rankData = getRankFromXP(profile?.xp ?? 0);
  const streak = profile?.streak ?? 0;
  const [rankModalOpen, setRankModalOpen] = useState(false);
  const bar = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const { compact } = useResponsive();

  useEffect(() => {
    if (loading) return;
    if (reduceMotion) {
      bar.setValue(1);
      return;
    }
    bar.setValue(0);
    Animated.timing(bar, {
      toValue: 1,
      duration: 1000,
      delay: 150,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [loading, bar, reduceMotion]);

  if (loading) return <LoadingCard />;

  return (
    <>
      <Card style={styles.card}>
        <Glow
          size={288}
          color="#cf9eff"
          opacity={0.12}
          style={styles.cardGlow}
        />

        <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
          <View
            style={[
              styles.streakBlock,
              compact && styles.streakBlockCompact,
            ]}
          >
            <View
              style={[styles.flameBox, compact && styles.flameBoxCompact]}
            >
              <Flame size={compact ? 18 : 20} color={colors.flame} />
            </View>
            <View style={styles.streakTextCol}>
              <Text
                style={[styles.cellValue, compact && styles.cellValueCompact]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                maxFontSizeMultiplier={1.2}
              >
                {String(streak)}
              </Text>
              <Text
                style={[
                  styles.micro,
                  styles.microGap,
                  compact && styles.microCompact,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.2}
              >
                day streak
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View rank progression"
            onPress={() => setRankModalOpen(true)}
            style={({ pressed }) => [
              styles.rankBlock,
              compact && styles.rankBlockCompact,
              pressed && styles.rankBlockPressed,
            ]}
          >
            <RankBadge
              rank={rankData.tier.key}
              tier={rankData.current.step}
              size={compact ? 36 : 44}
            />
            <View style={styles.rankTextCol}>
              <Text
                style={[
                  styles.rankName,
                  compact && styles.rankNameCompact,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={1.2}
              >
                {rankData.name}
              </Text>
              <Text
                style={[
                  styles.micro,
                  styles.microGap,
                  compact && styles.microCompact,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={1.2}
              >
                current rank
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={[styles.xpBlock, compact && styles.xpBlockCompact]}>
          <Text style={styles.xpValue}>
            {String(rankData.xpInto)}
            <Text style={styles.xpMuted}> / {rankData.xpNeed}</Text>
            <Text style={styles.xpUnit}> XP</Text>
          </Text>
          <Text style={[styles.micro, styles.microGap]}>
            {`to ${rankData.nextRankName ?? "max rank"}`}
          </Text>
        </View>

        <View
          style={[
            styles.progressBlock,
            compact && styles.progressBlockCompact,
          ]}
        >
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  transform: [
                    {
                      scaleX: bar.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          0,
                          Math.max(rankData.percent, 0) / 100,
                        ],
                      }),
                    },
                  ],
                  transformOrigin: "left",
                },
              ]}
            >
              <LinearGradient
                colors={[rankData.tier.gradient[0], rankData.tier.gradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerLeft} numberOfLines={1}>
              {Math.round(rankData.percent)}% of {rankData.name} complete
            </Text>
            <Text style={styles.footerRight} numberOfLines={1}>
              {profile ? `@${profile.username}` : "unlinked profile"}
            </Text>
          </View>
        </View>
      </Card>

      <RankProgressionModal
        open={rankModalOpen}
        onClose={() => setRankModalOpen(false)}
        currentRank={rankData}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
  },
  cardGlow: {
    position: "absolute",
    top: -112,
    right: -64,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 16,
    rowGap: 8,
    flexWrap: "nowrap",
  },
  statsRowCompact: {
    columnGap: 10,
  },
  streakBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flexShrink: 1,
  },
  streakBlockCompact: {
    gap: 8,
  },
  streakTextCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 24,
    rowGap: 12,
    flexWrap: "wrap",
  },
  cell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flameBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    backgroundColor: colors.orangeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  flameBoxCompact: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  cellValue: {
    fontSize: 20,
    fontFamily: fonts.semibold,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  cellValueCompact: {
    fontSize: 19,
  },
  micro: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w35,
  },
  microCompact: {
    fontSize: 10,
    letterSpacing: 1.2,
  },
  microGap: {
    marginTop: 2,
  },
  rankBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flexShrink: 1,
    minWidth: 0,
  },
  rankBlockCompact: {
    gap: 8,
    padding: 3,
  },
  rankBlockPressed: {
    borderColor: colors.w10,
    backgroundColor: colors.w03,
  },
  rankTextCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  rankName: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  rankNameCompact: {
    fontSize: 16,
  },
  xpBlock: {
    marginTop: 24,
    alignItems: "flex-end",
  },
  xpBlockCompact: {
    marginTop: 18,
  },
  xpValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  xpMuted: {
    color: colors.w30,
  },
  xpUnit: {
    fontSize: 12,
    color: colors.lilac,
  },
  progressBlock: {
    marginTop: 24,
  },
  progressBlockCompact: {
    marginTop: 18,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.w06,
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  footer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 2,
    gap: 12,
  },
  footerLeft: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  footerRight: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 16,
    rowGap: 8,
    flexWrap: "nowrap",
  },
  skeletonRowCompact: {
    columnGap: 10,
  },
  skeletonStreakBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  skeletonStreakBlockCompact: {
    gap: 8,
  },
  skeletonFlameBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.w06,
  },
  skeletonFlameBoxCompact: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  skeletonCellValue: {
    flexShrink: 1,
    minWidth: 0,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.w05,
  },
  skeletonRankBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.w03,
    flexShrink: 1,
    minWidth: 0,
  },
  skeletonRankBlockCompact: {
    gap: 8,
    padding: 3,
  },
  skeletonRankBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.w05,
  },
  skeletonRankBadgeCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  skeletonRankTextCol: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  skeletonRankName: {
    height: 18,
    width: "60%",
    borderRadius: 4,
    backgroundColor: colors.w05,
  },
  skeletonRankMicro: {
    height: 11,
    width: "40%",
    borderRadius: 4,
    backgroundColor: colors.w05,
  },
  skeletonBar: {
    height: 10,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.w05,
  },
});
