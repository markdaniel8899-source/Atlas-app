import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Bold,
  Code,
  Heading,
  Italic,
  List,
  ListOrdered,
  Quote,
} from "lucide-react-native";
import { colors, fonts } from "../../theme/theme";

interface MarkdownInputProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  disabled?: boolean;
}

const TOOLBAR_BUTTONS: {
  icon: typeof Bold;
  label: string;
  wrap?: string;
  prefix?: string;
}[] = [
  { icon: Bold, label: "Bold", wrap: "**" },
  { icon: Italic, label: "Italic", wrap: "*" },
  { icon: Code, label: "Code", wrap: "`" },
  { icon: Quote, label: "Quote", prefix: "> " },
  { icon: List, label: "Bullet list", prefix: "- " },
  { icon: ListOrdered, label: "Numbered list", prefix: "1. " },
  { icon: Heading, label: "Heading", prefix: "## " },
];

/** RN port of the web markdown textarea used for predicted output. */
export function MarkdownInput({
  value,
  onChange,
  height = 140,
  disabled = false,
}: MarkdownInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const wrapSelection = (wrapChar: string) => {
    const { start, end } = selection;
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) + wrapChar + selected + wrapChar + value.slice(end);
    onChange(next);
    const caret = start + wrapChar.length;
    setSelection({ start: caret, end: caret + selected.length });
    inputRef.current?.focus();
  };

  const addPrefix = (prefix: string) => {
    const { start } = selection;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    const caret = start + prefix.length;
    setSelection({ start: caret, end: caret });
    inputRef.current?.focus();
  };

  const lineCount = value ? value.split("\n").length : 0;
  const charCount = value.length;

  return (
    <View style={styles.frame}>
      <View style={styles.toolbar}>
        {TOOLBAR_BUTTONS.map(({ icon: Icon, label, wrap, prefix }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            onPress={() => {
              if (wrap) wrapSelection(wrap);
              else if (prefix) addPrefix(prefix);
            }}
            style={({ pressed }) => [
              styles.toolButton,
              pressed && styles.toolButtonPressed,
              disabled && styles.disabled,
            ]}
          >
            <Icon size={14} color={colors.w50} />
          </Pressable>
        ))}
      </View>

      <TextInput
        keyboardAppearance="dark"
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textAlignVertical="top"
        selection={selection}
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
        placeholder="Type predicted output..."
        placeholderTextColor="rgba(255,255,255,0.25)"
        style={[styles.field, { minHeight: height }, disabled && styles.disabled]}
      />

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{lineCount} lines</Text>
        <Text style={styles.statusText}>{charCount} chars</Text>
        <Text style={styles.statusText}>Markdown</Text>
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.w10,
    backgroundColor: "#252526",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toolButton: {
    borderRadius: 4,
    padding: 6,
  },
  toolButtonPressed: {
    backgroundColor: colors.w10,
  },
  disabled: {
    opacity: 0.4,
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.mono,
    color: "rgba(255,255,255,0.85)",
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
