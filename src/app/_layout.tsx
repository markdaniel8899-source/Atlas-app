import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
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
import { SplashOverlay } from "../components/splash-overlay";
import { initNotifications } from "../lib/notifications";
import { hydrateProfileCache } from "../lib/profile-cache";
import { colors } from "../theme/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

// Foreground presentation settings for the session-end alert.
initNotifications();

// Warm the persisted profile snapshot before the first screen mounts so the
// header avatar never falls back while booting.
void hydrateProfileCache();

// Android home-screen widget: registered at module scope so headless
// background launches can redraw the widget too.
if (Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: older APKs ship without the widget native module
    const handler = require("../lib/widgets/widget-task-handler") as typeof import("../lib/widgets/widget-task-handler");
    handler.registerAtlasWidgetTaskHandler();
  } catch {
    // Binary without the widget module (older APK) - skipped.
  }
}

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

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <TimerProvider>
      <Head>
        <title>ATLAS — Turn studying into a game you want to win</title>
        <meta
          name="description"
          content="ATLAS is a gamified study companion: focus sessions, courses, roadmaps, quizzes, a weekly leaderboard and an AI tutor that keeps your streak alive."
        />
      </Head>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.appBg },
          animation: "slide_from_right",
          animationDuration: 240,
        }}
      >
        <Stack.Screen
          name="login"
          options={{ animation: "fade", animationDuration: 300 }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ animation: "fade", animationDuration: 300 }}
        />
      </Stack>
      <SplashOverlay />
      <StatusBar style="light" />
    </TimerProvider>
  );
}
