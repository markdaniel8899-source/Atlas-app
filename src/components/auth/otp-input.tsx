import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../../theme/theme";

const LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  error?: boolean;
}

/**
 * Six single-digit boxes backed by one hidden TextInput, so paste, backspace
 * and the OS one-time-code autofill all behave like a native code field.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  autoFocus,
  error,
}: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split("");

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, LENGTH);
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={styles.row}
      accessibilityLabel="Verification code"
    >
      {Array.from({ length: LENGTH }).map((_, index) => {
        const digit = digits[index] ?? "";
        const active =
          focused &&
          (value.length === index ||
            (value.length === LENGTH && index === LENGTH - 1));
        return (
          <View
            key={index}
            style={[
              styles.box,
              digit ? styles.boxFilled : null,
              active ? styles.boxActive : null,
              error ? styles.boxError : null,
            ]}
          >
            <Text style={styles.digit}>{digit}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: {
    backgroundColor: colors.w06,
    borderColor: colors.w20,
  },
  boxActive: {
    borderColor: "rgba(207,158,255,0.65)",
    backgroundColor: "rgba(207,158,255,0.08)",
  },
  boxError: {
    borderColor: "rgba(248,113,113,0.55)",
  },
  digit: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fonts.monoMedium,
    color: colors.white,
  },
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },
});
