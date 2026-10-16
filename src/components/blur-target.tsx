import { createContext, useContext } from "react";
import type { RefObject } from "react";
import type { View } from "react-native";

/**
 * Ref of the BlurTargetView wrapping the screen background. On Android the
 * new expo-blur API needs this ref on every BlurView (`blurTarget`) or the
 * blur silently falls back to none.
 */
export const BlurTargetRefContext =
  createContext<RefObject<View | null> | null>(null);

export function useBlurTargetRef(): RefObject<View | null> | null {
  return useContext(BlurTargetRefContext);
}
