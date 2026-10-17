import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Static auth backdrop in the reference "Floxly" theme: a deep navy field with
 * a large blue halo at the top and a soft deep-blue pool at the bottom. Fully
 * static on purpose - the glass card above it only re-captures its blur once.
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
          <RadialGradient id="authHalo" cx="50%" cy="14%" rx="58%" ry="34%">
            <Stop offset="0" stopColor="#3f7bf7" stopOpacity="0.52" />
            <Stop offset="0.55" stopColor="#2c5ce0" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#2c5ce0" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authCore" cx="50%" cy="6%" rx="30%" ry="15%">
            <Stop offset="0" stopColor="#a8dcff" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#a8dcff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authPool" cx="82%" cy="102%" rx="60%" ry="42%">
            <Stop offset="0" stopColor="#123a7c" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#123a7c" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="authMist" cx="12%" cy="72%" rx="40%" ry="30%">
            <Stop offset="0" stopColor="#26356e" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#26356e" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="#050b1c" />
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
    backgroundColor: "#050b1c",
  },
});
