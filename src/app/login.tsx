import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BlurTargetView, BlurView } from "expo-blur";
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
import { AuthMesh } from "../components/auth/auth-mesh";
import { OtpInput } from "../components/auth/otp-input";
import {
  BlurTargetRefContext,
  useBlurTargetRef,
} from "../components/blur-target";
import { MeshBackground } from "../components/mesh-background";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
  const blurTargetRef = useRef<View | null>(null);

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
      setMode(next);
      setErrors({});
      setNotice(nextNotice ?? null);
      setCode("");
      setShowPw(false);
      formAnim.setValue(0);
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 300,
        easing: ease,
        useNativeDriver: true,
      }).start();
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

  const showTabs = mode === "login" || mode === "signup";
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
    <BlurTargetRefContext.Provider value={blurTargetRef}>
      <View style={styles.root}>
        <BlurTargetView
          ref={blurTargetRef}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <MeshBackground />
          <AuthMesh />
        </BlurTargetView>

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
                styles.cardWrap,
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
              <Card glass style={styles.card} padded={false}>
                <View style={styles.cardInner}>
                  <View style={styles.header}>
                    <Text style={styles.eyebrow}>ATLAS</Text>
                    {BadgeIcon ? (
                      <View style={styles.badge}>
                        <BadgeIcon size={26} color={colors.lilac} />
                      </View>
                    ) : null}
                    <Text style={styles.title}>{header.title}</Text>
                    <Text style={styles.subtitle}>{header.subtitle}</Text>
                  </View>

                  {showTabs ? (
                    <ModeToggle
                      value={mode === "signup" ? "signup" : "login"}
                      disabled={busy}
                      onChange={switchMode}
                    />
                  ) : null}

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
                        label="Email"
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

                    <Button
                      label={submitLabel}
                      icon={
                        !busy ? (
                          <ArrowRight size={16} color={colors.primaryText} />
                        ) : undefined
                      }
                      disabled={busy}
                      onPress={() => void onSubmit()}
                      style={styles.submitWrap}
                      contentStyle={styles.submit}
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

                  <View style={styles.legal}>
                    <Text style={styles.legalText}>
                      By continuing, you agree to our{" "}
                      <Text
                        style={styles.legalLink}
                        onPress={() => router.push("/privacy")}
                        suppressHighlighting
                      >
                        Privacy Policy
                      </Text>{" "}
                      and{" "}
                      <Text
                        style={styles.legalLink}
                        onPress={() => router.push("/terms")}
                        suppressHighlighting
                      >
                        Terms & Conditions
                      </Text>
                      .
                    </Text>
                  </View>
                  </Animated.View>
                </View>
              </Card>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </BlurTargetRefContext.Provider>
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

  const blurTarget = useBlurTargetRef();

  return (
    <View>
      <View>
        <View
          style={[
            styles.fieldBox,
            focused && styles.fieldBoxFocused,
            error && styles.fieldBoxError,
          ]}
        >
          <BlurView
            intensity={26}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget ?? undefined}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.fieldTint} />
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

function ModeToggle({
  value,
  disabled,
  onChange,
}: {
  value: "login" | "signup";
  disabled?: boolean;
  onChange: (value: "login" | "signup") => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const slide = useRef(new Animated.Value(value === "signup" ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value === "signup" ? 1 : 0,
      duration: 450,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [slide, value]);

  const pillWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0;

  return (
    <View
      accessibilityRole="tablist"
      style={styles.toggle}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.togglePill,
            {
              width: pillWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pillWidth],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {(["login", "signup"] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={styles.toggleSeg}
          >
            <Text
              style={[styles.toggleText, selected && styles.toggleTextActive]}
            >
              {option === "login" ? "Log in" : "Sign up"}
            </Text>
          </Pressable>
        );
      })}
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
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  card: {
    borderRadius: 24,
  },
  cardInner: {
    padding: 28,
  },
  header: {
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 5,
    textTransform: "uppercase",
    color: colors.star70,
  },
  badge: {
    marginTop: 20,
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 12,
    fontSize: 28,
    fontFamily: fonts.semibold,
    letterSpacing: -1.1,
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
  toggle: {
    marginTop: 28,
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 4,
  },
  togglePill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(207,158,255,0.30)",
    backgroundColor: "rgba(207,158,255,0.14)",
  },
  toggleSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.w45,
  },
  toggleTextActive: {
    color: colors.white,
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
    color: "#e9dcff",
  },
  form: {
    marginTop: 24,
    gap: 16,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lilac25,
    overflow: "hidden",
    paddingHorizontal: 14,
  },
  fieldBoxFocused: {
    borderColor: colors.lilac45,
  },
  fieldTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  fieldBoxError: {
    borderColor: "rgba(248,113,113,0.55)",
  },
  fieldGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(207,158,255,0.55)",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#9db4ff",
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }
      : { elevation: 4, shadowColor: "#9db4ff" }),
  },
  fieldGlowError: {
    borderColor: "rgba(248,113,113,0.6)",
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
    color: "rgba(207,158,255,0.88)",
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
  submitWrap: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  submit: {
    paddingVertical: 15,
  },
  legal: {
    marginTop: 26,
  },
  legalText: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  legalLink: {
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
