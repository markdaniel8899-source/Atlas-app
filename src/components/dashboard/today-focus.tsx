import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Compass, Play, Target } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Glow } from "../ui/glow";
import { nextTopic } from "../../lib/db/courses";
import type { FocusCourse } from "../../lib/db/types";
import { colors, ease, fonts } from "../../theme/theme";

interface TodayFocusProps {
  focus: FocusCourse | null;
  loading: boolean;
}

function courseStatusLabel(status: FocusCourse["status"]): string {
  switch (status) {
    case "completed":
      return "Course complete";
    case "in_progress":
      return "In progress";
    case "paused":
      return "Paused";
    default:
      return "Not started";
  }
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
      <Animated.View style={{ opacity: pulse, gap: 16 }}>
        <View style={styles.skeletonLabel} />
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonBar} />
      </Animated.View>
    </Card>
  );
}

export function TodayFocus({ focus, loading }: TodayFocusProps) {
  const router = useRouter();
  const progress = focus
    ? Math.max(0, Math.min(100, focus.progress_percentage))
    : 0;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading || !focus) return;
    bar.setValue(0);
    Animated.timing(bar, {
      toValue: 1,
      duration: 1000,
      delay: 200,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [loading, focus, bar]);

  if (loading) return <LoadingCard />;

  if (!focus) {
    return (
      <Card style={styles.card}>
        <Glow
          size={256}
          color="#9db4ff"
          opacity={0.1}
          style={styles.emptyGlow}
        />
        <View style={styles.emptyRow}>
          <View style={styles.emptyLeft}>
            <View style={styles.compassBox}>
              <Compass size={20} color={colors.w40} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.eyebrow}>{"Today's focus"}</Text>
              <Text style={styles.emptyTitle}>No course queued yet</Text>
              <Text style={styles.emptyBody}>
                Add a course and pick a topic - it will show up here as your
                single focus for the day.
              </Text>
            </View>
          </View>
          <Button
            variant="primary"
            label="Add a course"
            icon={<Target size={14} color={colors.primaryText} />}
            onPress={() => router.push("/courses" as Href)}
            contentStyle={styles.smallButton}
            textStyle={styles.smallButtonText}
          />
        </View>
      </Card>
    );
  }

  const topic = nextTopic(focus);

  return (
    <Card style={styles.card}>
      <Glow size={256} color="#cf9eff" opacity={0.12} style={styles.focusGlow} />

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>{"Today's focus"}</Text>
          <Text style={styles.title}>{focus.title}</Text>
          <Text style={styles.nextUp}>
            Next up:{" "}
            <Text style={styles.nextUpValue}>
              {topic ? topic.title : "Add your first topic"}
            </Text>
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Button
            variant="primary"
            label="Start session"
            icon={<Play size={14} color={colors.primaryText} />}
            onPress={() =>
              router.push(`/timer?courseId=${focus.id}` as Href)
            }
            contentStyle={styles.smallButton}
            textStyle={styles.smallButtonText}
          />
          <Button
            variant="outline"
            label="Roadmap"
            onPress={() =>
              router.push(`/roadmap?courseId=${focus.id}` as Href)
            }
            contentStyle={[styles.smallButton, styles.roadmapButton]}
            textStyle={styles.smallButtonText}
          />
        </View>
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
                      outputRange: [0, Math.max(progress, 0) / 100],
                    }),
                  },
                ],
                transformOrigin: "left",
                shadowColor: focus.accent,
                shadowOpacity: 0.5,
                shadowRadius: 9,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            <LinearGradient
              colors={[`${focus.accent}aa`, focus.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View style={styles.progressFooter}>
          <Text style={styles.footerMuted}>{Math.round(progress)}% complete</Text>
          <Text style={styles.footerValue}>
            {topic
              ? `${courseStatusLabel(focus.status)} - ${topic.title}`
              : courseStatusLabel(focus.status)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
  },
  emptyGlow: {
    position: "absolute",
    bottom: -96,
    left: -40,
  },
  focusGlow: {
    position: "absolute",
    top: -96,
    left: "33%",
  },
  emptyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  emptyLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    flexShrink: 1,
  },
  compassBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  emptyTitle: {
    marginTop: 6,
    fontSize: 20,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
    color: colors.white,
  },
  emptyBody: {
    marginTop: 6,
    maxWidth: 400,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  smallButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  smallButtonText: {
    fontSize: 12,
  },
  roadmapButton: {
    borderColor: colors.lilac45,
    backgroundColor: colors.lilac12,
  },
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
  },
  headerLeft: {
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    marginTop: 8,
    fontSize: 24,
    fontFamily: fonts.semibold,
    letterSpacing: -0.72,
    color: colors.white,
  },
  nextUp: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  nextUpValue: {
    color: colors.w75,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBlock: {
    marginTop: 28,
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
  progressFooter: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    rowGap: 4,
  },
  footerMuted: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  footerValue: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  skeletonLabel: {
    height: 12,
    width: 112,
    borderRadius: 4,
    backgroundColor: colors.w06,
  },
  skeletonTitle: {
    height: 28,
    width: 288,
    maxWidth: "100%",
    borderRadius: 4,
    backgroundColor: colors.w06,
  },
  skeletonBar: {
    height: 10,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.w05,
  },
});
