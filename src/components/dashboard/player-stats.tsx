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
import { colors, ease, fonts } from "../../theme/theme";

interface PlayerStatsProps {
  profile: Profile | null;
  loading: boolean;
}

function LoadingCard() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
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
  }, [pulse]);

  return (
    <Card>
      <Animated.View style={{ opacity: pulse, gap: 20 }}>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonTall} />
          <View style={styles.skeletonTall} />
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

  useEffect(() => {
    if (loading) return;
    bar.setValue(0);
    Animated.timing(bar, {
      toValue: 1,
      duration: 1000,
      delay: 150,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [loading, bar]);

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

        <View style={styles.topRow}>
          <View style={styles.cell}>
            <View style={styles.flameBox}>
              <Flame size={20} color={colors.flame} />
            </View>
            <View>
              <Text style={styles.cellValue}>{String(streak)}</Text>
              <Text style={[styles.micro, styles.microGap]}>day streak</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View rank progression"
            onPress={() => setRankModalOpen(true)}
            style={({ pressed }) => [
              styles.rankBlock,
              pressed && styles.rankBlockPressed,
            ]}
          >
            <RankBadge
              rank={rankData.tier.key}
              tier={rankData.current.step}
              size={44}
            />
            <View style={styles.rankTextCol}>
              <Text style={styles.rankName} numberOfLines={1}>
                {rankData.name}
              </Text>
              <Text style={[styles.micro, styles.microGap]} numberOfLines={1}>
                current rank
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.xpBlock}>
          <Text style={styles.xpValue}>
            {String(rankData.xpInto)}
            <Text style={styles.xpMuted}> / {rankData.xpNeed}</Text>
            <Text style={styles.xpUnit}> XP</Text>
          </Text>
          <Text style={[styles.micro, styles.microGap]}>
            {`to ${rankData.nextRankName ?? "max rank"}`}
          </Text>
        </View>

        <View style={styles.progressBlock}>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 40,
    flexWrap: "nowrap",
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
  cellValue: {
    fontSize: 20,
    fontFamily: fonts.semibold,
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  micro: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w35,
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
  xpBlock: {
    marginTop: 24,
    alignItems: "flex-end",
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
    gap: 12,
  },
  footerLeft: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  footerRight: {
    flexShrink: 0,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 32,
  },
  skeletonTall: {
    height: 44,
    width: 144,
    borderRadius: 12,
    backgroundColor: colors.w06,
  },
  skeletonBar: {
    height: 10,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.w05,
  },
});
