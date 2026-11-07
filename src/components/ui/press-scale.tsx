import { useRef } from "react";
import { Animated, Pressable } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { MOTION } from "../../theme/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Compress factor while pressed; 1 disables the effect. */
  scaleTo?: number;
}

/** Pressable with a native-driver scale feedback for menu rows/links. */
export function PressScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressScaleProps) {
  const anim = useRef(new Animated.Value(0)).current;

  const run = (toValue: number) => {
    Animated.timing(anim, {
      toValue,
      duration: toValue ? MOTION.pressIn : MOTION.pressOut,
      easing: toValue ? MOTION.easing : MOTION.easingExit,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        run(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        run(0);
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, scaleTo],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
