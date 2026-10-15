import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { BlurTargetView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "../components/app-header";
import { ActivityHeatmap } from "../components/dashboard/activity-heatmap";
import { FocusTimerWidget } from "../components/dashboard/focus-timer-widget";
import { PlayerStats } from "../components/dashboard/player-stats";
import { TodayFocus } from "../components/dashboard/today-focus";
import { MeshBackground } from "../components/mesh-background";
import { NavigationDrawer } from "../components/navigation-drawer";
import { ScrollProgressIndicator } from "../components/scroll-progress-indicator";
import { SessionCompleteCard } from "../components/session-complete-card";
import { RevealText } from "../components/ui/reveal-text";
import { useDashboard } from "../hooks/use-dashboard";
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
  const scrollRef = useRef<ScrollView>(null);
  const blurTargetRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  const name = profile?.display_name?.trim() || user?.name || "";
  const firstName = name.split(" ")[0]?.trim() || "Explorer";
  const initials =
    (name || user?.email || "A")
      .split(/[\s@._-]+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const max = contentSize.height - layoutMeasurement.height;
      const ratio = max > 0 ? contentOffset.y / max : 0;
      const next = Math.min(100, Math.max(0, Math.round(ratio * 100)));
      setScrollPercent((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <View style={styles.root}>
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <MeshBackground />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 64 + 32,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.sections}>
            <View>
              <Text style={styles.eyebrow}>{greeting()}</Text>
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
              <Text style={styles.footerLink}>Privacy Policy</Text>
              <Text style={styles.footerLink}>Terms of Service</Text>
              <Text style={styles.footerLink}>Contact Us</Text>
            </View>
          </View>
        </ScrollView>
      </BlurTargetView>

      <AppHeader
        title="Dashboard"
        onMenuPress={() => setMenuOpen(true)}
        avatarUrl={profile?.avatar_url ?? null}
        initials={initials}
        blurTarget={blurTargetRef}
      />

      <NavigationDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeLabel="Dashboard"
        blurTarget={blurTargetRef}
      />

      <ScrollProgressIndicator
        percent={scrollPercent}
        visible={scrollPercent >= 20}
        onPress={scrollToTop}
      />

      <SessionCompleteCard />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  blurTarget: {
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
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 3.6,
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
