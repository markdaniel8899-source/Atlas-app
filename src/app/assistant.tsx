import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Sparkles, TriangleAlert } from "lucide-react-native";
import { ChatComposer } from "../components/assistant/chat-composer";
import { ChatThread } from "../components/assistant/chat-thread";
import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { Card } from "../components/ui/card";
import { useDashboard } from "../hooks/use-dashboard";
import {
  ask,
  buildLearnerContext,
  classify,
  newTurnId,
  validate,
  type Turn,
} from "../lib/assistant";
import { colors, ease, fonts } from "../theme/theme";

export default function AssistantScreen() {
  const { height } = useWindowDimensions();
  const { profile, focus } = useDashboard();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);

  /** Turns as they were before the in-flight user message was appended. */
  const historyRef = useRef<Turn[]>([]);
  const enter = useRef(new Animated.Value(0)).current;

  const systemPrompt = buildLearnerContext({ profile, focus });

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 500,
      delay: 80,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const deliver = useCallback(
    async (text: string, appendUser: boolean) => {
      const problem = validate(text);
      if (problem) {
        setError(problem);
        return;
      }
      if (thinking) return;

      const trimmed = text.trim();
      setError(null);

      if (appendUser) {
        const userTurn: Turn = {
          id: newTurnId(),
          role: "user",
          content: trimmed,
        };
        historyRef.current = turns;
        setTurns((prev) => [...prev, userTurn]);
        setDraft("");
      }

      setThinking(true);
      try {
        const reply = await ask(
          trimmed,
          historyRef.current,
          systemPrompt,
          profile?.display_name?.trim(),
        );
        historyRef.current = [...historyRef.current, reply];
        setTurns((prev) => [...prev, reply]);
        setLastSent(null);
      } catch (caught) {
        setError(classify(caught));
        setLastSent(trimmed);
      } finally {
        setThinking(false);
      }
    },
    [turns, thinking, systemPrompt, profile],
  );

  const handleSend = (text: string) => {
    void deliver(text, true);
  };

  const handleRetry = () => {
    if (lastSent) void deliver(lastSent, false);
  };

  const handleSuggest = (prompt: string) => {
    void deliver(prompt, true);
  };

  const canRetry = Boolean(lastSent && !thinking && !draft.trim());
  const cardHeight = Math.min(660, Math.round(height * 0.72));

  return (
    <ScreenShell title="Assistant" activeLabel="Assistant">
      <ScreenHeading
        eyebrow="Study companion"
        title="Ask ATLAS."
        subtitle="Trained on your roadmap, courses and focus history, so the answer you get is the one you needed."
      />

      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        }}
      >
        <Card padded={false} style={[styles.chatCard, { height: cardHeight }]}>
          <View style={styles.chatColumn}>
            <ChatThread
              turns={turns}
              thinking={thinking}
              onSuggest={handleSuggest}
            />

            {error ? (
              <View style={styles.errorWrap}>
                <View style={styles.errorPanel}>
                  <TriangleAlert
                    size={14}
                    color="rgba(255,228,230,0.9)"
                    style={styles.errorIcon}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss error"
                    onPress={() => setError(null)}
                    hitSlop={8}
                  >
                    <Text style={styles.errorDismiss}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <ChatComposer
              draft={draft}
              onDraftChange={(value) => {
                setDraft(value);
                if (error) setError(null);
              }}
              onSend={handleSend}
              onRetry={handleRetry}
              disabled={thinking}
              canRetry={canRetry}
            />
          </View>
        </Card>
      </Animated.View>

      <View style={styles.noteRow}>
        <Sparkles size={12} color={colors.w30} />
        <Text style={styles.noteText}>
          Answers use the ATLAS tutor model · keep private data out of prompts.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chatCard: {
    overflow: "hidden",
  },
  chatColumn: {
    flex: 1,
    minHeight: 0,
  },
  errorWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  noteRow: {
    marginTop: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noteText: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
});
