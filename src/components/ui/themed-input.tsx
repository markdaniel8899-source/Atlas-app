import { useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, TextInput } from "react-native";

type ThemedInputProps = ComponentProps<typeof TextInput>;

/**
 * TextInput wired to the app theme: dark keyboard on iOS (Android keyboards
 * follow the dark interface style) and a soft lilac ring + tint while focused.
 */
export function ThemedInput({
  style,
  onFocus,
  onBlur,
  ...rest
}: ThemedInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      keyboardAppearance="dark"
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.input, style, focused && styles.focused]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
  },
  focused: {
    borderColor: "rgba(207,158,255,0.55)",
    backgroundColor: "rgba(207,158,255,0.06)",
  },
});
