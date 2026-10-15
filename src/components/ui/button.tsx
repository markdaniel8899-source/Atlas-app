import { useRef } from "react";
import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { colors, fonts } from "../../theme/theme";

interface ButtonProps {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "ghost" | "outline";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Padding / layout override on the pill itself (e.g. px-5 py-2.5). */
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const VARIANT_STYLE = {
  primary: {
    container: { backgroundColor: colors.white },
    text: { color: colors.primaryText },
  },
  ghost: {
    container: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    text: { color: colors.white },
  },
  outline: {
    container: {
      backgroundColor: colors.w02,
      borderWidth: 1,
      borderColor: colors.w15,
    },
    text: { color: colors.white },
  },
} as const;

export function Button({
  label,
  icon,
  variant = "primary",
  onPress,
  style,
  contentStyle,
  textStyle,
  disabled,
  accessibilityLabel,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.95,
      stiffness: 420,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 420,
      damping: 22,
      mass: 1,
      useNativeDriver: true,
    }).start();

  const palette = VARIANT_STYLE[variant];

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.base, palette.container, contentStyle, disabled && styles.disabled]}
      >
        {icon}
        <Text style={[styles.text, palette.text, textStyle]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-start",
  },
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
