import { ViewStyle } from "react-native";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Trophy, Target, Clock, BookOpen, Sparkles, ChevronRight } from "lucide-react-native";
import { colors, fonts, ease, RADIUS } from "../theme/theme";

export interface StreakWidgetProps {
  streak: number;
  rank?: string;
  level?: number;
  xp?: number;
  xpNeed?: number;
  xpPercent?: number;
  weeklyData?: number[];
}

export interface NotesWidgetProps {
  notes: Array<{
    id: string;
    title: string;
    updatedAt: number;
    courseTitle?: string | null;
  }>;
}

/**
 * ==========================================
 * CATEGORY A: STREAK / PROGRESS / RANK WIDGETS
 * ==========================================
 */

export function StreakWidgetV1({ streak = 12 }: StreakWidgetProps) {
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    ringAnim.setValue(0);
    Animated.timing(ringAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ringAnim, streak]);

  const radius = 64;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.v1Container}>
      <View style={styles.v1Center}>
        <Animated.View
          style={[
            styles.v1Ring,
            {
              transform: [
                {
                  rotate: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-90deg", "270deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.v1RingTrack} />
<Animated.View
          style={[
            styles.v1RingProgress,
            {
              strokeDasharray: circumference,
              strokeDashoffset: ringAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [circumference, circumference * 0.15],
              }),
            },
          ] as unknown as ViewStyle}
        />
        </Animated.View>

        <View style={styles.v1InnerContent}>
          <Text style={styles.v1StreakNumber}>{streak}</Text>
          <Text style={styles.v1StreakLabel}>day streak</Text>
        </View>
      </View>

      <View style={styles.v1Glow} />

      <Text style={styles.v1Subtext}>Keep it up!</Text>
    </View>
  );
}

export function StreakWidgetV2({
  streak = 12,
  rank = "Iron",
  level = 3,
  weeklyData = [45, 60, 30, 75, 50, 80, 90],
}: StreakWidgetProps) {
  const maxWeekly = Math.max(...weeklyData, 1);

  return (
    <View style={styles.v2Card}>
      <View style={styles.v2TopRow}>
        <View style={styles.v2Left}>
          <View style={styles.v2FlameBox}>
            <Flame size={24} color={colors.flame} />
          </View>
          <View style={styles.v2StreakCol}>
            <Text style={styles.v2StreakNumber}>{streak}</Text>
            <Text style={styles.v2StreakLabel}>day streak</Text>
          </View>
        </View>

        <View style={styles.v2Right}>
          <View style={styles.v2RankBadge}>
            <Text style={styles.v2RankText}>{rank}</Text>
            <Text style={styles.v2LevelText}>LV {level}</Text>
          </View>
        </View>
      </View>

      <View style={styles.v2ChartContainer}>
        <View style={styles.v2ChartRow}>
          {weeklyData.map((value, index) => {
            const height = (value / maxWeekly) * 60;
            const isToday = index === weeklyData.length - 1;
            return (
              <View key={index} style={styles.v2BarWrapper}>
                <Animated.View
                  style={[
                    styles.v2Bar,
                    {
                      height,
                      backgroundColor: isToday ? colors.lilac : colors.w10,
                    },
                  ]}
                />
                <Text style={[styles.v2DayLabel, isToday && styles.v2DayLabelToday]}>
                  {["M", "T", "W", "T", "F", "S", "S"][index]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function StreakWidgetV3({
  rank = "Iron",
  xp = 1240,
  xpNeed = 2000,
  xpPercent = 62,
}: StreakWidgetProps) {
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue: 1,
      duration: 1000,
      delay: 200,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [barAnim]);

  return (
    <View style={styles.v3Card}>
      <View style={styles.v3Left}>
        <View style={styles.v3Badge}>
          <Trophy size={28} color={colors.star} />
        </View>
        <View style={styles.v3RankInfo}>
          <Text style={styles.v3RankLabel}>Current Rank</Text>
          <Text style={styles.v3RankName}>{rank}</Text>
        </View>
      </View>

      <View style={styles.v3Right}>
        <View style={styles.v3ProgressContainer}>
          <View style={styles.v3ProgressRow}>
            <Text style={styles.v3XPValue}>
              {xp.toLocaleString()} / {xpNeed.toLocaleString()} XP
            </Text>
            <Text style={styles.v3Percent}>{Math.round(xpPercent)}%</Text>
          </View>
          <View style={styles.v3Track}>
            <Animated.View
              style={[
                styles.v3Fill,
                {
                  transform: [
                    {
                      scaleX: barAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, xpPercent / 100],
                      }),
                    },
                  ],
                  transformOrigin: "left",
                },
              ]}
            >
              <LinearGradient
                colors={[colors.star, colors.lilac]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * ==========================================
 * CATEGORY B: NOTES WIDGETS
 * ==========================================
 */

const noteCardTints = [
  "rgba(207,158,255,0.12)", // lilac
  "rgba(157,180,255,0.12)", // star/blue
  "rgba(52,211,153,0.12)", // emerald
  "rgba(251,146,60,0.12)", // orange
];

export function NotesWidgetV1({
  notes = [
    { id: "1", title: "React Native Performance Tips", updatedAt: Date.now() - 86400000 },
    { id: "2", title: "TypeScript Generics Deep Dive", updatedAt: Date.now() - 172800000 },
    { id: "3", title: "Animation Timing Functions", updatedAt: Date.now() - 259200000 },
  ],
}: NotesWidgetProps) {
  return (
    <View style={styles.b1Card}>
      {notes.map((note, index) => (
        <View key={note.id} style={styles.b1Item}>
          <View style={styles.b1IconBox}>
            <BookOpen size={16} color={colors.w40} />
          </View>
          <View style={styles.b1TextCol}>
            <Text style={styles.b1Title} numberOfLines={1}>
              {note.title}
            </Text>
            <Text style={styles.b1Timestamp}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.w20} />
          {index < notes.length - 1 && <View style={styles.b1Divider} />}
        </View>
      ))}
    </View>
  );
}

export function NotesWidgetV2({
  notes = [
    { id: "1", title: "React Native Performance Tips", updatedAt: Date.now() - 86400000 },
    { id: "2", title: "TypeScript Generics Deep Dive", updatedAt: Date.now() - 172800000 },
    { id: "3", title: "Animation Timing Functions", updatedAt: Date.now() - 259200000 },
    { id: "4", title: "State Management Patterns", updatedAt: Date.now() - 345600000 },
  ],
}: NotesWidgetProps) {
  return (
    <View style={styles.b2Grid}>
      {notes.map((note, index) => {
        const tint = noteCardTints[index % noteCardTints.length];
        const initial = note.title.trim()[0]?.toUpperCase() || "N";
        return (
          <View key={note.id} style={[styles.b2Card, { backgroundColor: tint }]}>
            <View style={styles.b2CardTop}>
              <View style={styles.b2InitialBox}>
                <Text style={styles.b2Initial}>{initial}</Text>
              </View>
            </View>
            <Text style={styles.b2Title} numberOfLines={2}>
              {note.title}
            </Text>
            <Text style={styles.b2Timestamp}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function NotesWidgetV3({
  notes = [
    { id: "1", title: "Daily Focus: Mastering Reanimated 3", updatedAt: Date.now() - 3600000 },
  ],
}: NotesWidgetProps) {
  const note = notes[0];
  const snippet = note?.title || "No recent notes. Start your first one today.";

  return (
    <View style={styles.b3Card}>
      <View style={styles.b3Header}>
        <Text style={styles.b3HeaderLabel}>Most Recent</Text>
        <Sparkles size={16} color={colors.lilac} />
      </View>

      {note ? (
        <>
          <View style={styles.b3Content}>
            <Text style={styles.b3Title} numberOfLines={2}>
              {note.title}
            </Text>
            <Text style={styles.b3Snippet} numberOfLines={3}>
              {snippet}
            </Text>
            <Text style={styles.b3Meta}>
              Updated {formatRelativeTime(note.updatedAt)}
            </Text>
          </View>
          <View style={styles.b3Action}>
            <Pressable style={styles.b3ViewAllButton}>
              <Text style={styles.b3ViewAllText}>View All Notes</Text>
              <ChevronRight size={14} color={colors.primaryText} />
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.b3Empty}>
          <BookOpen size={32} color={colors.w30} />
          <Text style={styles.b3EmptyTitle}>No notes yet</Text>
          <Text style={styles.b3EmptyBody}>
            Capture your first thought and start building your knowledge base.
          </Text>
          <Pressable style={styles.b3ViewAllButton}>
            <Text style={styles.b3ViewAllText}>Create Note</Text>
            <ChevronRight size={14} color={colors.primaryText} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  // ==========================================
  // STREAK WIDGET V1 - Minimalist Ring
  // ==========================================
  v1Container: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  v1Center: {
    position: "relative",
    width: 152,
    height: 152,
    alignItems: "center",
    justifyContent: "center",
  },
  v1Glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(207,158,255,0.15)",
    top: -14,
    left: -14,
  },
  v1Ring: {
    position: "absolute",
    width: 128,
    height: 128,
  },
  v1RingTrack: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 8,
    borderColor: colors.w06,
  },
  v1RingProgress: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 8,
    borderColor: colors.lilac,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  v1InnerContent: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  v1StreakNumber: {
    fontSize: 42,
    fontFamily: fonts.mono,
    fontWeight: "600",
    color: colors.white,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  v1StreakLabel: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  v1Subtext: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w35,
  },

  // ==========================================
  // STREAK WIDGET V2 - Glass Card with Micro-Chart
  // ==========================================
  v2Card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    padding: 20,
    overflow: "hidden",
  },
  v2TopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  v2Left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  v2FlameBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    backgroundColor: colors.orangeBg,
    alignItems: "center",
    justifyContent: "center",
  },
  v2StreakCol: {
    gap: 2,
  },
  v2StreakNumber: {
    fontSize: 28,
    fontFamily: fonts.mono,
    fontWeight: "600",
    color: colors.white,
    letterSpacing: -0.8,
  },
  v2StreakLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w35,
  },
  v2Right: {
    alignItems: "flex-end",
  },
  v2RankBadge: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  v2RankText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.lilac,
    letterSpacing: 0.5,
  },
  v2LevelText: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.w50,
  },
  v2ChartContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.w06,
  },
  v2ChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
    height: 70,
  },
  v2BarWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  v2Bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 4,
  },
  v2DayLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.w35,
  },
  v2DayLabelToday: {
    color: colors.lilac,
    fontFamily: fonts.semibold,
  },

  // ==========================================
  // STREAK WIDGET V3 - Gamified Level Up
  // ==========================================
  v3Card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  v3Left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  v3Badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(157,180,255,0.3)",
    backgroundColor: "rgba(157,180,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  v3RankInfo: {
    gap: 2,
  },
  v3RankLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.w35,
  },
  v3RankName: {
    fontSize: 20,
    fontFamily: fonts.semibold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  v3Right: {
    flex: 1,
    maxWidth: 200,
  },
  v3ProgressContainer: {
    gap: 8,
  },
  v3ProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  v3XPValue: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.w70,
    fontVariant: ["tabular-nums"],
  },
  v3Percent: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.lilac,
    fontVariant: ["tabular-nums"],
  },
  v3Track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.w06,
    overflow: "hidden",
  },
  v3Fill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },

  // ==========================================
  // NOTES WIDGET V1 - Clean List Preview
  // ==========================================
  b1Card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    overflow: "hidden",
  },
  b1Item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  b1IconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  b1TextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  b1Title: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
    letterSpacing: -0.3,
  },
  b1Timestamp: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  b1Divider: {
    height: 1,
    backgroundColor: colors.w04,
    marginHorizontal: 16,
  },

  // ==========================================
  // NOTES WIDGET V2 - Visual Grid
  // ==========================================
  b2Grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  b2Card: {
    flex: 1,
    minWidth: "47%",
    maxWidth: "50%",
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: colors.w06,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 110,
  },
  b2CardTop: {
    alignItems: "flex-start",
  },
  b2InitialBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  b2Initial: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.w60,
  },
  b2Title: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.white,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  b2Timestamp: {
    marginTop: 8,
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.w30,
  },

  // ==========================================
  // NOTES WIDGET V3 - Featured Focus Card
  // ==========================================
  b3Card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    padding: 24,
    overflow: "hidden",
  },
  b3Header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  b3HeaderLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.w35,
  },
  b3Content: {
    gap: 10,
    marginBottom: 20,
  },
  b3Title: {
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.7,
    color: colors.white,
    lineHeight: 26,
  },
  b3Snippet: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
    lineHeight: 22,
  },
  b3Meta: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  b3Action: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.w06,
  },
  b3ViewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  b3ViewAllText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.lilac,
  },
  b3Empty: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  b3EmptyTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.w60,
  },
  b3EmptyBody: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w35,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
});

export const DashboardWidgetVariations = {
  streak: {
    V1: StreakWidgetV1,
    V2: StreakWidgetV2,
    V3: StreakWidgetV3,
  },
  notes: {
    V1: NotesWidgetV1,
    V2: NotesWidgetV2,
    V3: NotesWidgetV3,
  },
};

export type StreakWidgetVariation = keyof typeof DashboardWidgetVariations.streak;
export type NotesWidgetVariation = keyof typeof DashboardWidgetVariations.notes;