import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { AuthGlow } from "../components/auth/auth-glow";
import { OtpInput } from "../components/auth/otp-input";
import {
  CONFIG_ERROR,
  requestPasswordReset,
  resendConfirmationOtp,
  resolveSession,
  signIn,
  signUp,
  updatePassword,
  verifyEmailOtp,
} from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { colors, ease, fonts } from "../theme/theme";

const BRAND_ICON = require("../../assets/formicon.png");

type Mode = "login" | "signup" | "verify" | "forgot" | "reset";
type ResetPhase = "code" | "password";
type VerifyOrigin = "login" | "signup";

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

interface Notice {
  tone: "error" | "info";
  text: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERROR_ICON = "rgba(252,165,165,0.7)";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const bgSize = useRef({ width: 0, height: 0 });
  bgSize.current = {
    width: Math.max(bgSize.current.width, winWidth),
    height: Math.max(bgSize.current.height, winHeight),
  };

  const [mode, setMode] = useState<Mode>("login");
  const [resetPhase, setResetPhase] = useState<ResetPhase>("code");
  const [verifyOrigin, setVerifyOrigin] = useState<VerifyOrigin>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [focused, setFocused] = useState<"name" | "email" | "password" | null>(
    null,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let active = true;
    resolveSession().then((user) => {
      if (active && user) router.replace("/");
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) setNotice({ tone: "error", text: CONFIG_ERROR });
  }, []);

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

  const applyMode = useCallback(
    (next: Mode, nextNotice?: Notice | null) => {
      formAnim.stopAnimation();
      Animated.timing(formAnim, {
        toValue: 0,
        duration: 150,
        easing: ease,
        useNativeDriver: true,
      }).start(() => {
        setMode(next);
        setErrors({});
        setNotice(nextNotice ?? null);
        setCode("");
        setShowPw(false);
        Animated.timing(formAnim, {
          toValue: 1,
          duration: 340,
          easing: ease,
          useNativeDriver: true,
        }).start();
      });
    },
    [formAnim],
  );

  const switchMode = useCallback(
    (next: Mode, nextNotice?: Notice | null) => {
      if (next === mode) {
        if (nextNotice !== undefined) setNotice(nextNotice);
        return;
      }
      applyMode(next, nextNotice);
    },
    [mode, applyMode],
  );

  const onVerifyCode = useCallback(
    async (codeValue: string, type: "signup" | "recovery") => {
      if (busy) return;
      setBusy(true);
      setNotice(null);
      const result = await verifyEmailOtp(pendingEmail, codeValue, type);
      setBusy(false);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      if (type === "signup") {
        router.replace("/");
        return;
      }
      setPassword("");
      setCode("");
      setNotice({ tone: "info", text: "Code verified. Choose your new password." });
      setResetPhase("password");
      formAnim.setValue(0);
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 280,
        easing: ease,
        useNativeDriver: true,
      }).start();
    },
    [busy, pendingEmail, router, formAnim],
  );

  const onResend = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setNotice(null);
    const result =
      mode === "verify"
        ? await resendConfirmationOtp(pendingEmail)
        : await requestPasswordReset(pendingEmail);
    setBusy(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    setCooldown(60);
    setNotice({ tone: "info", text: `New code sent to ${pendingEmail}.` });
  };

  const onSubmit = async () => {
    if (busy) return;

    if (mode === "verify" || (mode === "reset" && resetPhase === "code")) {
      if (code.length !== 6) {
        setNotice({
          tone: "error",
          text: "Enter the 6-digit code from the email.",
        });
        return;
      }
      await onVerifyCode(code, mode === "verify" ? "signup" : "recovery");
      return;
    }

    if (mode === "reset" && resetPhase === "password") {
      if (password.length < 6) {
        setErrors({ password: "Use at least 6 characters." });
        return;
      }
      setBusy(true);
      setNotice(null);
      const result = await updatePassword(password);
      setBusy(false);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      router.replace("/");
      return;
    }

    if (mode === "forgot") {
      if (!EMAIL_RE.test(email.trim())) {
        setErrors({ email: "Enter a valid email address." });
        return;
      }
      const target = email.trim();
      setBusy(true);
      setNotice(null);
      const result = await requestPasswordReset(target);
      setBusy(false);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setPendingEmail(target);
      setResetPhase("code");
      setCooldown(60);
      switchMode("reset", {
        tone: "info",
        text: `We emailed a 6-digit reset code to ${target}.`,
      });
      return;
    }

    const next: Errors = {};
    if (mode === "signup" && name.trim().length < 2) {
      next.name = "Tell us what to call you.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 6) {
      next.password = "Use at least 6 characters.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setNotice(null);
    const target = email.trim();
    const result =
      mode === "signup"
        ? await signUp(name.trim(), target, password)
        : await signIn(target, password);
    setBusy(false);

    if (result.error) {
      if (result.unverifiedEmail) {
        setPendingEmail(target);
        setVerifyOrigin("login");
        setCooldown(0);
        switchMode("verify", {
          tone: "info",
          text: `Your email isn't verified yet. Enter the code sent to ${target}, or resend it below.`,
        });
        return;
      }
      if (mode === "signup" && result.error.includes("already exists")) {
        switchMode("login", {
          tone: "info",
          text: "That email already has an account - log in below.",
        });
        return;
      }
      setNotice({ tone: "error", text: result.error });
      return;
    }

    if (result.needsConfirmation) {
      setPendingEmail(target);
      setVerifyOrigin("signup");
      setCooldown(60);
      switchMode("verify", {
        tone: "info",
        text: `We emailed a 6-digit code to ${target}.`,
      });
      return;
    }

    router.replace("/");
  };

  const header = useMemo(() => {
    switch (mode) {
      case "signup":
        return {
          title: "Claim your map.",
          subtitle: "Set up your learning OS in under a minute.",
        };
      case "verify":
        return {
          title: "Check your inbox.",
          subtitle: `Enter the 6-digit code we sent to ${pendingEmail}.`,
        };
      case "forgot":
        return {
          title: "Reset password.",
          subtitle: "We'll email you a 6-digit reset code.",
        };
      case "reset":
        return resetPhase === "code"
          ? {
              title: "Enter reset code.",
              subtitle: `Code sent to ${pendingEmail}.`,
            }
          : {
              title: "Set new password.",
              subtitle: "Almost there - choose a fresh password.",
            };
      default:
        return {
          title: "Welcome back.",
          subtitle: "Pick up where the streak left off.",
        };
    }
  }, [mode, resetPhase, pendingEmail]);

  const BadgeIcon =
    mode === "verify"
      ? ShieldCheck
      : mode === "forgot"
        ? KeyRound
        : mode === "reset"
          ? Lock
          : null;

  const showSwitch = mode === "login" || mode === "signup";
  const otpVisible =
    mode === "verify" || (mode === "reset" && resetPhase === "code");
  const resetPasswordVisible = mode === "reset" && resetPhase === "password";
  const emailVisible =
    mode === "login" || mode === "signup" || mode === "forgot";
  const passwordVisible = mode === "login" || mode === "signup";

  const submitLabel = (() => {
    if (busy) {
      switch (mode) {
        case "signup":
          return "Creating account…";
        case "verify":
          return "Verifying…";
        case "forgot":
          return "Sending code…";
        case "reset":
          return resetPhase === "code" ? "Verifying…" : "Saving…";
        default:
          return "Signing in…";
      }
    }
    switch (mode) {
      case "signup":
        return "Create account";
      case "verify":
        return "Verify & continue";
      case "forgot":
        return "Send reset code";
      case "reset":
        return resetPhase === "code" ? "Verify code" : "Save new password";
      default:
        return "Enter the dashboard";
    }
  })();

  return (
    <View style={styles.root}>
      <AuthGlow width={bgSize.current.width} height={bgSize.current.height} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
          >
            <Animated.View
              style={[
                styles.contentWrap,
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
              <View style={styles.brandRow}>
                <Image source={BRAND_ICON} style={styles.brandIcon} />
                <Text style={styles.brandName}>ATLAS</Text>
              </View>

              <View style={styles.centerArea}>
                <Animated.View
                  style={[
                    styles.headerBody,
                    {
                      opacity: formAnim,
                      transform: [
                        {
                          translateY: formAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {BadgeIcon ? (
                    <View style={styles.badge}>
                      <BadgeIcon size={26} color={colors.lilac} />
                    </View>
                  ) : null}
                  <Text style={styles.title}>{header.title}</Text>
                  <Text style={styles.subtitle}>{header.subtitle}</Text>
                </Animated.View>

                  <Animated.View
                    style={{
                      opacity: formAnim,
                      transform: [
                        {
                          translateY: formAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        },
                      ],
                    }}
                  >
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

                  <View style={styles.form}>
                    {mode === "signup" ? (
                      <Field
                        label="Name"
                        icon={
                          <User
                            size={16}
                            color={errors.name ? ERROR_ICON : colors.w30}
                          />
                        }
                        error={errors.name}
                        focused={focused === "name"}
                        value={name}
                      >
                        <TextInput
                          keyboardAppearance="dark"
                          value={name}
                          onChangeText={setName}
                          onFocus={() => setFocused("name")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel="Name"
                          autoComplete="name"
                          textContentType="name"
                          returnKeyType="next"
                          onSubmitEditing={() => emailRef.current?.focus()}
                          style={styles.input}
                        />
                      </Field>
                    ) : null}

                    {emailVisible ? (
                      <Field
                        label="Email address"
                        icon={
                          <Mail
                            size={16}
                            color={errors.email ? ERROR_ICON : colors.w30}
                          />
                        }
                        error={errors.email}
                        focused={focused === "email"}
                        value={email}
                      >
                        <TextInput
                          keyboardAppearance="dark"
                          ref={emailRef}
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => setFocused("email")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel="Email"
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          autoComplete="email"
                          textContentType="emailAddress"
                          returnKeyType="next"
                          onSubmitEditing={() => passwordRef.current?.focus()}
                          style={styles.input}
                        />
                      </Field>
                    ) : null}

                    {passwordVisible || resetPasswordVisible ? (
                      <Field
                        label={resetPasswordVisible ? "New password" : "Password"}
                        icon={
                          <Lock
                            size={16}
                            color={errors.password ? ERROR_ICON : colors.w30}
                          />
                        }
                        error={errors.password}
                        focused={focused === "password"}
                        value={password}
                        trailing={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              showPw ? "Hide password" : "Show password"
                            }
                            onPress={() => setShowPw((value) => !value)}
                            hitSlop={8}
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
                          ref={passwordRef}
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setFocused("password")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel={
                            resetPasswordVisible ? "New password" : "Password"
                          }
                          secureTextEntry={!showPw}
                          autoCapitalize="none"
                          autoComplete={
                            passwordVisible && mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          textContentType={
                            passwordVisible && mode === "login"
                              ? "password"
                              : "newPassword"
                          }
                          returnKeyType="go"
                          onSubmitEditing={() => void onSubmit()}
                          style={styles.input}
                        />
                      </Field>
                    ) : null}

                    {mode === "login" ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => switchMode("forgot")}
                        style={styles.forgotRow}
                        hitSlop={8}
                      >
                        <Text style={styles.forgotText}>
                          Forgot password?
                        </Text>
                      </Pressable>
                    ) : null}

                    {otpVisible ? (
                      <View style={styles.otpBlock}>
                        <OtpInput
                          value={code}
                          onChange={setCode}
                          onComplete={(value) =>
                            void onVerifyCode(
                              value,
                              mode === "verify" ? "signup" : "recovery",
                            )
                          }
                          autoFocus
                          error={notice?.tone === "error"}
                        />
                        <View style={styles.resendRow}>
                          <Text style={styles.resendMuted}>
                            Didn’t get the code?
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => void onResend()}
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
                                (busy || cooldown > 0) &&
                                  styles.resendDisabled,
                              ]}
                            >
                              {cooldown > 0
                                ? `Resend in ${cooldown}s`
                                : "Resend code"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    <AuthButton
                      label={submitLabel}
                      icon={
                        !busy ? (
                          <ArrowRight size={16} color={colors.white} />
                        ) : undefined
                      }
                      disabled={busy}
                      onPress={() => void onSubmit()}
                    />
                  </View>

                  {mode === "verify" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => switchMode(verifyOrigin)}
                      style={styles.backLink}
                      hitSlop={8}
                    >
                      <ArrowLeft size={14} color={colors.w45} />
                      <Text style={styles.backText}>
                        Back to{" "}
                        {verifyOrigin === "login" ? "log in" : "sign up"}
                      </Text>
                    </Pressable>
                  ) : null}

                  {mode === "forgot" ||
                  (mode === "reset" && resetPhase === "code") ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => switchMode("login")}
                      style={styles.backLink}
                      hitSlop={8}
                    >
                      <ArrowLeft size={14} color={colors.w45} />
                      <Text style={styles.backText}>Back to log in</Text>
                    </Pressable>
                  ) : null}

                  {showSwitch ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        switchMode(mode === "login" ? "signup" : "login")
                      }
                      style={styles.switchLink}
                      hitSlop={8}
                    >
                      <Text style={styles.switchMuted}>
                        {mode === "login"
                          ? "New here? "
                          : "Already have an account? "}
                      </Text>
                      <Text style={styles.switchAccent}>
                        {mode === "login" ? "Create an account" : "Log in"}
                      </Text>
                    </Pressable>
                  ) : null}

                  <View style={styles.legal}>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push("/terms")}
                      hitSlop={6}
                    >
                      <Text style={styles.legalLink}>Terms of Service</Text>
                    </Pressable>
                    <Text style={styles.legalDivider}>|</Text>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push("/privacy")}
                      hitSlop={6}
                    >
                      <Text style={styles.legalLink}>Privacy Policy</Text>
                    </Pressable>
                  </View>
                  </Animated.View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
  );
}

function AuthButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      stiffness: 420,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 420,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={[
        styles.authButtonWrap,
        { transform: [{ scale }] },
        disabled && styles.authButtonDisabled,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <LinearGradient
          colors={["#b394ff", "#8262ef", "#6446d6"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.authButton}
        >
          {icon}
          <Text style={styles.authButtonText} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function Field({
  label,
  icon,
  error,
  focused = false,
  value,
  trailing,
  children,
}: {
  label: string;
  icon?: ReactNode;
  error?: string;
  focused?: boolean;
  value: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const float = useRef(new Animated.Value(value || focused ? 1 : 0)).current;
  const focusAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(float, {
      toValue: focused || value.length > 0 ? 1 : 0,
      duration: 180,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [float, focused, value]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 240,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [focusAnim, focused]);

  const floatTransform = {
    transform: [
      {
        translateY: float.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -15],
        }),
      },
      {
        scale: float.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.76],
        }),
      },
    ],
  };

  return (
    <View>
      <View>
        <View
          style={[
            styles.fieldBox,
            error && styles.fieldBoxError,
            focused && styles.fieldBoxFocused,
          ]}
        >
          {icon}
          <View style={styles.fieldBody}>
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.floatLabel,
                styles.floatLabelRest,
                floatTransform,
                {
                  opacity: focusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
            >
              {label}
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.floatLabel,
                styles.floatLabelAccent,
                floatTransform,
                { opacity: focusAnim },
              ]}
            >
              {label}
            </Animated.Text>
            {children}
          </View>
          {trailing}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fieldGlow,
            error && styles.fieldGlowError,
            { opacity: focusAnim },
          ]}
        />
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
    justifyContent: "flex-start",
    paddingHorizontal: 24,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    flexGrow: 1,
    marginTop: 40,
  },
  centerArea: {
    flexGrow: 1,
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginRight: 28,
    gap: 18,
  },
  brandIcon: {
    width: 84,
    height: 84,
  },
  brandName: {
    fontSize: 44,
    fontFamily: fonts.brand,
    letterSpacing: 3,
    color: colors.white,
  },
  headerBody: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  badge: {
    marginTop: 20,
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
    marginTop: 28,
    gap: 16,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.055)",
    paddingHorizontal: 14,
  },
  fieldBoxError: {
    borderColor: "rgba(248,113,113,0.55)",
  },
  fieldBoxFocused: {
    borderColor: "transparent",
  },
  fieldGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(207,158,255,0.85)",
  },
  fieldGlowError: {
    borderColor: "rgba(248,113,113,0.7)",
  },
  fieldBody: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  floatLabel: {
    position: "absolute",
    left: 0,
    top: 19,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.regular,
    transformOrigin: "left top",
  },
  floatLabelRest: {
    color: "rgba(255,255,255,0.45)",
  },
  floatLabelAccent: {
    color: colors.lilac,
  },
  input: {
    flex: 1,
    padding: 0,
    paddingTop: 16,
    paddingBottom: 2,
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
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.star,
  },
  otpBlock: {
    gap: 14,
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
  authButtonWrap: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  authButtonDisabled: {
    opacity: 0.55,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    paddingVertical: 16,
  },
  authButtonText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  legal: {
    marginTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  legalLink: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: colors.w60,
  },
  legalDivider: {
    fontSize: 11.5,
    color: colors.w30,
  },
  switchLink: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  switchMuted: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  switchAccent: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: colors.star,
  },
  backLink: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
  },
  backText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
});
