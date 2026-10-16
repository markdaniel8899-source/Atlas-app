import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

interface BlobSpec {
  id: string;
  color: string;
  opacity: number;
  size: number;
  left: number;
  top: number;
  driftX: [number, number];
  driftY: [number, number];
  scaleTo: number;
  duration: number;
}

const BLOBS: BlobSpec[] = [
  {
    id: "meshBlobA",
    color: "#4b4fe0",
    opacity: 0.32,
    size: 1.35,
    left: -0.42,
    top: -0.3,
    driftX: [-46, 48],
    driftY: [-30, 42],
    scaleTo: 1.16,
    duration: 11000,
  },
  {
    id: "meshBlobB",
    color: "#cf9eff",
    opacity: 0.2,
    size: 1.08,
    left: 0.28,
    top: -0.16,
    driftX: [40, -38],
    driftY: [34, -26],
    scaleTo: 1.12,
    duration: 15000,
  },
  {
    id: "meshBlobC",
    color: "#22d3ee",
    opacity: 0.13,
    size: 1.24,
    left: -0.24,
    top: 0.34,
    driftX: [-36, 44],
    driftY: [28, -34],
    scaleTo: 1.18,
    duration: 19000,
  },
  {
    id: "meshBlobD",
    color: "#9db4ff",
    opacity: 0.17,
    size: 1.02,
    left: 0.26,
    top: 0.4,
    driftX: [34, -40],
    driftY: [-32, 30],
    scaleTo: 1.1,
    duration: 23000,
  },
];

function MeshBlob({ spec, base }: { spec: BlobSpec; base: number }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, spec.duration]);

  const size = base * spec.size;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: base * spec.left,
        top: base * spec.top,
        width: size,
        height: size,
        transform: [
          {
            translateX: drift.interpolate({
              inputRange: [0, 1],
              outputRange: spec.driftX,
            }),
          },
          {
            translateY: drift.interpolate({
              inputRange: [0, 1],
              outputRange: spec.driftY,
            }),
          },
          {
            scale: drift.interpolate({
              inputRange: [0, 1],
              outputRange: [1, spec.scaleTo],
            }),
          },
        ],
      }}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={spec.id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={spec.color} stopOpacity={spec.opacity} />
            <Stop offset="1" stopColor={spec.color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${spec.id})`} />
      </Svg>
    </Animated.View>
  );
}

export function AuthMesh() {
  const { width, height } = useWindowDimensions();
  const base = Math.max(width, height);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BLOBS.map((spec) => (
        <MeshBlob key={spec.id} spec={spec} base={base} />
      ))}
    </View>
  );
}
