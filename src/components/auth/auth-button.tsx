import { useRef } from "react";
import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "../../theme/theme";

interface AuthButtonProps {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
}

/** Primary lilac gradient CTA shared by the auth screens. */
export function AuthButton({
  label,
  icon,
  disabled,
  onPress,
}: AuthButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
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

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ scale }] },
        disabled && styles.disabled,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <LinearGradient
          colors={["#b394ff", "#8262ef", "#6446d6"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {icon}
          <Text style={styles.text} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 26,
    paddingVertical: 16,
  },
  text: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
});
