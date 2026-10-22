import { useEffect, useRef, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { DarkTheme, Tabs, ThemeProvider } from "expo-router";
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
import { isHeavyTaskRunning } from "../lib/heavy-task";
import { getCachedAuthUser, resolveSession, subscribeAuth } from "../lib/auth";
import { refreshAiBaseUrl } from "../lib/api-config";
import "../lib/sentry";
import { colors } from "../theme/theme";
import { tabTransitionOptions } from "../lib/tab-transition";

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

// Fetch the AI base URL from app_config (non-blocking; falls back to env).
void refreshAiBaseUrl();

// Android detaches and re-attaches screens for a frame during navigator
// transitions; painting the window with the app background keeps that frame
// invisible instead of flashing black or white.
void SystemUI.setBackgroundColorAsync(colors.appBg).catch(() => {});

// React Navigation defaults to its light theme. A transparent navigation
// background lets the shared mesh show through every tab, matching the app's
// dark palette without a per-scene background override.
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent" },
};

/**
 * Cheap sections are mounted in small background waves so the first visit to
 * a tab does not pay a mount cost mid-transition. AI-heavy and stateful tabs
 * (quiz, roadmap, assistant, timer) are intentionally excluded: they mount on
 * demand instead of competing with a generation. `index` mounts on boot.
 */
const PRELOAD_WAVES: string[][] = [
  ["leaderboard"],
  ["notes", "courses"],
  ["friends", "settings"],
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
  // Warm starts already know the local user; a cold start waits for the
  // first session read before the branded splash can hand off.
  const [sessionSettled, setSessionSettled] = useState(
    () => getCachedAuthUser() !== null,
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

  useEffect(() => {
    let active = true;
    void resolveSession()
      .catch(() => undefined)
      .finally(() => {
        if (active) setSessionSettled(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stage = 0;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (isHeavyTaskRunning()) {
          schedule(1200);
          return;
        }
        InteractionManager.runAfterInteractions(() => {
          if (cancelled) return;
          stage += 1;
          setPreloadStage(stage);
          if (stage < PRELOAD_WAVES.length) schedule(750);
        });
      }, delay);
    };

    schedule(2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
         * change only swaps their content over a static backdrop - no
         * per-screen SVG or full-screen alpha layer is drawn.
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
          <ThemeProvider value={NAVIGATION_THEME}>
            <Tabs
              key={sessionKey}
              backBehavior="history"
              tabBar={() => null}
              detachInactiveScreens={false}
              screenOptions={({ route }) => ({
                headerShown: false,
                sceneStyle: { backgroundColor: "transparent" },
                lazy: !preloadedRoutes?.has(route.name),
                ...tabTransitionOptions(),
              })}
            />
          </ThemeProvider>
          <GlobalDrawer />
          <SplashOverlay ready={sessionSettled || Boolean(error)} />
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
