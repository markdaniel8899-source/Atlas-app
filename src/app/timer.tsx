import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { BookOpen, Check, Pause, Play, RotateCcw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SelectMenu } from "../components/ui/select-menu";
import type { SelectOption } from "../components/ui/select-menu";
import { useTimer, useTimerClock } from "../context/timer-context";
import { useCourses } from "../hooks/use-courses";
import { getCachedAuthUser } from "../lib/auth";
import { loadSessions } from "../lib/timer";
import type { StudySession } from "../lib/timer";
import { colors, ease, fonts } from "../theme/theme";

const PRESETS = [25, 50, 90];

/** HH:MM:SS for the cumulative focus counter. */
function formatHMS(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDay(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FlashLine({ text }: { text: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        styles.flashRow,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Check size={16} color={colors.lilac90} />
      <Text style={styles.flashText}>{text}</Text>
    </Animated.View>
  );
}

export default function TimerScreen() {
  const timer = useTimer();
  const { state, activeCourse } = timer;
  const { globalTotal, courseTotal, progress } = useTimerClock();
  const { courses } = useCourses();
  const [sessions, setSessions] = useState<StudySession[]>([]);

  // /timer?courseId=<id> (Courses / Roadmap pills) preselects the course once.
  const params = useLocalSearchParams<{ courseId?: string | string[] }>();
  const appliedCourseRef = useRef<string | null>(null);
  useEffect(() => {
    const raw = Array.isArray(params.courseId)
      ? params.courseId[0]
      : params.courseId;
    if (!raw) {
      appliedCourseRef.current = null;
      return;
    }
    if (appliedCourseRef.current === raw) return;
    appliedCourseRef.current = raw;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      timer.selectCourse(parsed);
    }
  }, [params.courseId, timer]);

  // Session history list - refreshed after every commit.
  useEffect(() => {
    void loadSessions(getCachedAuthUser()?.id ?? null).then(setSessions);
  }, [timer.historyVersion]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(100, progress * 100),
      duration: 400,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [progress, progressAnim]);

  const hint =
    state.mode === "running"
      ? "Counting up live - pauses and stops are saved."
      : state.mode === "paused"
        ? "Paused - resume to keep counting from here."
        : "Resumes from this total next time you press Start.";

  const courseOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: "", label: "No course", icon: BookOpen },
      ...courses.map((course) => ({
        value: String(course.id),
        label: course.title,
        icon: BookOpen,
      })),
    ],
    [courses],
  );

  const modeLabel =
    state.mode === "running"
      ? "In session"
      : state.mode === "paused"
        ? "Paused"
        : "Idle";

  return (
    <ScreenShell title="Timer">
      <View style={styles.headingRow}>
        <ScreenHeading eyebrow="Deep work" title="Focus timer." />
      </View>

      <View style={styles.coursePicker}>
        <SelectMenu
          label="Course"
          labelIcon={BookOpen}
          value={String(state.courseId ?? "")}
          options={courseOptions}
          disabled={state.mode !== "idle"}
          onChange={(next) => timer.selectCourse(next ? Number(next) : null)}
        />
      </View>

      {/* HERO: lifetime focus counter - the main element of this page. */}
      <View style={styles.heroWrap}>
        <Card style={styles.heroCard}>
          <LinearGradient
            colors={[
              "rgba(157,180,255,0.10)",
              "rgba(207,158,255,0.05)",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Total Focus Time</Text>
            <Text style={styles.heroTime}>{formatHMS(globalTotal)}</Text>

            <Text style={styles.focusingOn}>
              Focusing on:{" "}
              <Text style={styles.focusingOnValue}>
                {activeCourse ? activeCourse.title : "No course selected"}
              </Text>
            </Text>
            {activeCourse ? (
              <Text style={styles.courseTotal}>
                {formatHMS(courseTotal)} this course
              </Text>
            ) : null}

            <View style={styles.progressWrap}>
              <View style={styles.track}>
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      transform: [
                        {
                          scaleX: progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: [0, 1],
                          }),
                        },
                      ],
                      transformOrigin: "left",
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#9db4ff", "#cf9eff", "#cf9eff"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
              <View style={styles.pillsRow}>
                <View style={styles.pillTarget}>
                  <Text style={styles.pillTargetText}>
                    {state.targetMin} min target
                  </Text>
                </View>
                <View style={styles.pillIdle}>
                  <Text style={styles.pillIdleText}>{modeLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Button
                label={
                  state.mode === "running"
                    ? "Pause"
                    : state.mode === "paused"
                      ? "Resume"
                      : "Start"
                }
                icon={
                  state.mode === "running" ? (
                    <Pause size={16} color={colors.primaryText} />
                  ) : (
                    <Play size={16} color={colors.primaryText} />
                  )
                }
                onPress={timer.toggle}
                contentStyle={styles.mainButton}
                accessibilityLabel={
                  state.mode === "running" ? "Pause session" : "Start session"
                }
              />
              <Button
                variant="ghost"
                label={state.mode === "idle" ? "Reset" : "Finish"}
                icon={<RotateCcw size={14} color={colors.white} />}
                onPress={() => timer.stop()}
                disabled={state.mode === "idle"}
                contentStyle={styles.mainButton}
                accessibilityLabel="Stop and log session"
              />
            </View>

            <View style={styles.presetsRow}>
              <Text style={styles.presetsLabel}>Target</Text>
              {PRESETS.map((min) => {
                const active = state.targetMin === min;
                const disabled = state.mode !== "idle";
                return (
                  <Pressable
                    key={min}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => timer.setTarget(min)}
                    disabled={disabled}
                    style={[
                      styles.presetChip,
                      active && styles.presetChipActive,
                      disabled && styles.presetChipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        active && styles.presetTextActive,
                      ]}
                    >
                      {min}m
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {timer.flash ? (
              <FlashLine key={timer.flash} text={timer.flash} />
            ) : null}

            <Text style={styles.hint}>
              {hint} Elapsed time is derived from timestamps, not tick counts.
            </Text>
          </View>
        </Card>
      </View>

      {/* Session history - deliberately small and at the bottom. */}
      <Card style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyEyebrow}>Session History</Text>
          <Text style={styles.historyCount}>{sessions.length} logged</Text>
        </View>

        {sessions.length === 0 ? (
          <Text style={styles.historyEmpty}>
            No sessions yet - finish a minute or more of focus and it lands
            here.
          </Text>
        ) : (
          [...sessions]
            .reverse()
            .slice(0, 8)
            .map((session) => (
              <View key={session.id} style={styles.historyRow}>
                <Text numberOfLines={1} style={styles.historyDay}>
                  {formatDay(session.startedAt)}
                </Text>
                <Text style={styles.historyClock}>
                  {formatClock(session.startedAt)} - {formatClock(session.endedAt)}
                </Text>
                <Text style={styles.historyMinutes}>{session.minutes} min</Text>
              </View>
            ))
        )}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    marginBottom: 4,
  },
  coursePicker: {
    marginBottom: 4,
  },
  heroWrap: {
    marginTop: 4,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    paddingVertical: 28,
  },
  hero: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.star70,
  },
  heroTime: {
    marginTop: 18,
    fontFamily: fonts.mono,
    fontSize: 44,
    letterSpacing: -1.4,
    color: colors.white,
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(207,158,255,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  focusingOn: {
    marginTop: 18,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  focusingOnValue: {
    color: colors.white,
  },
  courseTotal: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: colors.w40,
  },
  progressWrap: {
    marginTop: 26,
    width: "100%",
    maxWidth: 420,
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.w07,
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
  },
  pillsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillTarget: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.star30,
    backgroundColor: colors.star06,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillTargetText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.star,
  },
  pillIdle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillIdleText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  actionsRow: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mainButton: {
    alignSelf: "auto",
    minWidth: 144,
  },
  presetsRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  presetsLabel: {
    marginRight: 4,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  presetChipActive: {
    borderColor: colors.star50,
    backgroundColor: colors.star10,
  },
  presetChipDisabled: {
    opacity: 0.4,
  },
  presetText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  presetTextActive: {
    color: colors.star,
  },
  flashRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flashText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.lilac90,
  },
  hint: {
    marginTop: 20,
    maxWidth: 340,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  historyCard: {
    padding: 20,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
  },
  historyEyebrow: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.2,
    textTransform: "uppercase",
    color: colors.w45,
  },
  historyCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  historyEmpty: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.w04,
    paddingVertical: 9,
  },
  historyDay: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  historyClock: {
    fontSize: 12,
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    color: colors.w35,
  },
  historyMinutes: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.star70,
  },
});
