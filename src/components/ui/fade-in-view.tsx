import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { MOTION } from "../../theme/motion";

interface FadeInViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Vertical travel in px; keep it small so lists do not jump. */
  offsetY?: number;
  duration?: number;
  delay?: number;
}

/** Mount entrance for inline menus and panels (opacity + small rise). */
export function FadeInView({
  children,
  style,
  offsetY = 10,
  duration = MOTION.menu,
  delay = 0,
}: FadeInViewProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start();
  }, [anim, delay, duration]);

  return (
    <Animated.View
      style={[
        styles.base,
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [offsetY, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 0,
  },
});
