import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
} from "react-native";
import {
  ArrowUpRight,
  Check,
  Pause,
  Play,
  Square,
  Timer,
  X,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { useTimer } from "../../context/timer-context";
import { MOTION } from "../../theme/motion";
import { colors, ease, fonts } from "../../theme/theme";

const PRESETS = [25, 50, 90];

/** HH:MM:SS for the cumulative focus counter. */
function formatHMS(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
                outputRange: [6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Check size={14} color={colors.lilac90} />
      <Text style={styles.flashText}>{text}</Text>
    </Animated.View>
  );
}

function QuickStartDialog({
  preset,
  onSelect,
  onStart,
  onClose,
  requestCloseRef,
}: {
  preset: number;
  onSelect: (minutes: number) => void;
  onStart: () => void;
  onClose: () => void;
  requestCloseRef: { current: (() => void) | null };
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: MOTION.sheet,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(anim, {
        toValue: 0,
        duration: MOTION.sheetClose,
        easing: MOTION.easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        try {
          after?.();
        } finally {
          onClose();
        }
      });
    },
    [anim, onClose],
  );

  useEffect(() => {
    requestCloseRef.current = () => close();
    return () => {
      requestCloseRef.current = null;
    };
  }, [requestCloseRef, close]);

  return (
    <View style={styles.modalRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <Pressable
          accessibilityLabel="Close quick start"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={() => close()}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.dialog,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.dialogHeader}>
          <View style={styles.dialogHeaderText}>
            <Text style={styles.eyebrow}>Quick start</Text>
            <Text style={styles.dialogTitle}>Pick a session length</Text>
          </View>
          <Pressable
            accessibilityLabel="Close"
            onPress={() => close()}
            hitSlop={6}
            style={styles.dialogClose}
          >
            <X size={16} color={colors.w50} />
          </Pressable>
        </View>

        <View style={styles.presetsRow}>
          {PRESETS.map((min) => {
            const selected = preset === min;
            return (
              <Pressable
                key={min}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(min)}
                style={[styles.preset, selected ? styles.presetOn : styles.presetOff]}
              >
                <Text
                  style={[
                    styles.presetMinutes,
                    { color: selected ? colors.star : colors.w50 },
                  ]}
                >
                  {min}
                </Text>
                <Text
                  style={[
                    styles.presetLabel,
                    { color: selected ? colors.star : colors.w50 },
                  ]}
                >
                  min
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dialogActions}>
          <Button
            label="Start session"
            icon={<Play size={16} color={colors.primaryText} />}
            onPress={() => close(onStart)}
            style={styles.dialogStart}
          />
          <Button variant="ghost" label="Cancel" onPress={() => close()} />
        </View>
      </Animated.View>
    </View>
  );
}

export function FocusTimerWidget() {
  const timer = useTimer();
  const router = useRouter();
  const { state, globalTotal, progress, activeCourse, flash } = timer;
  const [quickOpen, setQuickOpen] = useState(false);
  const quickCloseRef = useRef<(() => void) | null>(null);
  const [preset, setPreset] = useState(state.targetMin);
  const active = state.mode !== "idle";

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(100, progress * 100),
      duration: 400,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [progress, progressAnim]);

  const openQuick = () => {
    setPreset(state.targetMin);
    setQuickOpen(true);
  };

  const startQuick = () => {
    timer.startQuick(preset);
    setQuickOpen(false);
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Timer size={20} color={colors.star} />
            </View>
            <View>
              <Text style={styles.title}>Focus timer</Text>
              <Text style={styles.status}>
                {state.mode === "running"
                  ? "Session in progress"
                  : state.mode === "paused"
                    ? "Session paused"
                    : "No session running"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open timer"
            onPress={() => router.push("/timer")}
            style={styles.openTimer}
          >
            <Text style={styles.openTimerText}>Open timer</Text>
            <ArrowUpRight size={14} color={colors.w45} />
          </Pressable>
        </View>

        {/* HERO: lifetime focus counter, same number as the timer page. */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Total Focus Time</Text>
          <Text style={styles.heroTime}>{formatHMS(globalTotal)}</Text>
          <Text style={styles.focusingOn}>
            Focusing on:{" "}
            <Text style={styles.focusingOnValue}>
              {activeCourse ? activeCourse.title : "No course selected"}
            </Text>
          </Text>

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
                <Text style={styles.pillIdleText}>
                  {active ? `${Math.round(progress * 100)}%` : "Idle"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {active ? (
            <>
              <Button
                label={state.mode === "running" ? "Pause" : "Resume"}
                icon={
                  state.mode === "running" ? (
                    <Pause size={16} color={colors.primaryText} />
                  ) : (
                    <Play size={16} color={colors.primaryText} />
                  )
                }
                onPress={timer.toggle}
                contentStyle={styles.actionButton}
                accessibilityLabel={
                  state.mode === "running" ? "Pause session" : "Resume session"
                }
              />
              <Button
                variant="ghost"
                label="Stop"
                icon={<Square size={14} color={colors.white} />}
                onPress={() => timer.stop()}
                contentStyle={styles.actionButton}
                accessibilityLabel="Stop and log session"
              />
            </>
          ) : (
            <Button
              label="Quick start"
              icon={<Play size={16} color={colors.primaryText} />}
              onPress={openQuick}
              contentStyle={styles.actionButton}
            />
          )}
        </View>

        {flash ? <FlashLine key={flash} text={flash} /> : null}
      </Card>

      <Modal
        visible={quickOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() =>
          quickCloseRef.current
            ? quickCloseRef.current()
            : setQuickOpen(false)
        }
      >
        <QuickStartDialog
          preset={preset}
          onSelect={setPreset}
          onStart={startQuick}
          onClose={() => setQuickOpen(false)}
          requestCloseRef={quickCloseRef}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
  },
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  openTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openTimerText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  hero: {
    marginTop: 24,
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
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 36,
    letterSpacing: -0.9,
    color: colors.white,
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(207,158,255,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  focusingOn: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.w50,
  },
  focusingOnValue: {
    color: colors.w80,
  },
  progressWrap: {
    marginTop: 20,
    width: "100%",
    maxWidth: 320,
    alignSelf: "center",
  },
  track: {
    height: 6,
    width: "100%",
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
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillTarget: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.star30,
    backgroundColor: colors.star06,
    paddingHorizontal: 10,
  },
  pillTargetText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.regular,
    color: colors.star,
  },
  pillIdle: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 10,
  },
  pillIdleText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
  actionsRow: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  flashRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  flashText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.lilac90,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  dialog: {
    width: "100%",
    maxWidth: 384,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
    padding: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  dialogHeaderText: {
    flexShrink: 1,
  },
  dialogTitle: {
    marginTop: 6,
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  dialogClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  presetsRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  preset: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  presetOn: {
    borderColor: colors.star50,
    backgroundColor: colors.star10,
  },
  presetOff: {
    borderColor: colors.w10,
    backgroundColor: colors.w03,
  },
  presetMinutes: {
    fontFamily: fonts.mono,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  presetLabel: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: fonts.regular,
  },
  dialogActions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  dialogStart: {
    flex: 1,
  },
});
