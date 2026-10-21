import { useCallback, useEffect } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { AppHeader, HEADER_HEIGHT } from "../components/app-header";
import { ActivityHeatmap } from "../components/dashboard/activity-heatmap";
import { FocusTimerWidget } from "../components/dashboard/focus-timer-widget";
import { PlayerStats } from "../components/dashboard/player-stats";
import { TodayFocus } from "../components/dashboard/today-focus";
import { OfflineBanner } from "../components/offline-banner";
import { SessionCompleteCard } from "../components/session-complete-card";
import { RevealText } from "../components/ui/reveal-text";
import { useDashboard } from "../hooks/use-dashboard";
import { getCachedAuthUser } from "../lib/auth";
import { closeDrawer, isDrawerOpen, openDrawer } from "../lib/drawer-store";
import { hasSeenOnboarding } from "../lib/onboarding";
import { colors, fonts } from "../theme/theme";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const { user, profile, heatmap, focus, loading } = useDashboard();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Home is the root tab: hardware back closes the drawer first, otherwise
  // it leaves the app (standard Android behaviour) instead of cycling tabs.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (isDrawerOpen()) {
            closeDrawer();
            return true;
          }
          BackHandler.exitApp();
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void hasSeenOnboarding().then((seen) => {
      if (cancelled) return;
      // A resolved or warmed session means this tab is signed in; never
      // bounce to login while the async session read is still settling - the
      // Android stack remounts the root screen for a frame during pops, and
      // redirecting there made the login form flash over the dashboard.
      if (user || getCachedAuthUser()) return;
      router.navigate((seen ? "/login" : "/onboarding") as Href);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  const name = profile?.display_name?.trim() || user?.name || "";
  const firstName = name.split(" ")[0]?.trim() || "Explorer";

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + HEADER_HEIGHT + 32,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.sections}>
          <View>
            <Text maxFontSizeMultiplier={1.3} style={styles.eyebrow}>
              {greeting()}
            </Text>
            <View style={styles.headingWrap}>
              <RevealText
                text={`${firstName}, here's your terrain.`}
                style={styles.heading}
              />
            </View>
          </View>

          <PlayerStats profile={profile} loading={loading} />
          <FocusTimerWidget />
          <TodayFocus focus={focus} loading={loading} />
          <ActivityHeatmap days={heatmap} />
        </View>

        <View style={styles.footerWrap}>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              onPress={() => router.navigate("/privacy" as Href)}
            >
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Terms of Service"
              onPress={() => router.navigate("/terms" as Href)}
            >
              <Text style={styles.footerLink}>Terms of Service</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Contact Us"
              onPress={() => router.navigate("/contact" as Href)}
            >
              <Text style={styles.footerLink}>Contact Us</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AppHeader
        title="Dashboard"
        onMenuPress={openDrawer}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <OfflineBanner />

      <SessionCompleteCard />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  sections: {
    gap: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 3.1,
    textTransform: "uppercase",
    color: colors.star70,
  },
  headingWrap: {
    marginTop: 12,
  },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    fontFamily: fonts.display,
    letterSpacing: -1.2,
    color: colors.white,
  },
  footerWrap: {
    marginTop: "auto",
    paddingTop: 32,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 24,
    rowGap: 8,
  },
  footerLink: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.zinc500,
  },
});
