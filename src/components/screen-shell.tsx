import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { AppHeader, HEADER_HEIGHT } from "./app-header";
import { MeshBackground } from "./mesh-background";
import { NavigationDrawer } from "./navigation-drawer";
import { SessionCompleteCard } from "./session-complete-card";
import { resolveSession } from "../lib/auth";
import { fetchProfile } from "../lib/db/profile";
import { PROFILE_CHANGED_EVENT, listen } from "../lib/events";
import { colors, fonts } from "../theme/theme";

interface ScreenShellProps {
  title: string;
  activeLabel: string;
  children: ReactNode;
  /** Hide the Privacy/Terms footer for full-bleed screens. */
  hideFooter?: boolean;
}

/**
 * Shared chrome for the inner screens (timer, leaderboard, friends,
 * settings): mesh backdrop, scrolling body, fixed header and drawer.
 */
export function ScreenShell({
  title,
  activeLabel,
  children,
  hideFooter = false,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      void (async () => {
        const user = await resolveSession();
        if (!active) return;
        if (!user) {
          router.replace("/login");
          return;
        }
        setChecked(true);
        const profile = await fetchProfile(user.id);
        if (active) setAvatarUrl(profile?.avatar_url ?? null);
      })();
    };
    load();
    const unsubscribe = listen(PROFILE_CHANGED_EVENT, load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  return (
    <View style={styles.root}>
      <MeshBackground />

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sections}>{children}</View>

        {!hideFooter && (
          <View style={styles.footerWrap}>
            <View style={styles.footer}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
                onPress={() => router.push("/privacy" as Href)}
              >
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Terms of Service"
                onPress={() => router.push("/terms" as Href)}
              >
                <Text style={styles.footerLink}>Terms of Service</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Contact Us"
                onPress={() => router.push("/contact" as Href)}
              >
                <Text style={styles.footerLink}>Contact Us</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {checked && (
        <>
          <AppHeader
            title={title}
            onMenuPress={() => setMenuOpen(true)}
            avatarUrl={avatarUrl}
          />

          <NavigationDrawer
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            activeLabel={activeLabel}
          />

          <SessionCompleteCard />
        </>
      )}
    </View>
  );
}

/** Shared page heading: eyebrow + display title, matching the web pages. */
export function ScreenHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heading}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
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
  heading: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 38,
    fontFamily: fonts.display,
    letterSpacing: -1.2,
    color: colors.white,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w50,
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
