import { useEffect, useRef, useState } from "react";
import { AppState, InteractionManager, StyleSheet, View } from "react-native";
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
import { AccountDisabledOverlay } from "../components/account-disabled-overlay";
import {
  DiagnosticBoundary,
  DiagnosticOverlay,
} from "../components/diagnostic-overlay";
import { BlurTargetRefContext } from "../components/blur-target";
import { initNotifications } from "../lib/notifications";
import { hydrateProfileCache } from "../lib/profile-cache";
import { hydrateDataCaches } from "../lib/data-cache";
import { isHeavyTaskRunning } from "../lib/heavy-task";
import { getCachedAuthUser, resolveSession, subscribeAuth } from "../lib/auth";
import { getAuthSnapshot, hydrateAuthSnapshot } from "../lib/auth-snapshot";
import { startRealtime, stopRealtime } from "../lib/realtime";
import {
  isAuthDeferralActive,
  subscribeAuthDeferral,
} from "../lib/auth-deferral";
import { refreshAiBaseUrl } from "../lib/api-config";
import {
  diag,
  hydrateDiagnostics,
  installDiagnostics,
} from "../lib/diagnostics";
import "../lib/sentry";
import { colors } from "../theme/theme";
import { tabTransitionOptions } from "../lib/tab-transition";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

installDiagnostics();
void hydrateDiagnostics().then(() => diag("app:start"));

// Foreground presentation settings for the session-end alert.
initNotifications();

// Warm the persisted auth + profile snapshots before the first screen mounts
// so an offline cold start paints the signed-in app instead of waiting for a
// token refresh that cannot reach the network.
void hydrateAuthSnapshot();
void hydrateProfileCache();

// Resolve the local Supabase session early (non-blocking) so ScreenShell can
// render its chrome on the first frame instead of waiting for an async read.
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
 * Sections are mounted in small background waves so the first visit to a tab
 * never pays a mount + fetch cost mid-transition. Cheap screens warm first;
 * the heavier AI/stateful tabs follow once the app has settled and no
 * generation is running (the scheduler defers on `isHeavyTaskRunning`).
 * `index` mounts on boot.
 */
const PRELOAD_WAVES: string[][] = [
  ["leaderboard"],
  ["notes", "courses"],
  ["friends", "settings"],
  ["timer", "assistant"],
  ["roadmap", "quiz"],
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
  // During multi-step auth flows (signup verification, password recovery)
  // the key change is deferred until the flow finishes, so the auth screen
  // survives the OTP sign-in.
  const [sessionKey, setSessionKey] = useState(
    () => getCachedAuthUser()?.id ?? "anon",
  );
  const pendingSessionKeyRef = useRef<string | null>(null);
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
      diag("layout:fonts", { loaded, error: Boolean(error) });
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  useEffect(() => {
    diag("layout:mounted", { sessionKey });
    const sub = AppState.addEventListener("change", (state) => {
      diag(state === "background" ? "app:background" : "app:active", { state });
    });
    return () => sub.remove();
    // The listener is intentionally installed once for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cold starts hold the branded splash (not a spinner) until the local
  // session read settles, so no screen mounts or fetches with an empty auth
  // token. Warm starts already know the user and render immediately. The cap
  // keeps a stuck storage read from trapping the app on the splash.
  useEffect(() => {
    let active = true;
    const cap = setTimeout(() => {
      if (active) {
        diag("layout:session:cap");
        setSessionSettled(true);
      }
    }, 2500);
    // The persisted identity lets an offline cold start lift the splash and
    // warm its caches immediately, instead of waiting for a refresh request
    // that may hang until the cap. GoTrue still revalidates in the background.
    void hydrateAuthSnapshot()
      .then(async () => {
        const snapshot = getAuthSnapshot();
        if (!active || !snapshot) return;
        diag("layout:session:snapshot");
        await Promise.all([
          hydrateProfileCache(),
          hydrateDataCaches(snapshot.id).catch(() => undefined),
        ]);
        if (!active) return;
        setSessionKey((prev) => (prev === snapshot.id ? prev : snapshot.id));
        setSessionSettled(true);
      })
      .catch(() => undefined);
    void resolveSession()
      .then(async (user) => {
        if (!active) return;
        diag("layout:session:resolved", { signedIn: Boolean(user) });
        if (!user) return;
        // Warm the owner's persisted caches before screens mount so an
        // offline cold start paints courses/leaderboard/friends/roadmaps
        // instead of empty states.
        await Promise.all([
          hydrateDataCaches(user.id).catch(() => undefined),
          hydrateProfileCache(),
        ]);
        if (!active) return;
        // Set the tab key before the splash lifts so the navigator mounts
        // once with the right owner instead of remounting anon -> user.
        if (isAuthDeferralActive()) {
          pendingSessionKeyRef.current = user.id;
          return;
        }
        setSessionKey((prev) => (prev === user.id ? prev : user.id));
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(cap);
        if (active) {
          diag("layout:session:settled");
          setSessionSettled(true);
        }
      });
    return () => {
      active = false;
      clearTimeout(cap);
    };
  }, []);

  useEffect(
    () =>
      subscribeAuth((user) => {
        if (user) void hydrateDataCaches(user.id);
        const next = user?.id ?? "anon";
        if (next === "anon") {
          pendingSessionKeyRef.current = null;
          setSessionKey((prev) => (prev === "anon" ? prev : "anon"));
          return;
        }
        if (isAuthDeferralActive()) {
          pendingSessionKeyRef.current = next;
          return;
        }
        pendingSessionKeyRef.current = null;
        setSessionKey((prev) => (prev === next ? prev : next));
      }),
    [],
  );

  useEffect(
    () =>
      subscribeAuthDeferral((active) => {
        if (active) return;
        const pending = pendingSessionKeyRef.current;
        if (!pending) return;
        pendingSessionKeyRef.current = null;
        setSessionKey((prev) => (prev === pending ? prev : pending));
      }),
    [],
  );

  // One live socket per signed-in session: friend requests, shared notes,
  // courses, roadmaps, sessions and leaderboard changes arrive without a
  // manual refresh. Torn down on sign-out and account switches.
  useEffect(() => {
    if (sessionKey === "anon") {
      stopRealtime();
      return;
    }
    startRealtime(sessionKey);
    return () => stopRealtime();
  }, [sessionKey]);

  useEffect(() => {
    setPreloadStage(0);
    // Preloading only starts once the navigator is actually on screen.
    if (!sessionSettled) return;
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
          diag("layout:preload", {
            stage,
            routes: PRELOAD_WAVES[stage - 1]?.join(","),
          });
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
  }, [sessionKey, sessionSettled]);

  useEffect(() => {
    if (sessionSettled) diag("layout:navigator", { sessionKey });
  }, [sessionSettled, sessionKey]);

  if (!loaded && !error) return null;

  const preloadedRoutes =
    sessionKey !== "anon" && preloadStage > 0
      ? PRELOAD_STAGE_SETS[preloadStage - 1]
      : null;

  return (
    <BlurTargetRefContext.Provider value={blurTargetRef}>
      <View style={styles.root}>
        <DiagnosticBoundary>
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
            {/* Mount the navigator only once the local session is known: the
                mesh and branded splash paint immediately, while screens wait for
                a real auth token instead of firing empty-header requests. */}
            {sessionSettled ? (
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
            ) : null}
            <GlobalDrawer />
            <SplashOverlay ready={sessionSettled || Boolean(error)} />
            <AccountDisabledOverlay />
            <StatusBar style="light" />
          </TimerProvider>
        </DiagnosticBoundary>
        <DiagnosticOverlay />
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
