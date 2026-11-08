import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { MOTION } from "../../theme/motion";

/**
 * Drives the entrance animation of a native `Modal`.
 *
 * Android creates the modal window a few frames after `visible` flips, so an
 * animation started on mount spends its first frames while the window is still
 * being attached - the panel looks like it snaps in, while the close (window
 * already alive) stays smooth. `onShow` is the reliable "window is attached"
 * signal; the timer is only a fallback for platforms that skip it.
 */
export function useModalEntrance(
  anim: Animated.Value,
  visible: boolean,
  rendered: boolean,
  duration: number = MOTION.menu,
): () => void {
  const opening = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const wasVisible = useRef(visible);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    if (!visibleRef.current || opening.current) return;
    opening.current = true;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start();
  }, [anim, clearTimer, duration]);

  useEffect(() => {
    const reopening = visible && !wasVisible.current && rendered;
    wasVisible.current = visible;
    if (!visible) {
      clearTimer();
      opening.current = false;
      return;
    }
    if (!rendered) {
      clearTimer();
      return;
    }
    if (opening.current) return;
    clearTimer();
    // Re-opening while the window is still attached (close animation not done
    // yet): the modal is already on screen, so start right away.
    if (reopening) {
      start();
      return;
    }
    timer.current = setTimeout(start, 140);
    return clearTimer;
  }, [visible, rendered, start, clearTimer]);

  return start;
}

/**
 * Keeps a Modal mounted until its exit animation finishes, mirroring the
 * rendered/opening/closing pattern used by the dialog components.
 */
export function useModalTransition(visible: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const onShow = useModalEntrance(anim, visible, rendered);

  useEffect(() => {
    if (visible) {
      if (!rendered) setRendered(true);
      return;
    }
    if (!rendered) return;
    anim.stopAnimation();
    Animated.timing(anim, {
      toValue: 0,
      duration: MOTION.menuClose,
      easing: MOTION.easingExit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible, rendered, anim]);

  return { rendered, anim, onShow };
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
