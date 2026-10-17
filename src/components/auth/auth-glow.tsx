import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Static auth backdrop in the app's own palette: near-black field with an
 * indigo halo at the top, a periwinkle highlight and a deep violet pool at the
 * bottom. Fully static on purpose so nothing re-layouts on keyboard resize.
 */
export function AuthGlow({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <View pointerEvents="none" style={styles.root}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="authHalo" cx="50%" cy="16%" rx="58%" ry="36%">
            <Stop offset="0" stopColor="#4044cc" stopOpacity="0.5" />
            <Stop offset="0.55" stopColor="#3a3ab8" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#3a3ab8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authCore" cx="50%" cy="7%" rx="30%" ry="16%">
            <Stop offset="0" stopColor="#9db4ff" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#9db4ff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authPool" cx="82%" cy="102%" rx="62%" ry="44%">
            <Stop offset="0" stopColor="#3a2a7a" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#3a2a7a" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authMist" cx="12%" cy="72%" rx="42%" ry="32%">
            <Stop offset="0" stopColor="#2a3560" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#2a3560" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="#05060c" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authHalo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authCore)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authPool)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authMist)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#05060c",
  },
});
