import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  RefreshControl,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { AppHeader, HEADER_HEIGHT } from "./app-header";
import { OfflineBanner } from "./offline-banner";
import { SessionCompleteCard } from "./session-complete-card";
import { useKeyboardHeight } from "../hooks/use-keyboard-height";
import { useProfile } from "../hooks/use-profile";
import { getCachedAuthUser, resolveSession } from "../lib/auth";
import { closeDrawer, isDrawerOpen, openDrawer } from "../lib/drawer-store";
import { colors, fonts } from "../theme/theme";

interface ScreenShellProps {
  title: string;
  children: ReactNode;
  /** Hide the Privacy/Terms footer for full-bleed screens. */
  hideFooter?: boolean;
  /**
   * Public info pages (about/help/privacy/terms/contact) render for signed-out
   * visitors too, and get a back arrow instead of the drawer button.
   */
  publicPage?: boolean;
  /** Scroll to the bottom whenever the keyboard opens (form pages). */
  scrollOnKeyboard?: boolean;
  /**
   * Let the children own vertical scrolling (long virtualized lists). The
   * screen body becomes a plain flex view instead of a ScrollView.
   */
  scrollable?: boolean;
  /** Pull-to-refresh control for the ScrollView. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/**
 * Shared chrome for the section screens: mesh backdrop, scrolling body and
 * fixed header. The navigation drawer itself is global (see GlobalDrawer).
 */
export function ScreenShell({
  title,
  children,
  hideFooter = false,
  publicPage = false,
  scrollOnKeyboard = false,
  scrollable = true,
  refreshControl,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfile();
  // Public pages can render at once; protected pages skip the "nothing"
  // frame when the session was already resolved (the common case after
  // the first navigation). The effect below still verifies and redirects.
  const [checked, setChecked] = useState(
    publicPage || getCachedAuthUser() !== null,
  );
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView | null>(null);

  // Android hardware back, scoped to the focused tab: close the drawer if
  // open, otherwise jump straight home - never walk back through history.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (isDrawerOpen()) {
            closeDrawer();
            return true;
          }
          Keyboard.dismiss();
          router.navigate("/");
          return true;
        },
      );
      return () => subscription.remove();
    }, [router]),
  );

  // Keep form fields reachable while typing: pad the scroll content by the
  // live keyboard height (edge-to-edge Android does not resize the window).
  useEffect(() => {
    if (!scrollOnKeyboard || keyboardHeight === 0) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
    return () => clearTimeout(id);
  }, [keyboardHeight, scrollOnKeyboard]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await resolveSession();
      if (!active) return;
      if (!user && !publicPage) {
        router.navigate("/login");
        return;
      }
      setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, [router, publicPage]);

  const footer = !hideFooter ? <ScreenFooter /> : null;

  return (
    <View style={styles.root}>
      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + HEADER_HEIGHT + 32,
              paddingBottom: insets.bottom + 32 + keyboardHeight,
            },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          <View style={styles.sections}>{children}</View>
          {footer}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            styles.contentStatic,
            {
              paddingTop: insets.top + HEADER_HEIGHT + 32,
              paddingBottom: insets.bottom + 32,
            },
          ]}
        >
          <View style={[styles.sections, styles.sectionsStatic]}>
            {children}
          </View>
          {footer}
        </View>
      )}

      {checked && (
        <>
          <AppHeader
            title={title}
            onMenuPress={openDrawer}
            onBackPress={
              publicPage
                ? () => {
                    if (router.canGoBack()) router.back();
                    else router.navigate("/");
                  }
                : undefined
            }
            avatarUrl={profile?.avatar_url ?? null}
          />

          <OfflineBanner />

          <SessionCompleteCard />
        </>
      )}
    </View>
  );
}

/** Privacy/Terms links, reusable as a virtualized list footer. */
export function ScreenFooter() {
  const router = useRouter();

  return (
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
      <Text maxFontSizeMultiplier={1.3} style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <Text style={styles.heading}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  contentStatic: {
    flex: 1,
  },
  sections: {
    gap: 20,
  },
  sectionsStatic: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 3.1,
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
