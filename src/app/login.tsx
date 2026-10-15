import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
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
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { MeshBackground } from "../components/mesh-background";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CONFIG_ERROR, resolveSession, signIn, signUp } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";
import { colors, fonts } from "../theme/theme";

type Mode = "login" | "signup";

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

interface Notice {
  tone: "error" | "info";
  text: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState<"name" | "email" | "password" | null>(
    null,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setNotice(null);
  };

  const onSubmit = async () => {
    if (busy) return;

    const next: Errors = {};
    if (mode === "signup" && name.trim().length < 2) {
      next.name = "Tell us what to call you.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 6) {
      next.password = "Use at least 6 characters.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setNotice(null);

    const result =
      mode === "signup"
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);

    setBusy(false);

    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    if (result.needsConfirmation) {
      setNotice({
        tone: "info",
        text: `We sent a confirmation link to ${email.trim()}. Confirm it, then sign in.`,
      });
      setMode("login");
      return;
    }

    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <MeshBackground />

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
          <Card style={styles.card} padded={false}>
            <View style={styles.cardInner}>
              <View style={styles.header}>
                <Text style={styles.eyebrow}>ATLAS</Text>
                <Text style={styles.title}>
                  {mode === "login" ? "Welcome back." : "Claim your map."}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === "login"
                    ? "Pick up where the streak left off."
                    : "Set up your learning OS in under a minute."}
                </Text>
              </View>

              <View style={styles.tabs}>
                {(["login", "signup"] as Mode[]).map((m) => {
                  const selected = mode === m;
                  return (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => switchMode(m)}
                      style={[styles.tab, selected && styles.tabActive]}
                    >
                      <Text
                        style={[styles.tabText, selected && styles.tabTextActive]}
                      >
                        {m === "login" ? "Log in" : "Sign up"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

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
                  <Field label="Name" error={errors.name}>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                      placeholder="Ada Lovelace"
                      placeholderTextColor={PLACEHOLDER}
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      style={styles.input}
                    />
                  </Field>
                ) : null}

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
                >
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="you@domain.com"
                    placeholderTextColor={PLACEHOLDER}
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
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPw ? "Hide password" : "Show password"
                      }
                      onPress={() => setShowPw((v) => !v)}
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
                    placeholder="••••••••"
                    placeholderTextColor={PLACEHOLDER}
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

                <Button
                  label={
                    busy
                      ? mode === "login"
                        ? "Signing in…"
                        : "Creating account…"
                      : mode === "login"
                        ? "Enter the dashboard"
                        : "Create account"
                  }
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

              <Pressable
                accessibilityRole="button"
                onPress={() => switchMode(mode === "login" ? "signup" : "login")}
                style={styles.switchLink}
                hitSlop={8}
              >
                <Text style={styles.switchMuted}>
                  {mode === "login" ? "New here? " : "Already climbing? "}
                </Text>
                <Text style={styles.switchAccent}>
                  {mode === "login" ? "Create an account" : "Log in"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const PLACEHOLDER = "rgba(255,255,255,0.25)";
const ERROR_ICON = "rgba(252,165,165,0.7)";

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
  focused?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          error
            ? styles.inputRowError
            : focused
              ? styles.inputRowFocused
              : null,
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
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
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
  tabs: {
    marginTop: 28,
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabActive: {
    borderColor: colors.w10,
    backgroundColor: colors.w07,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
  tabTextActive: {
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
  label: {
    marginBottom: 6,
    fontSize: 11,
    fontFamily: fonts.medium,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.w40,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputRowFocused: {
    borderColor: "rgba(157,180,255,0.45)",
  },
  inputRowError: {
    borderColor: "rgba(248,113,113,0.5)",
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
  submitWrap: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  submit: {
    paddingVertical: 15,
  },
  switchLink: {
    marginTop: 24,
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
    fontFamily: fonts.regular,
    color: colors.star,
  },
});
