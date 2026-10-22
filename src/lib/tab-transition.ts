import { Easing } from "react-native";
import { TAB_TRANSITION, TAB_FADE_MS } from "../theme/motion";

/**
 * Returns screenOptions for the bottom-tabs navigator.
 * - "none": instant swap (default). The drawer close animation is the visible transition.
 * - "fade-through": outgoing fades out in first half, incoming fades in second half.
 *   Opacity only, no transforms, no layout work. Never overlaps (no ghosting).
 */
export function tabTransitionOptions(): {
  animation: "none" | "fade";
  sceneStyleInterpolator?: (props: {
    current: { progress: { interpolate: (config: {
      inputRange: number[];
      outputRange: number[];
      extrapolate: "clamp";
    }) => any } };
  }) => { sceneStyle: { opacity: any } };
  transitionSpec?: {
    animation: "timing";
    config: { duration: number; easing: (t: number) => number };
  };
} {
  if (TAB_TRANSITION === "none") {
    return { animation: "none" };
  }

  // "fade-through": opacity-only crossfade without overlap
  // current.progress goes from -1 (left) -> 0 (focused) -> 1 (right)
  // Outgoing: 0 -> 1 (fade out in first half: 0 to 0.5)
  // Incoming: -1 -> 0 (fade in in second half: -0.5 to 0)
  const sceneStyleInterpolator = ({
    current,
  }: {
    current: {
      progress: {
        interpolate: (config: {
          inputRange: number[];
          outputRange: number[];
          extrapolate: "clamp";
        }) => any;
      };
    };
  }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.5, 0, 0.5, 1],
        outputRange: [0, 0, 1, 0, 0],
        extrapolate: "clamp",
      }),
    },
  });

  return {
    animation: "fade",
    sceneStyleInterpolator,
    transitionSpec: {
      animation: "timing",
      config: {
        duration: TAB_FADE_MS,
        easing: Easing.inOut(Easing.quad),
      },
    },
  };
}