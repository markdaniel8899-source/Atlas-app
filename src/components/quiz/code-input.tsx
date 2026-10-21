import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../../theme/theme";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  /** Minimum editor height in px. */
  height?: number;
  disabled?: boolean;
}

/**
 * Native stand-in for the web's Monaco editor: a monospace multiline field
 * with the same #1e1e1e surface, no smart quotes / autocorrect so code stays
 * intact, and a line / character status bar.
 */
export function CodeInput({
  value,
  onChange,
  language = "plaintext",
  height = 200,
  disabled = false,
}: CodeInputProps) {
  const lineCount = value ? value.split("\n").length : 0;
  const charCount = value.length;

  return (
    <View style={styles.frame}>
      <TextInput
        keyboardAppearance="dark"
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textAlignVertical="top"
        placeholder="Type your answer..."
        placeholderTextColor={colors.w30}
        style={[styles.field, { minHeight: height }, disabled && styles.disabled]}
      />
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{lineCount} lines</Text>
        <Text style={styles.statusText}>{charCount} chars</Text>
        <Text style={styles.statusText}>{language}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "#1e1e1e",
    overflow: "hidden",
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.mono,
    color: "rgba(255,255,255,0.85)",
  },
  disabled: {
    opacity: 0.6,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.w10,
    backgroundColor: "#0a0a12",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.w40,
  },
});
