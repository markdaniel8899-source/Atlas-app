import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus, Sparkles, TriangleAlert } from "lucide-react-native";
import { AppHeader, HEADER_HEIGHT } from "../components/app-header";
import { ChatComposer } from "../components/assistant/chat-composer";
import { ChatThread } from "../components/assistant/chat-thread";
import { OfflineBanner } from "../components/offline-banner";
import { SessionCompleteCard } from "../components/session-complete-card";
import { useDashboard } from "../hooks/use-dashboard";
import {
  buildLearnerContext,
  SUGGESTIONS,
} from "../lib/assistant";
import {
  claimAssistantChat,
  clearAssistantChat,
  dismissAssistantError,
  getAssistantChatSnapshot,
  retryAssistantMessage,
  sendAssistantMessage,
  subscribeAssistantChat,
} from "../lib/assistant-store";
import { resolveSession } from "../lib/auth";
import { closeDrawer, isDrawerOpen, openDrawer } from "../lib/drawer-store";
import { ensureOnline } from "../lib/net";
import { colors, fonts } from "../theme/theme";

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, focus } = useDashboard();

  const chat = useSyncExternalStore(
    subscribeAssistantChat,
    getAssistantChatSnapshot,
  );

  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Android hardware back (only while this tab is focused): close the drawer
  // if open, otherwise jump straight home.
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

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await resolveSession();
      if (!active) return;
      if (!user) {
        router.navigate("/login");
        return;
      }
      claimAssistantChat(user.id);
      setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const systemPrompt = buildLearnerContext({ profile, focus });
  const empty = chat.turns.length === 0;
  const canRetry = Boolean(chat.lastSent && !chat.pending && !draft.trim());

  const send = (text: string) => {
    setDraft("");
    void (async () => {
      if (!(await ensureOnline("ATLAS AI needs an internet connection."))) {
        return;
      }
      await sendAssistantMessage(
        text,
        systemPrompt,
        profile?.display_name?.trim(),
      );
    })();
  };

  const retry = () => {
    void retryAssistantMessage(systemPrompt, profile?.display_name?.trim());
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (chat.error) dismissAssistantError();
  };

  const errorBanner = chat.error ? (
    <View style={[styles.errorWrap, empty && styles.errorWrapHero]}>
      <View style={styles.errorPanel}>
        <TriangleAlert
          size={14}
          color="rgba(255,228,230,0.9)"
          style={styles.errorIcon}
        />
        <Text style={styles.errorText}>{chat.error}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          onPress={dismissAssistantError}
          hitSlop={8}
        >
          <Text style={styles.errorDismiss}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.body}
        behavior="padding"
      >
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top + HEADER_HEIGHT + 8,
              paddingBottom: keyboardOpen ? 0 : insets.bottom + 12,
            },
          ]}
        >
          {empty ? (
            <View style={styles.hero}>
              <View style={styles.heroCenter}>
                <View style={styles.heroBadge}>
                  <Sparkles size={22} color={colors.lilac} />
                </View>
                <Text style={styles.heroTitle}>Ask ATLAS anything</Text>
                <Text style={styles.heroText}>
                  It already knows your level, streak and current course, so
                  you can skip the setup and just ask.
                </Text>
              </View>

              <View style={styles.heroComposer}>
                {errorBanner}
                <ChatComposer
                  variant="hero"
                  draft={draft}
                  onDraftChange={handleDraftChange}
                  onSend={send}
                  onRetry={retry}
                  disabled={chat.pending}
                  canRetry={canRetry}
                  onFocusChange={setComposerFocused}
                />

                {!composerFocused && !keyboardOpen ? (
                  <View style={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion.label}
                      accessibilityRole="button"
                      accessibilityLabel={suggestion.label}
                      disabled={chat.pending}
                      onPress={() => send(suggestion.prompt)}
                      style={({ pressed }) => [
                        styles.suggestionChip,
                        pressed ? styles.suggestionPressed : null,
                        chat.pending ? styles.suggestionDisabled : null,
                      ]}
                    >
                      <Text style={styles.suggestionLabel}>
                        {suggestion.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.suggestionPrompt}>
                        {suggestion.prompt}
                      </Text>
                    </Pressable>
                  ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.chatColumn}>
              <View style={styles.chatTools}>
                <View style={styles.chatToolsSpacer} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start a new chat"
                  disabled={chat.pending}
                  onPress={clearAssistantChat}
                  style={({ pressed }) => [
                    styles.newChatButton,
                    pressed ? styles.newChatPressed : null,
                    chat.pending ? styles.suggestionDisabled : null,
                  ]}
                >
                  <Plus size={14} color={colors.w60} />
                  <Text style={styles.newChatText}>New chat</Text>
                </Pressable>
              </View>

              <ChatThread turns={chat.turns} thinking={chat.pending} />

              {errorBanner}

              <ChatComposer
                draft={draft}
                onDraftChange={handleDraftChange}
                onSend={send}
                onRetry={retry}
                disabled={chat.pending}
                canRetry={canRetry}
                keyboardOpen={keyboardOpen}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {checked && (
        <>
          <AppHeader
            title="Assistant"
            onMenuPress={openDrawer}
            avatarUrl={profile?.avatar_url ?? null}
          />

          <OfflineBanner />

          <SessionCompleteCard />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  hero: {
    flex: 1,
  },
  heroCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 24,
    fontFamily: fonts.display,
    letterSpacing: -0.8,
    color: colors.white,
    textAlign: "center",
  },
  heroText: {
    marginTop: 8,
    maxWidth: 320,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.w50,
    textAlign: "center",
  },
  heroComposer: {
    paddingBottom: 4,
  },
  chatColumn: {
    flex: 1,
    marginHorizontal: -16,
  },
  chatTools: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chatToolsSpacer: {
    flex: 1,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newChatPressed: {
    borderColor: colors.lilac45,
    backgroundColor: colors.lilac10,
  },
  newChatText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.w60,
  },
  suggestions: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w08,
    backgroundColor: colors.w03,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionPressed: {
    borderColor: colors.lilac45,
    backgroundColor: colors.lilac10,
  },
  suggestionDisabled: {
    opacity: 0.5,
  },
  suggestionLabel: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.w80,
  },
  suggestionPrompt: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w35,
  },
  errorWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  errorWrapHero: {
    borderTopWidth: 0,
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  errorPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(253,164,175,0.25)",
    backgroundColor: "rgba(244,63,94,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: "rgba(255,228,230,0.9)",
  },
  errorDismiss: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w45,
  },
});
