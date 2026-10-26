import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
} from "lucide-react-native";
import { AuthButton } from "../components/auth/auth-button";
import { AuthGlow } from "../components/auth/auth-glow";
import { OTP_LENGTH, OtpInput } from "../components/auth/otp-input";
import { useKeyboardHeight } from "../hooks/use-keyboard-height";
import {
  requestPasswordReset,
  signOut,
  updatePassword,
  verifyEmailOtp,
} from "../lib/auth";
import {
  beginAuthDeferral,
  endAuthDeferral,
} from "../lib/auth-deferral";
import { colors, ease, fonts } from "../theme/theme";

const BRAND_ICON = require("../../assets/formicon.png");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERROR_ICON = "rgba(252,165,165,0.7)";

type Phase = "email" | "code" | "password";

interface Notice {
  tone: "error" | "info";
  text: string;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const bgSize = useRef({ width: 0, height: 0 });
  bgSize.current = {
    width: Math.max(bgSize.current.width, winWidth),
    height: Math.max(bgSize.current.height, winHeight),
  };

  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [focused, setFocused] = useState<
    "email" | "password" | "confirm" | null
  >(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const scrollRef = useRef<ScrollView | null>(null);
  const confirmRef = useRef<TextInput | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const phaseAnim = useRef(new Animated.Value(1)).current;

  const goToLogin = useCallback(() => {
    router.navigate("/login");
    endAuthDeferral();
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          goToLogin();
          return true;
        },
      );
      return () => {
        subscription.remove();
        // Leaving the flow must release a deferred recovery sign-in and clear
        // any half-finished step - the screen stays mounted in the tab set.
        endAuthDeferral();
        setPhase("email");
        setEmail("");
        setCode("");
        setPassword("");
        setConfirmPassword("");
        setEmailError(null);
        setPasswordError(null);
        setConfirmError(null);
        setNotice(null);
        setBusy(false);
        setCooldown(0);
        setShowPw(false);
        setShowConfirmPw(false);
        setFocused(null);
      };
    }, [goToLogin]),
  );

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (phase !== "code" && phase !== "password") return;
    const id = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      260,
    );
    return () => clearTimeout(id);
  }, [phase]);

  const changePhase = useCallback(
    (next: Phase, nextNotice: Notice | null = null) => {
      phaseAnim.stopAnimation();
      Animated.timing(phaseAnim, {
        toValue: 0,
        duration: 140,
        easing: ease,
        useNativeDriver: true,
      }).start(() => {
        setPhase(next);
        setNotice(nextNotice);
        Animated.timing(phaseAnim, {
          toValue: 1,
          duration: 300,
          easing: ease,
          useNativeDriver: true,
        }).start();
      });
    },
    [phaseAnim],
  );

  const sendResetCode = useCallback(async () => {
    if (busy) return;
    const target = email.trim();
    if (!EMAIL_RE.test(target)) {
      setEmailError("Enter the email connected to your ATLAS account.");
      return;
    }
    setEmailError(null);
    setPasswordError(null);
    setBusy(true);
    setNotice(null);
    const result = await requestPasswordReset(target);
    setBusy(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    setEmail(target);
    setCode("");
    setCooldown(60);
    changePhase("code", {
      tone: "info",
      text: `We emailed an ${OTP_LENGTH}-digit reset code to ${target}.`,
    });
  }, [busy, email, changePhase]);

  const resendCode = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setNotice(null);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    setCooldown(60);
    setNotice({ tone: "info", text: `New code sent to ${email.trim()}.` });
  };

  const verifyCode = useCallback(
    async (value: string) => {
      if (busy) return;
      if (value.length !== OTP_LENGTH) {
        setNotice({
          tone: "error",
          text: `Enter the ${OTP_LENGTH}-digit code from the email.`,
        });
        return;
      }
      setBusy(true);
      setNotice(null);
      // Verification creates a session; keep the root navigator on this
      // screen until updatePassword has saved the new password.
      beginAuthDeferral();
      const result = await verifyEmailOtp(email.trim(), value, "recovery");
      setBusy(false);
      if (result.error) {
        endAuthDeferral();
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setConfirmError(null);
      setNotice(null);
      changePhase("password");
    },
    [busy, email, changePhase],
  );

  const savePassword = async () => {
    if (busy) return;

    const nextPasswordError =
      password.length < 8 ? "Use at least 8 characters." : null;
    const nextConfirmError =
      password === confirmPassword ? null : "Passwords do not match.";
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    setBusy(true);
    setNotice(null);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    // Match the website: finish the reset signed out, back on the login form.
    await signOut({ local: true });
    endAuthDeferral();
    setPassword("");
    setConfirmPassword("");
    router.navigate({
      pathname: "/login",
      params: { message: "Password updated. Please log in." },
    });
  };

  const header = (() => {
    switch (phase) {
      case "code":
        return {
          title: "Enter reset code.",
          subtitle: `Type the ${OTP_LENGTH}-digit code sent to ${email.trim()}.`,
        };
      case "password":
        return {
          title: "Set a new password.",
          subtitle: "Your code is verified. Choose a fresh password.",
        };
      default:
        return {
          title: "Forgot your password?",
          subtitle:
            "Enter your account email and we’ll send an 8-digit reset code.",
        };
    }
  })();

  const submitLabel = (() => {
    if (busy) {
      switch (phase) {
        case "email":
          return "Sending code…";
        case "code":
          return "Verifying…";
        default:
          return "Saving…";
      }
    }
    switch (phase) {
      case "code":
        return "Verify code";
      case "password":
        return "Save new password";
      default:
        return "Send reset code";
    }
  })();

  const onSubmit = () => {
    if (phase === "email") {
      void sendResetCode();
      return;
    }
    if (phase === "code") {
      void verifyCode(code);
      return;
    }
    if (phase === "password") {
      void savePassword();
      return;
    }
    goToLogin();
  };

  const showSubmit = phase !== "code";

  return (
    <View style={styles.root}>
      <AuthGlow width={bgSize.current.width} height={bgSize.current.height} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24 + keyboardHeight,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to log in"
              onPress={goToLogin}
              hitSlop={8}
              style={styles.backButton}
            >
              <ArrowLeft size={20} color={colors.w60} />
            </Pressable>
            <View style={styles.brandRow}>
              <Image source={BRAND_ICON} style={styles.brandIcon} />
              <Text style={styles.brandName}>ATLAS</Text>
            </View>
            <View style={styles.backSpacer} />
          </View>

          <Animated.View
            style={[
              styles.centerArea,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.formWrap,
                {
                  opacity: phaseAnim,
                  transform: [
                    {
                      translateY: phaseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.badge}>
                <KeyRound size={26} color={colors.lilac} />
              </View>

              <Text style={styles.title}>{header.title}</Text>
              <Text style={styles.subtitle}>{header.subtitle}</Text>

              {notice ? (
                <Text
                  style={[
                    styles.notice,
                    notice.tone === "error"
                      ? styles.noticeError
                      : styles.noticeInfo,
                  ]}
                >
                  {notice.text}
                </Text>
              ) : null}

              {phase === "email" ? (
                <View style={styles.form}>
                  <Field
                    label="Email address"
                    icon={
                      <Mail
                        size={16}
                        color={emailError ? ERROR_ICON : colors.w30}
                      />
                    }
                    error={emailError ?? undefined}
                    focused={focused === "email"}
                  >
                    <TextInput
                      keyboardAppearance="dark"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (emailError) setEmailError(null);
                        if (notice) setNotice(null);
                      }}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="send"
                      onSubmitEditing={() => void sendResetCode()}
                      style={styles.input}
                    />
                  </Field>
                </View>
              ) : null}

              {phase === "code" ? (
                <View style={styles.form}>
                  <OtpInput
                    value={code}
                    onChange={(value) => {
                      setCode(value);
                      if (notice) setNotice(null);
                    }}
                    onComplete={(value) => void verifyCode(value)}
                    autoFocus
                    error={notice?.tone === "error"}
                  />
                  <View style={styles.resendRow}>
                    <Text style={styles.resendMuted}>
                      Didn’t get the code?
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void resendCode()}
                      disabled={busy || cooldown > 0}
                      hitSlop={8}
                      style={styles.resendActionWrap}
                    >
                      {cooldown > 0 ? null : (
                        <RefreshCw size={13} color={colors.star} />
                      )}
                      <Text
                        style={[
                          styles.resendAction,
                          (busy || cooldown > 0) && styles.resendDisabled,
                        ]}
                      >
                        {cooldown > 0
                          ? `Resend in ${cooldown}s`
                          : "Resend code"}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => changePhase("email")}
                    hitSlop={8}
                    style={styles.textLink}
                  >
                    <Text style={styles.textLinkLabel}>
                      Use a different email
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {phase === "password" ? (
                <View style={styles.form}>
                  <Field
                    label="New password"
                    icon={
                      <Lock
                        size={16}
                        color={passwordError ? ERROR_ICON : colors.w30}
                      />
                    }
                    error={passwordError ?? undefined}
                    focused={focused === "password"}
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPw ? "Hide password" : "Show password"
                        }
                        onPress={() => setShowPw((value) => !value)}
                        hitSlop={14}
                      >
                        {showPw ? (
                          <EyeOff size={17} color={colors.w35} />
                        ) : (
                          <Eye size={17} color={colors.w35} />
                        )}
                      </Pressable>
                    }
                  >
                    <TextInput
                      keyboardAppearance="dark"
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (passwordError) setPasswordError(null);
                        if (notice) setNotice(null);
                      }}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="New password"
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                      style={styles.input}
                    />
                  </Field>

                  <Field
                    label="Confirm password"
                    icon={
                      <Lock
                        size={16}
                        color={confirmError ? ERROR_ICON : colors.w30}
                      />
                    }
                    error={confirmError ?? undefined}
                    focused={focused === "confirm"}
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showConfirmPw ? "Hide password" : "Show password"
                        }
                        onPress={() => setShowConfirmPw((value) => !value)}
                        hitSlop={14}
                      >
                        {showConfirmPw ? (
                          <EyeOff size={17} color={colors.w35} />
                        ) : (
                          <Eye size={17} color={colors.w35} />
                        )}
                      </Pressable>
                    }
                  >
                    <TextInput
                      keyboardAppearance="dark"
                      ref={confirmRef}
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        if (confirmError) setConfirmError(null);
                        if (notice) setNotice(null);
                      }}
                      onFocus={() => setFocused("confirm")}
                      onBlur={() => setFocused(null)}
                      accessibilityLabel="Confirm password"
                      secureTextEntry={!showConfirmPw}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="go"
                      onSubmitEditing={() => void savePassword()}
                      style={styles.input}
                    />
                  </Field>
                </View>
              ) : null}

              {showSubmit ? (
                <AuthButton
                  label={submitLabel}
                  icon={
                    !busy ? (
                      <ArrowRight size={16} color={colors.white} />
                    ) : undefined
                  }
                  disabled={busy}
                  onPress={onSubmit}
                />
              ) : null}

            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  icon,
  error,
  focused,
  trailing,
  children,
}: {
  label: string;
  icon?: ReactNode;
  error?: string;
  focused: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          focused && styles.fieldBoxFocused,
          error ? styles.fieldBoxError : null,
        ]}
      >
        {icon}
        {children}
        {trailing}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: {
    width: 40,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandIcon: {
    width: 40,
    height: 40,
  },
  brandName: {
    fontSize: 24,
    fontFamily: fonts.brand,
    letterSpacing: 2,
    color: colors.white,
  },
  centerArea: {
    flexGrow: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingVertical: 32,
  },
  formWrap: {
    width: "100%",
  },
  badge: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.25)",
    backgroundColor: "rgba(207,158,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 24,
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: -0.6,
    color: colors.white,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w45,
    textAlign: "center",
  },
  notice: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    overflow: "hidden",
  },
  noticeError: {
    borderColor: "rgba(248,113,113,0.3)",
    backgroundColor: "rgba(248,113,113,0.07)",
    color: "#fecaca",
  },
  noticeInfo: {
    borderColor: "rgba(207,158,255,0.3)",
    backgroundColor: "rgba(207,158,255,0.08)",
    color: "#ecdcff",
  },
  form: {
    marginTop: 26,
    gap: 16,
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w45,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.055)",
    paddingHorizontal: 14,
  },
  fieldBoxFocused: {
    borderColor: "rgba(207,158,255,0.85)",
    backgroundColor: "rgba(207,158,255,0.06)",
  },
  fieldBoxError: {
    borderColor: "rgba(248,113,113,0.55)",
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.white,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "rgba(252,165,165,0.8)",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resendMuted: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  resendActionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  resendAction: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.star,
  },
  resendDisabled: {
    color: colors.w30,
  },
  textLink: {
    marginTop: 20,
    alignSelf: "center",
  },
  textLinkLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.star,
  },
});
