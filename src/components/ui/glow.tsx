import { useId } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

interface GlowProps {
  /** Diameter in px. */
  size: number;
  /** Fully-opaque core color; falls off to transparent. */
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Soft decorative blob — the RN stand-in for a `blur-3xl` coloured disc.
 * Absolutely position it inside a card; the card's overflow clips it.
 */
export function Glow({ size, color, style }: GlowProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`g-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.4" stopColor={color} stopOpacity={0.7} />
            <Stop offset="0.75" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#g-${uid})`} />
      </Svg>
    </View>
  );
}
