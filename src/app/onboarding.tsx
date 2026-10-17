import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Check,
  Flame,
  Lock,
  Sparkles,
  Star,
  Timer,
  Trophy,
} from "lucide-react-native";
import { AuthGlow } from "../components/auth/auth-glow";
import { markOnboardingSeen } from "../lib/onboarding";
import { colors, fonts } from "../theme/theme";

const FORM_ICON = require("../../assets/formicon.png");

function useFloat(delay: number, distance: number, duration: number) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);

  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

function FloatChip({
  children,
  style,
  delay = 0,
  rotate = "0deg",
  distance = 7,
  duration = 1900,
}: {
  children: ReactNode;
  style?: object;
  delay?: number;
  rotate?: string;
  distance?: number;
  duration?: number;
}) {
  const y = useFloat(delay, distance, duration);
  return (
    <Animated.View
      style={[styles.chip, style, { transform: [{ translateY: y }, { rotate }] }]}
    >
      {children}
    </Animated.View>
  );
}

function FocusVisual({ areaHeight }: { areaHeight: number }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const ringScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const ringOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.85],
  });

  return (
    <View style={[styles.visualArea, { height: areaHeight }]}>
      <Animated.View
        style={[
          styles.ringOuter,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      <View style={styles.ringInner} />
      <View style={styles.orbGlow} />
      <LinearGradient
        colors={["#c9a6ff", "#8262ef", "#5a3fd0"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.orb}
      >
        <Text style={styles.orbTime}>25:00</Text>
        <Text style={styles.orbLabel}>FOCUS</Text>
      </LinearGradient>
      <FloatChip delay={0} style={styles.chipFocusA}>
        <Timer size={13} color={colors.lilac} />
        <Text style={styles.chipText}>Deep Work · 90 min</Text>
      </FloatChip>
      <FloatChip delay={520} style={styles.chipFocusB}>
        <Flame size={13} color={colors.lilac} />
        <Text style={styles.chipText}>Streak · 12 days</Text>
      </FloatChip>
    </View>
  );
}

function RoadmapVisual({ areaHeight }: { areaHeight: number }) {
  return (
    <View style={[styles.visualArea, { height: areaHeight }]}>
      <View style={styles.roadCol}>
        <View style={styles.nodeDone}>
          <Check size={20} color="#0a0a1a" strokeWidth={3} />
        </View>
        <View style={styles.dashDot} />
        <View style={styles.dashDot} />
        <View>
          <View style={styles.activeHalo} />
          <LinearGradient
            colors={["#c9a6ff", "#6446d6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nodeActive}
          >
            <Star size={24} color={colors.white} fill={colors.white} />
          </LinearGradient>
        </View>
        <View style={styles.dashDot} />
        <View style={styles.dashDot} />
        <View style={styles.nodeLocked}>
          <Lock size={17} color={colors.w60} />
        </View>
      </View>
      <FloatChip delay={160} style={styles.chipRoadA}>
        <Text style={styles.chipText}>Level 3 · Deep Work</Text>
      </FloatChip>
      <FloatChip delay={640} style={styles.chipRoadB}>
        <Sparkles size={13} color={colors.lilac} />
        <Text style={styles.chipText}>XP +120</Text>
      </FloatChip>
    </View>
  );
}

function StudyVisual({ areaHeight }: { areaHeight: number }) {
  return (
    <View style={[styles.visualArea, { height: areaHeight }]}>
      <FloatChip delay={0} rotate="-7deg" style={styles.cardNote}>
        <View style={[styles.bar, styles.barTitle]} />
        <View style={[styles.bar, styles.barLineWide]} />
        <View style={[styles.bar, styles.barLineMid]} />
        <View style={[styles.bar, styles.barLineShort]} />
      </FloatChip>
      <FloatChip delay={360} rotate="3deg" style={styles.cardQuiz}>
        <View style={[styles.bar, styles.barTitleSmall]} />
        <View style={styles.optionRow}>
          <View style={styles.optionDot} />
          <View style={[styles.bar, styles.barLineMid]} />
        </View>
        <View style={styles.optionRow}>
          <View style={[styles.optionDot, styles.optionDotActive]}>
            <Check size={9} color="#0a0a1a" strokeWidth={4} />
          </View>
          <View style={[styles.bar, styles.barLineWide]} />
        </View>
      </FloatChip>
      <FloatChip delay={680} rotate="8deg" style={styles.cardAi}>
        <Sparkles size={14} color={colors.lilac} />
        <View style={[styles.bar, styles.barLineMid]} />
      </FloatChip>
    </View>
  );
}

function SquadVisual({ areaHeight }: { areaHeight: number }) {
  return (
    <View style={[styles.visualArea, { height: areaHeight }]}>
      <FloatChip delay={240} style={styles.chipSquad}>
        <Trophy size={13} color={colors.lilac} />
        <Text style={styles.chipText}>You · #1 this week</Text>
      </FloatChip>
      <View style={styles.podiumRow}>
        <View style={styles.podiumCol}>
          <View style={[styles.avatar, styles.avatarSide]}>
            <Text style={styles.avatarText}>Z</Text>
          </View>
          <View style={styles.podiumBar2} />
        </View>
        <View style={styles.podiumCol}>
          <View style={[styles.avatar, styles.avatarFirst]}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <LinearGradient
            colors={["#b394ff", "#6446d6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.podiumBar1}
          />
        </View>
        <View style={styles.podiumCol}>
          <View style={[styles.avatar, styles.avatarSide]}>
            <Text style={styles.avatarText}>H</Text>
          </View>
          <View style={styles.podiumBar3} />
        </View>
      </View>
    </View>
  );
}

interface Slide {
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  renderVisual: (areaHeight: number) => ReactNode;
}

const SLIDES: Slide[] = [
  {
    key: "focus",
    eyebrow: "FOCUS",
    title: "Focus, one session at a time.",
    subtitle: "Run deep-work timers, log every hour, and keep your streak alive.",
    renderVisual: (h) => <FocusVisual areaHeight={h} />,
  },
  {
    key: "roadmap",
    eyebrow: "ROADMAP",
    title: "Your learning, on the map.",
    subtitle: "Follow a level-by-level path, earn XP, and unlock every stage.",
    renderVisual: (h) => <RoadmapVisual areaHeight={h} />,
  },
  {
    key: "study",
    eyebrow: "STUDY",
    title: "Notes, quizzes and AI in one place.",
    subtitle: "Capture ideas, test yourself, and ask the built-in assistant anything.",
    renderVisual: (h) => <StudyVisual areaHeight={h} />,
  },
  {
    key: "squad",
    eyebrow: "SQUAD",
    title: "Grow faster with friends.",
    subtitle: "Climb the leaderboard together and keep each other accountable.",
    renderVisual: (h) => <SquadVisual areaHeight={h} />,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const bgSize = useRef({ width: 0, height: 0 });
  bgSize.current = {
    width: Math.max(bgSize.current.width, width),
    height: Math.max(bgSize.current.height, height),
  };

  const areaHeight = Math.min(
    330,
    Math.max(
      190,
      height - (insets.top + 72) - (insets.bottom + 105) - 195,
    ),
  );
  const last = index === SLIDES.length - 1;

  function finish() {
    void markOnboardingSeen();
    router.replace("/");
  }

  function next() {
    if (last) {
      finish();
      return;
    }
    const target = index + 1;
    setIndex(target);
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }

  return (
    <View style={styles.root}>
      <AuthGlow width={bgSize.current.width} height={bgSize.current.height} />

      <View pointerEvents="none" style={[styles.brandWrap, { top: insets.top + 18 }]}>
        <Image source={FORM_ICON} style={styles.brandIcon} />
        <Text style={styles.brandName}>ATLAS</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        onPress={finish}
        hitSlop={10}
        style={[styles.skip, { top: insets.top + 22 }]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, paddingTop: insets.top + 72 }]}>
            {item.renderVisual(areaHeight)}
            <View style={styles.slideText}>
              <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 26 }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? "Get started" : "Next"}
          onPress={next}
        >
          <LinearGradient
            colors={["#b394ff", "#8262ef", "#6446d6"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{last ? "Get Started" : "Next"}</Text>
            <ArrowRight size={17} color={colors.white} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05060c",
  },
  brandWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  brandIcon: {
    width: 30,
    height: 30,
  },
  brandName: {
    fontSize: 17,
    fontFamily: fonts.brand,
    letterSpacing: 2,
    color: colors.white,
  },
  skip: {
    position: "absolute",
    right: 20,
  },
  skipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w60,
  },
  slide: {
    alignItems: "center",
  },
  visualArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slideText: {
    marginTop: 30,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 2.6,
    color: colors.lilac70,
  },
  title: {
    marginTop: 12,
    maxWidth: 330,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 36,
    fontFamily: fonts.display,
    color: colors.white,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 14.5,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.w60,
  },
  footer: {
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.lilac,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: "rgba(255,255,255,0.85)",
  },
  ringOuter: {
    position: "absolute",
    width: 206,
    height: 206,
    borderRadius: 103,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.28)",
  },
  ringInner: {
    position: "absolute",
    width: 158,
    height: 158,
    borderRadius: 79,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.14)",
  },
  orbGlow: {
    position: "absolute",
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: "rgba(124,92,240,0.22)",
  },
  orb: {
    width: 106,
    height: 106,
    borderRadius: 53,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8262ef",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  orbTime: {
    fontSize: 22,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    color: colors.white,
  },
  orbLabel: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: fonts.medium,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.75)",
  },
  chipFocusA: {
    position: "absolute",
    left: 12,
    top: "18%",
  },
  chipFocusB: {
    position: "absolute",
    right: 12,
    bottom: "20%",
  },
  roadCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  nodeDone: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#b394ff",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeActive: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  activeHalo: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(207,158,255,0.35)",
  },
  nodeLocked: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  dashDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginVertical: 4,
    backgroundColor: "rgba(207,158,255,0.4)",
  },
  chipRoadA: {
    position: "absolute",
    left: 16,
    top: "30%",
  },
  chipRoadB: {
    position: "absolute",
    right: 18,
    bottom: "26%",
  },
  cardNote: {
    position: "absolute",
    left: 22,
    top: "14%",
    width: 152,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
  },
  cardQuiz: {
    position: "absolute",
    right: 18,
    top: "38%",
    width: 172,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
  },
  cardAi: {
    position: "absolute",
    left: 48,
    bottom: "12%",
    width: 148,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
  },
  bar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  barTitle: {
    width: "54%",
    height: 9,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  barTitleSmall: {
    width: "42%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  barLineWide: {
    width: "100%",
  },
  barLineMid: {
    width: "76%",
  },
  barLineShort: {
    width: "46%",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotActive: {
    backgroundColor: colors.lilac,
    borderColor: colors.lilac,
  },
  chipSquad: {
    position: "absolute",
    top: "8%",
    alignSelf: "center",
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 14,
    marginTop: 26,
  },
  podiumCol: {
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarFirst: {
    backgroundColor: "rgba(207,158,255,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(207,158,255,0.5)",
  },
  avatarSide: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  podiumBar1: {
    width: 68,
    height: 118,
    borderRadius: 16,
  },
  podiumBar2: {
    width: 62,
    height: 86,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  podiumBar3: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
});
