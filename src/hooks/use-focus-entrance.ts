import { useCallback, useRef } from "react";
import { Animated } from "react-native";
import { useFocusEffect } from "expo-router";
import { consumeDrawerNavigation } from "../lib/nav-source";
import { MOTION } from "../theme/motion";

/**
 * Fades a section in when it gains focus. Opacity-only on the native driver:
 * the outgoing screen is replaced instantly, so nothing heavy is composited
 * and no layout work runs per frame.
 *
 * Drawer switches skip the fade because the closing panel + scrim already
 * reveal the destination; direct navigation gets a short clean fade so it
 * never hard-cuts.
 */
export function useFocusEntrance() {
  const progress = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      progress.stopAnimation();
      if (consumeDrawerNavigation()) {
        progress.setValue(1);
        return;
      }
      progress.setValue(0);
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: MOTION.section,
        easing: MOTION.easing,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [progress]),
  );

  return progress;
}
