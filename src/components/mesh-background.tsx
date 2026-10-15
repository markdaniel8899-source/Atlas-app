import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { colors } from "../theme/theme";

export function MeshBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="meshA" cx="12%" cy="0%" r="55%">
            <Stop offset="0" stopColor="#4044cc" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#4044cc" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="meshB" cx="88%" cy="12%" r="45%">
            <Stop offset="0" stopColor="#cf9eff" stopOpacity="0.10" />
            <Stop offset="1" stopColor="#cf9eff" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="meshC" cx="50%" cy="100%" r="42%">
            <Stop offset="0" stopColor="#0b2246" stopOpacity="0.40" />
            <Stop offset="1" stopColor="#0b2246" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={colors.appBg} />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#meshA)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#meshB)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#meshC)" />
      </Svg>
    </View>
  );
}
