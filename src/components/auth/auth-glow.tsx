import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Static auth backdrop in the app's own palette: near-black field with a
 * violet halo bleeding from the top, a soft lilac highlight and a deep
 * violet pool at the bottom corner. Fully static on purpose so nothing
 * re-layouts on keyboard resize.
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
          <RadialGradient id="authHalo" cx="50%" cy="12%" rx="66%" ry="40%">
            <Stop offset="0" stopColor="#7c5cf0" stopOpacity="0.42" />
            <Stop offset="0.5" stopColor="#5b3fd0" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#5b3fd0" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authCore" cx="50%" cy="4%" rx="34%" ry="18%">
            <Stop offset="0" stopColor="#e3ccff" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#e3ccff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authPool" cx="84%" cy="104%" rx="66%" ry="48%">
            <Stop offset="0" stopColor="#3a2a7a" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#3a2a7a" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authMist" cx="10%" cy="68%" rx="46%" ry="36%">
            <Stop offset="0" stopColor="#2a3560" stopOpacity="0.3" />
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
