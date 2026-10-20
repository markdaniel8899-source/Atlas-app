import { Image } from "expo-image";
import { StyleSheet } from "react-native";

const MESH = require("../../assets/mesh-bg.png");

/**
 * Opaque copy of the shared mesh behind each tab scene. The root mesh stays
 * visible at rest; this layer exists so a sliding scene carries its own
 * background and never shows the outgoing screen through the gaps.
 */
export function SceneBackdrop() {
  return (
    <Image
      source={MESH}
      style={StyleSheet.absoluteFill}
      contentFit="fill"
      cachePolicy="memory-disk"
      transition={0}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
