import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { MOTION } from "../../theme/motion";

/**
 * Keeps a Modal mounted until its exit animation finishes, mirroring the
 * rendered/opening/closing pattern used by the dialog components.
 */
export function useModalTransition(visible: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const opening = useRef(false);

  useEffect(() => {
    if (visible) {
      if (!rendered) {
        setRendered(true);
        return;
      }
      if (opening.current) return;
      opening.current = true;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 1,
        duration: MOTION.menu,
        easing: MOTION.easing,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      opening.current = false;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 0,
        duration: MOTION.menuClose,
        easing: MOTION.easingExit,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered, anim]);

  return { rendered, anim };
}

type Placement = "center" | "bottom" | "none";

/**
 * Panel motion shared by the converted modals: a short rise + scale for
 * centered sheets, a slightly longer rise for bottom sheets. Opacity is part
 * of every variant so the panel never flashes before the first frame.
 */
export function modalPanelStyle(
  anim: Animated.Value,
  placement: Placement = "center",
) {
  if (placement === "none") {
    return { opacity: anim };
  }

  const bottom = placement === "bottom";
  return {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [bottom ? 56 : 18, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [bottom ? 0.99 : 0.96, 1],
        }),
      },
    ],
  };
}
