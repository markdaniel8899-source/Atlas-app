import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

/**
 * Three slow-drifting colour orbs behind the auth card. Transform-only
 * (native driver) so the JS thread stays free while they loop.
 */
export function AuthOrbs() {
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const loops = [
      loop(driftA, 9000),
      loop(driftB, 13000),
      loop(driftC, 17000),
    ];
    loops.forEach((item) => item.start());
    return () => loops.forEach((item) => item.stop());
  }, [driftA, driftB, driftC]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.orb,
          styles.orbA,
          {
            transform: [
              {
                translateX: driftA.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 26],
                }),
              },
              {
                translateY: driftA.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 32],
                }),
              },
              {
                scale: driftA.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.12],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbB,
          {
            transform: [
              {
                translateX: driftB.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, -28],
                }),
              },
              {
                translateY: driftB.interpolate({
                  inputRange: [0, 1],
                  outputRange: [22, -26],
                }),
              },
              {
                scale: driftB.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.08, 1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbC,
          {
            transform: [
              {
                translateX: driftC.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-22, 30],
                }),
              },
              {
                translateY: driftC.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, -22],
                }),
              },
              {
                scale: driftC.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbA: {
    top: -70,
    left: -90,
    width: 320,
    height: 320,
    backgroundColor: "rgba(64,68,204,0.18)",
  },
  orbB: {
    top: 140,
    right: -80,
    width: 260,
    height: 260,
    backgroundColor: "rgba(207,158,255,0.12)",
  },
  orbC: {
    bottom: -110,
    left: -50,
    width: 340,
    height: 340,
    backgroundColor: "rgba(34,211,238,0.07)",
  },
});
