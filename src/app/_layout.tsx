import { useEffect, useRef, useState } from "react";
import { Easing, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { BlurTargetView } from "expo-blur";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
} from "@expo-google-fonts/geist-mono";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { TimerProvider } from "../context/timer-context";
import { MeshBackground } from "../components/mesh-background";
import { SplashOverlay } from "../components/splash-overlay";
import { GlobalDrawer } from "../components/global-drawer";
import { BlurTargetRefContext } from "../components/blur-target";
import { initNotifications } from "../lib/notifications";
import { hydrateProfileCache } from "../lib/profile-cache";
import { getCachedAuthUser, resolveSession, subscribeAuth } from "../lib/auth";
import { colors } from "../theme/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

// Foreground presentation settings for the session-end alert.
initNotifications();

// Warm the persisted profile snapshot before the first screen mounts so the
// header avatar never falls back while booting.
void hydrateProfileCache();

// Resolve the local Supabase session early so ScreenShell can render its
// chrome on the first frame instead of waiting for an async read.
void resolveSession();

// Android detaches and re-attaches screens for a frame during navigator
// transitions; painting the window with the app background keeps that frame
// invisible instead of flashing black or white.
void SystemUI.setBackgroundColorAsync(colors.appBg).catch(() => {});

/**
 * Sections are mounted in small background waves so the first visit to any
 * tab never pays a mount cost mid-transition. One screen per wave keeps every
 * commit short: mounting the heavy screens together caused a visible hitch
 * on the dashboard. `index` mounts on boot, so it is not listed.
 */
const PRELOAD_WAVES: string[][] = [
  ["leaderboard"],
  ["notes", "courses"],
  ["quiz", "friends"],
  ["roadmap"],
  ["timer", "assistant", "settings"],
];

/** Cumulative snapshot of the waves: a route stays mounted once preloaded. */
const PRELOAD_STAGE_SETS: Set<string>[] = (() => {
  const mounted = new Set<string>();
  return PRELOAD_WAVES.map((wave) => {
    wave.forEach((name) => mounted.add(name));
    return new Set(mounted);
  });
})();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    Outfit_600SemiBold,
    CreateFuture: require("../../assets/fonts/CreateFuture.otf"),
  });

  // Every route lives in one flat, always-mounted tab set, so switching
  // sections never remounts a screen (no reloads, no stale data). Keying on
  // the auth owner resets that state on sign-in / sign-out / account switch.
  const [sessionKey, setSessionKey] = useState(
    () => getCachedAuthUser()?.id ?? "anon",
  );
  // Sections are mounted in the background shortly after boot (behind the
  // splash hand-off) so the first visit to a tab never pays a mount + fetch
  // cost mid-transition. Staged so no single commit freezes the JS thread.
  const [preloadStage, setPreloadStage] = useState(0);
  const blurTargetRef = useRef<View | null>(null);

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  useEffect(
    () =>
      subscribeAuth((user) => {
        const next = user?.id ?? "anon";
        setSessionKey((prev) => (prev === next ? prev : next));
      }),
    [],
  );

  useEffect(() => {
    setPreloadStage(0);
    const timers = PRELOAD_STAGE_SETS.map((_, index) =>
      setTimeout(
        () => setPreloadStage((stage) => Math.max(stage, index + 1)),
        2000 + index * 750,
      ),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [sessionKey]);

  if (!loaded && !error) return null;

  const preloadedRoutes =
    sessionKey !== "anon" && preloadStage > 0
      ? PRELOAD_STAGE_SETS[preloadStage - 1]
      : null;

  return (
    <BlurTargetRefContext.Provider value={blurTargetRef}>
      <View style={styles.root}>
        {/*
         * One shared mesh behind every tab. Screens are transparent, so a tab
         * change only crossfades their content over a static backdrop - no
         * per-screen SVG is animated, which keeps the transition on the GPU.
         */}
        <BlurTargetView
          ref={blurTargetRef}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <MeshBackground />
        </BlurTargetView>

        <TimerProvider>
          <Head>
            <title>ATLAS - Turn studying into a game you want to win</title>
            <meta
              name="description"
              content="ATLAS is a gamified study companion: focus sessions, courses, roadmaps, quizzes, a weekly leaderboard and an AI tutor that keeps your streak alive."
            />
          </Head>
          <Tabs
            key={sessionKey}
            backBehavior="history"
            tabBar={() => null}
            // Keep every mounted scene attached: switching tabs then costs one
            // GPU crossfade instead of a native detach/attach + layout pass.
            detachInactiveScreens={false}
            screenOptions={({ route }) => ({
              headerShown: false,
              animation: "fade",
              // Pure opacity crossfade over the shared mesh. Scaling full
              // screens forces Android to re-rasterize every text layer, so
              // only opacity animates; 220ms ends as the drawer finishes
              // closing, which hides the switch completely.
              transitionSpec: {
                animation: "timing",
                config: {
                  duration: 220,
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              },
              sceneStyleInterpolator: ({ current }) => ({
                sceneStyle: {
                  opacity: current.progress.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              }),
              lazy: !preloadedRoutes?.has(route.name),
            })}
          />
          <GlobalDrawer />
          <SplashOverlay />
          <StatusBar style="light" />
        </TimerProvider>
      </View>
    </BlurTargetRefContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
});
