import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { RANKS, RANK_TIER_KEYS, TIERS } from "../../lib/gamification";
import type { RankData } from "../../lib/gamification";
import { RankBadge } from "./rank-badge";
import { MOTION } from "../../theme/motion";
import { colors, fonts } from "../../theme/theme";

interface RankProgressionModalProps {
  open: boolean;
  onClose: () => void;
  currentRank: RankData;
}

/** Compact XP label under each badge (e.g. 250 → "250", 1375 → "1.4k") */
function fmtXP(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
}

const NUMERALS = ["I", "II", "III", "IV"];

/**
 * Atlas Ranks progression grid - all 24 badges (6 ranks x 4 tiers).
 * Current rank: full opacity + glowing purple ring.
 * Past ranks: full opacity. Future ranks: dimmed to 30%.
 */
export function RankProgressionModal({
  open,
  onClose,
  currentRank,
}: RankProgressionModalProps) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const panel = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(open);
  const opening = useRef(false);

  useEffect(() => {
    if (open) {
      if (!rendered) {
        setRendered(true);
        return;
      }
      if (opening.current) return;
      opening.current = true;
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: MOTION.sheetClose,
          easing: MOTION.easing,
          useNativeDriver: true,
        }),
        Animated.timing(panel, {
          toValue: 1,
          duration: MOTION.sheet,
          easing: MOTION.easing,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      opening.current = false;
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: MOTION.sheetClose,
          easing: MOTION.easing,
          useNativeDriver: true,
        }),
        Animated.timing(panel, {
          toValue: 0,
          duration: MOTION.sheetClose,
          easing: MOTION.easing,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [open, rendered, backdrop, panel]);

  if (!rendered) return null;

  const currentIndex = RANKS.findIndex(
    (r) => r.key === currentRank.current.key,
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            { opacity: backdrop },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close rank progression"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel="Rank progression"
          style={[
            styles.panel,
            {
              opacity: panel,
              transform: [
                {
                  scale: panel.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
                {
                  translateY: panel.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Atlas Ranks</Text>
              <Text style={styles.title}>Your Journey</Text>
              <Text style={styles.subtitle}>
                {currentRank.nextRankName
                  ? `Currently ${currentRank.name} · ${currentRank.xpToNext.toLocaleString()} XP to ${currentRank.nextRankName}`
                  : `${currentRank.name} · Max rank reached`}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={6}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closePressed,
              ]}
            >
              <X size={16} color={colors.w50} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.gridScroll}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.numeralRow}>
              {NUMERALS.map((numeral) => (
                <Text key={numeral} style={styles.numeral}>
                  {numeral}
                </Text>
              ))}
            </View>

            <View style={styles.tierList}>
              {RANK_TIER_KEYS.map((tierKey) => (
                <View key={tierKey}>
                  <Text
                    style={[styles.tierLabel, { color: TIERS[tierKey].text }]}
                  >
                    {TIERS[tierKey].label}
                  </Text>
                  <View style={styles.tierGrid}>
                    {RANKS.filter((rank) => rank.tier.key === tierKey).map(
                      (rank) => {
                        const index = RANKS.indexOf(rank);
                        const isCurrent = index === currentIndex;
                        const isFuture = index > currentIndex;

                        return (
                          <View
                            key={rank.key}
                            style={[
                              styles.rankCell,
                              isCurrent ? styles.rankCellCurrent : null,
                            ]}
                          >
                            <View
                              style={{
                                opacity: isFuture ? 0.3 : 1,
                                transform: [{ scale: isCurrent ? 1.1 : 1 }],
                              }}
                            >
                              <RankBadge
                                rank={rank.tier.key}
                                tier={rank.step}
                                size={44}
                              />
                            </View>
                            {isCurrent ? (
                              <Text style={styles.youLabel}>You</Text>
                            ) : (
                              <Text style={styles.xpLabel}>
                                {fmtXP(rank.minXP)}
                              </Text>
                            )}
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Keep studying and completing quizzes to climb the ranks
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  panel: {
    width: "100%",
    maxWidth: 448,
    maxHeight: "90%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(10,10,20,0.95)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.95,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 32 },
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.w06,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 3.3,
    textTransform: "uppercase",
    color: colors.star70,
  },
  title: {
    marginTop: 8,
    fontSize: 24,
    fontFamily: fonts.semibold,
    letterSpacing: -0.72,
    color: colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  closeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    padding: 8,
  },
  closePressed: {
    borderColor: colors.w20,
  },
  gridScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  gridContent: {
    padding: 24,
  },
  numeralRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  numeral: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontFamily: fonts.semibold,
    letterSpacing: 2.5,
    color: colors.w30,
  },
  tierList: {
    gap: 20,
  },
  tierLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    letterSpacing: 2.8,
    textTransform: "uppercase",
  },
  tierGrid: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  rankCell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w06,
    backgroundColor: colors.w02,
    padding: 10,
  },
  rankCellCurrent: {
    borderColor: "rgba(207,158,255,0.5)",
    backgroundColor: "rgba(207,158,255,0.07)",
    shadowColor: colors.lilac,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  xpLabel: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    fontVariant: ["tabular-nums"],
    color: colors.w35,
  },
  youLabel: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.lilac,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    padding: 16,
    paddingHorizontal: 24,
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
});
