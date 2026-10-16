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
}

const MAX_LENGTH = 8000;

export function ChatComposer({
  onSend,
  onRetry,
  disabled,
  canRetry,
  draft,
  onDraftChange,
}: ChatComposerProps) {
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (disabled) return;
    onSend(draft);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, focused ? styles.rowFocused : null]}>
        <TextInput
          value={draft}
          maxLength={MAX_LENGTH}
          multiline
          placeholder="Ask ATLAS anything…"
          placeholderTextColor={colors.w30}
          accessibilityLabel="Message ATLAS"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={onDraftChange}
          style={styles.input}
        />

        {canRetry && !draft.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry last message"
            disabled={disabled}
            onPress={onRetry}
            style={({ pressed }) => [
              styles.iconButton,
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
            styles.sendButton,
            pressed ? styles.sendButtonPressed : null,
            disabled || !draft.trim() ? styles.disabled : null,
          ]}
        >
          {disabled ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <ArrowUp size={16} color={colors.primaryText} />
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          Enter to send · Shift + Enter for a new line
        </Text>
        <Text style={styles.footerCount}>
          {draft.length}/{MAX_LENGTH}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.w06,
    padding: 12,
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
  iconButton: {
    marginBottom: 3,
    width: 36,
    height: 36,
    borderRadius: RADIUS.inner,
    alignItems: "center",
    justifyContent: "center",
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
