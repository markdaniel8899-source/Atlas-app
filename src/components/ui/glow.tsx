import { useId } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

interface GlowProps {
  /** Diameter in px. */
  size: number;
  /** Solid hex core color; alpha comes from `opacity`. */
  color: string;
  /** Peak opacity of the glow (0-1). */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Soft decorative blob - the RN stand-in for a `blur-3xl` coloured disc.
 * Absolutely position it inside a card; the card's overflow clips it.
 * NOTE: always pass a hex color + numeric opacity - rgba() strings in
 * stopColor render too strong on Android.
 */
export function Glow({ size, color, opacity = 1, style }: GlowProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`g-${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.7} />
            <Stop offset="0.78" stopColor={color} stopOpacity={opacity * 0.26} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#g-${uid})`} />
      </Svg>
    </View>
  );
}
