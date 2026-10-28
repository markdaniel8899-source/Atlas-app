import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useKeyboardHeight } from "../hooks/use-keyboard-height";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { AuthButton } from "../components/auth/auth-button";
import { AuthGlow } from "../components/auth/auth-glow";
import { OTP_LENGTH, OtpInput } from "../components/auth/otp-input";
import {
  CONFIG_ERROR,
  requestEmailSignInCode,
  resendConfirmationOtp,
  resolveSession,
  signIn,
  signOut,
  signUp,
  verifyEmailOtp,
} from "../lib/auth";
import { beginAuthDeferral, endAuthDeferral } from "../lib/auth-deferral";
import {
  clearPendingVerification,
  isPendingVerification,
  markPendingVerification,
} from "../lib/verify-pending";
import { isSupabaseConfigured } from "../lib/supabase";
import { colors, ease, fonts } from "../theme/theme";

const BRAND_ICON = require("../../assets/formicon.png");

type Mode = "login" | "signup" | "verify";
type VerifyOrigin = "login" | "signup";
type VerifyMethod = "email" | "signup";

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
  const keyboardHeight = useKeyboardHeight();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const bgSize = useRef({ width: 0, height: 0 });
  bgSize.current = {
    width: Math.max(bgSize.current.width, winWidth),
    height: Math.max(bgSize.current.height, winHeight),
  };

  // Hardware back on the auth screen leaves the app - walking back into the
  // dashboard would instantly bounce here again while signed out.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          BackHandler.exitApp();
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  const params = useLocalSearchParams<{ message?: string }>();
  const [mode, setMode] = useState<Mode>("login");
  const [verifyOrigin, setVerifyOrigin] = useState<VerifyOrigin>("signup");
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>("signup");
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
  const scrollRef = useRef<ScrollView | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(1)).current;
  const verifyDoneRef = useRef(false);

  const scrollFormIntoView = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, []);

  useEffect(() => {
    let active = true;
    resolveSession().then((user) => {
      if (active && user) router.navigate("/");
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) setNotice({ tone: "error", text: CONFIG_ERROR });
  }, []);

  // Flows that finish on another screen (password reset) hand the confirmation
  // copy over as a route param, mirroring the website's /login?message=...
  const incomingMessage = params.message;
  useEffect(() => {
    if (typeof incomingMessage !== "string" || !incomingMessage) return;
    setMode("login");
    setNotice({ tone: "info", text: incomingMessage });
    router.setParams({ message: undefined });
  }, [incomingMessage, router]);

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

  // This screen stays mounted inside the tab navigator, so reset it whenever
  // it loses focus - the next visit must never resume a stale OTP step.
  useFocusEffect(
    useCallback(
      () => () => {
        formAnim.stopAnimation();
        formAnim.setValue(1);
        endAuthDeferral();
        setMode("login");
        setName("");
        setPassword("");
        setCode("");
        setShowPw(false);
        setPendingEmail("");
        setFocused(null);
        setErrors({});
        setNotice(null);
        setCooldown(0);
      },
      [formAnim],
    ),
  );

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
        if (next === "verify") verifyDoneRef.current = false;
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
    async (codeValue: string, method: VerifyMethod) => {
      if (busy || verifyDoneRef.current) return;
      const origin = verifyOrigin;
      setBusy(true);
      setNotice(null);
      const result = await verifyEmailOtp(pendingEmail, codeValue, method);
      setBusy(false);
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      verifyDoneRef.current = true;
      await clearPendingVerification(pendingEmail);

      if (origin === "signup") {
        // Match the website: a new account verifies its inbox, then signs in
        // from the login form instead of landing on the dashboard.
        await signOut({ local: true });
        endAuthDeferral();
        setPassword("");
        setCode("");
        switchMode("login", {
          tone: "info",
          text: "Account created successfully. Please log in.",
        });
        return;
      }

      endAuthDeferral();
      router.navigate("/");
    },
    [busy, pendingEmail, verifyOrigin, router, switchMode],
  );

  const onResend = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setNotice(null);
    const result =
      verifyMethod === "signup"
        ? await resendConfirmationOtp(pendingEmail)
        : await requestEmailSignInCode(pendingEmail);
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

    if (mode === "verify") {
      if (code.length !== OTP_LENGTH) {
        setNotice({
          tone: "error",
          text: `Enter the ${OTP_LENGTH}-digit code from the email.`,
        });
        return;
      }
      await onVerifyCode(code, verifyMethod);
      return;
    }

    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }

    const target = email.trim();

    if (mode === "signup") {
      const next: Errors = {};
      if (name.trim().length < 2) {
        next.name = "Tell us what to call you.";
      }
      if (password.length < 8) {
        next.password = "Use at least 8 characters.";
      }
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      setBusy(true);
      setNotice(null);
      // Creating the account can sign the user in immediately (when Supabase
      // email confirmation is off). Defer the navigator reset so this screen
      // can still walk through the OTP step, exactly like the website.
      beginAuthDeferral();
      const created = await signUp(name.trim(), target, password);

      if (created.error) {
        endAuthDeferral();
        setBusy(false);
        if (created.error.includes("already exists")) {
          switchMode("login", {
            tone: "info",
            text: "That email already has an account - log in below.",
          });
          return;
        }
        setNotice({ tone: "error", text: created.error });
        return;
      }

      let sendError: string | undefined;
      if (created.needsConfirmation) {
        setVerifyMethod("signup");
      } else {
        // Confirmation is disabled server-side, so no signup code is emailed.
        // Drop the instant session and request a sign-in code instead.
        await signOut({ local: true });
        setVerifyMethod("email");
        const sendResult = await requestEmailSignInCode(target);
        sendError = sendResult.error;
      }
      await markPendingVerification(target);

      setBusy(false);
      setPendingEmail(target);
      setVerifyOrigin("signup");
      setCode("");
      setPassword("");

      if (sendError) {
        setCooldown(0);
        switchMode("verify", { tone: "error", text: sendError });
        return;
      }

      setCooldown(60);
      switchMode("verify", {
        tone: "info",
        text: `We emailed a ${OTP_LENGTH}-digit code to ${target}.`,
      });
      return;
    }

    const next: Errors = {};
    if (password.length === 0) {
      next.password = "Enter your password.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // An account created on this device must finish its OTP step before the
    // password login is accepted (Supabase "Confirm email" is currently off,
    // so the server alone would let it through).
    if (await isPendingVerification(target)) {
      setBusy(true);
      setNotice(null);
      setPendingEmail(target);
      setVerifyOrigin("login");
      setVerifyMethod("email");
      setCooldown(0);
      const sendResult = await requestEmailSignInCode(target);
      setBusy(false);
      if (sendResult.error) {
        switchMode("verify", { tone: "error", text: sendResult.error });
        return;
      }
      setCooldown(60);
      switchMode("verify", {
        tone: "info",
        text: `Verify your email to finish setting up your account. Enter the ${OTP_LENGTH}-digit code sent to ${target}.`,
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    const result = await signIn(target, password);
    setBusy(false);

    if (result.error) {
      if (result.unverifiedEmail) {
        setPendingEmail(target);
        setVerifyOrigin("login");
        setVerifyMethod("signup");
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

    router.navigate("/");
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
          title: "Verify your email.",
          subtitle: `Enter the ${OTP_LENGTH}-digit code we sent to ${pendingEmail}.`,
        };
      default:
        return {
          title: "Welcome back.",
          subtitle: "Pick up where the streak left off.",
        };
    }
  }, [mode, pendingEmail]);

  const BadgeIcon = mode === "verify" ? ShieldCheck : null;

  const showSwitch = mode === "login" || mode === "signup";
  const otpVisible = mode === "verify";
  const emailVisible = mode === "login" || mode === "signup";
  const passwordVisible = mode === "login" || mode === "signup";

  // With the keyboard open, keep the lowest auth controls reachable. The
  // content padding alone still lets a long form scroll; this also brings the
  // password / OTP / submit cluster into view on small screens.
  useEffect(() => {
    if (keyboardHeight > 0 && (focused === "password" || otpVisible)) {
      scrollFormIntoView();
    }
  }, [focused, keyboardHeight, otpVisible, scrollFormIntoView]);

  const submitLabel = (() => {
    if (busy) {
      switch (mode) {
        case "signup":
          return "Creating account…";
        case "verify":
          return "Verifying…";
        default:
          return "Signing in…";
      }
    }
    switch (mode) {
      case "signup":
        return "Create account";
      case "verify":
        return "Verify";
      default:
        return "Log in";
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
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24 + keyboardHeight,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
                          returnKeyType={passwordVisible ? "next" : "go"}
                          onSubmitEditing={() => {
                            if (passwordVisible) {
                              passwordRef.current?.focus();
                            } else {
                              void onSubmit();
                            }
                          }}
                          style={styles.input}
                        />
                      </Field>
                    ) : null}

                    {passwordVisible ? (
                      <Field
                        label="Password"
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
                          ref={passwordRef}
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setFocused("password")}
                          onBlur={() => setFocused(null)}
                          accessibilityLabel="Password"
                          secureTextEntry={!showPw}
                          autoCapitalize="none"
                          autoComplete={
                            mode === "login" ? "current-password" : "new-password"
                          }
                          textContentType={
                            mode === "login" ? "password" : "newPassword"
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
                        onPress={() => router.navigate("/forgot-password")}
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
                            void onVerifyCode(value, verifyMethod)
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
                      onPress={() => {
                        endAuthDeferral();
                        switchMode(verifyOrigin);
                      }}
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
