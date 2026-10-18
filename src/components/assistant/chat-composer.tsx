import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowUp, RotateCcw } from "lucide-react-native";
import { colors, fonts, RADIUS } from "../../theme/theme";

interface ChatComposerProps {
  onSend: (message: string) => void;
  onRetry: () => void;
  disabled: boolean;
  canRetry: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  /** "hero" is the centred first-run input; "dock" sits under the thread. */
  variant?: "dock" | "hero";
  /** Fires when the input gains/loses focus (hero hides extras on focus). */
  onFocusChange?: (focused: boolean) => void;
  /** True while the soft keyboard is open - docks the row flush onto the IME. */
  keyboardOpen?: boolean;
}

const MAX_LENGTH = 8000;

export function ChatComposer({
  onSend,
  onRetry,
  disabled,
  canRetry,
  draft,
  onDraftChange,
  variant = "dock",
  onFocusChange,
  keyboardOpen = false,
}: ChatComposerProps) {
  const [focused, setFocused] = useState(false);
  const hero = variant === "hero";

  const submit = () => {
    if (disabled) return;
    onSend(draft);
  };

  return (
    <View
      style={[
        styles.wrap,
        hero && styles.wrapHero,
        !hero && keyboardOpen ? styles.wrapTight : null,
      ]}
    >
      <View
        style={[
          styles.row,
          hero && styles.rowHero,
          focused ? styles.rowFocused : null,
        ]}
      >
        <TextInput
          keyboardAppearance="dark"
          value={draft}
          maxLength={MAX_LENGTH}
          multiline
          placeholder={hero ? "Ask ATLAS anything…" : "Message ATLAS…"}
          placeholderTextColor={colors.w30}
          accessibilityLabel="Message ATLAS"
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          onChangeText={onDraftChange}
          style={[styles.input, hero && styles.inputHero]}
        />

        {canRetry && !draft.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry last message"
            disabled={disabled}
            onPress={onRetry}
            style={({ pressed }) => [
              styles.iconButton,
              hero && styles.iconButtonHero,
              styles.retryButton,
              pressed ? styles.retryButtonPressed : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <RotateCcw size={16} color={colors.w50} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={disabled || !draft.trim()}
          onPress={submit}
          style={({ pressed }) => [
            styles.iconButton,
            hero && styles.iconButtonHero,
            styles.sendButton,
            pressed ? styles.sendButtonPressed : null,
            disabled || !draft.trim() ? styles.disabled : null,
          ]}
        >
          {disabled ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <ArrowUp size={hero ? 18 : 16} color={colors.primaryText} />
          )}
        </Pressable>
      </View>

      {!hero && !keyboardOpen ? (
        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            ATLAS AI can make mistakes.
          </Text>
          <Text style={styles.footerCount}>
            {draft.length}/{MAX_LENGTH}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    padding: 12,
  },
  wrapHero: {
    borderTopWidth: 0,
    padding: 0,
  },
  wrapTight: {
    paddingBottom: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w03,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowHero: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  rowFocused: {
    borderColor: colors.lilac50,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 180,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.white,
    textAlignVertical: "top",
  },
  inputHero: {
    minHeight: 44,
    fontSize: 15,
    lineHeight: 22,
  },
  iconButton: {
    marginBottom: 3,
    width: 36,
    height: 36,
    borderRadius: RADIUS.inner,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonHero: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 1,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.w10,
  },
  retryButtonPressed: {
    borderColor: colors.lilac45,
  },
  sendButton: {
    backgroundColor: colors.lilac,
  },
  sendButtonPressed: {
    backgroundColor: colors.lilac90,
  },
  disabled: {
    opacity: 0.35,
  },
  footer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  footerHint: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
  },
  footerCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w30,
    fontVariant: ["tabular-nums"],
  },
});
