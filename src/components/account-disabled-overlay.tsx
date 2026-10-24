import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, ShieldAlert } from "lucide-react-native";
import { AuthButton } from "./auth/auth-button";
import { AuthGlow } from "./auth/auth-glow";
import {
  isAccountDisabled,
  resetAccountGuard,
  subscribeAccountDisabled,
} from "../lib/account-guard";
import { signOut } from "../lib/auth";
import { colors, fonts } from "../theme/theme";

const SUPPORT_EMAIL = "hafizmzain786@gmail.com";

/**
 * Full-screen notice shown when Supabase rejects the session because the
 * account was disabled. Rendered above the navigator so it cannot be
 * dismissed with the hardware back button or a route change.
 */
export function AccountDisabledOverlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(() => isAccountDisabled());
  const opacity = useRef(new Animated.Value(0)).current;
  const signedOut = useRef(false);

  useEffect(() => subscribeAccountDisabled(setVisible), []);

  useEffect(() => {
    if (!visible) {
      signedOut.current = false;
      opacity.setValue(0);
      return;
    }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();

    if (!signedOut.current) {
      signedOut.current = true;
      void signOut({ local: true }).catch(() => undefined);
    }
  }, [visible, opacity]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [visible]);

  const backToSignIn = useCallback(() => {
    resetAccountGuard();
    router.navigate("/login");
  }, [router]);

  const contactSupport = useCallback(() => {
    resetAccountGuard();
    router.navigate("/contact");
  }, [router]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <AuthGlow width={width} height={height} />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <ShieldAlert size={30} color="#fca5a5" />
          </View>
          <Text style={styles.title}>Account disabled</Text>
          <Text style={styles.body}>
            This account has been disabled, so ATLAS signed you out. If you
            think this is a mistake, contact support and we’ll help you
            restore access.
          </Text>

          <AuthButton
            label="Contact support"
            icon={<Mail size={16} color={colors.white} />}
            onPress={contactSupport}
          />

          <Pressable
            accessibilityRole="button"
            onPress={backToSignIn}
            hitSlop={8}
            style={styles.link}
          >
            <Text style={styles.linkLabel}>Back to sign in</Text>
          </Pressable>

          <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: "rgba(4,4,10,0.98)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.22)",
    backgroundColor: "rgba(20,10,18,0.86)",
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  iconBadge: {
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    backgroundColor: "rgba(248,113,113,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 20,
    fontSize: 28,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    color: colors.white,
    textAlign: "center",
  },
  body: {
    marginTop: 10,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.w60,
    textAlign: "center",
  },
  link: {
    marginTop: 18,
    alignSelf: "center",
  },
  linkLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.star,
  },
  supportEmail: {
    marginTop: 22,
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: colors.w30,
    textAlign: "center",
  },
});
