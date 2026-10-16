import { useId } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useBlurTargetRef } from "../blur-target";
import { RADIUS, colors, shadow } from "../../theme/theme";

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Defaults to p-6 (24). Pass false for custom padding. */
  padded?: boolean;
  /** Frosted backdrop blur behind the card (needs a BlurTargetView above). */
  glass?: boolean;
}

/**
 * card-sheen: soft lilac wash from the top-right, faint indigo lift from the
 * bottom-left and a hairline of light along the top edge - on top of the
 * mobile glass surface (#0c0c16 + #24242f border).
 */
function CardSheen() {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={`a-${uid}`} cx="100%" cy="0%" r="115%">
          <Stop offset="0" stopColor="#cf9eff" stopOpacity={0.07} />
          <Stop offset="0.58" stopColor="#cf9eff" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`b-${uid}`} cx="0%" cy="100%" r="85%">
          <Stop offset="0" stopColor="#4044cc" stopOpacity={0.08} />
          <Stop offset="0.62" stopColor="#4044cc" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`c-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.04} />
          <Stop offset="0.3" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#a-${uid})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#b-${uid})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#c-${uid})`} />
    </Svg>
  );
}

export function Card({ children, style, padded = true, glass = false }: CardProps) {
  const blurTarget = useBlurTargetRef();

  return (
    <View
      style={[styles.card, glass && styles.cardGlass, padded && styles.padded, style]}
    >
      {glass ? (
        <BlurView
          intensity={34}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget ?? undefined}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <CardSheen />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    ...shadow.card,
  },
  cardGlass: {
    backgroundColor: "rgba(10,10,22,0.55)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  padded: {
    padding: 24,
  },
});
