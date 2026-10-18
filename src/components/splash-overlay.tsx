import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

const BACKGROUND = require("../../assets/splash-bg.png");
const LOCKUP = require("../../assets/splash-lockup.png");

const ENTER_MS = 420;
const LIFT_MS = 380;
const HOLD_MS = 650;
const EXIT_MS = 520;

/**
 * Branded launch splash drawn above the navigator. The native splash (same
 * flat base color + lockup) fades straight into this overlay; the glow blooms
 * in, then the whole scene zooms up and fades out with an ease-out curve.
 */
export function SplashOverlay() {
  const [done, setDone] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(glow, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 1,
        duration: LIFT_MS,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 1,
        duration: EXIT_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setDone(true);
      });
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [glow, lift, exit]);

  if (done) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: exit.interpolate({
            inputRange: [0, 0.7, 1],
            outputRange: [1, 1, 0],
          }),
          transform: [
            {
              scale: exit.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.09],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.Image
        source={BACKGROUND}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { opacity: glow }]}
      />
      <Animated.View
        style={[
          styles.lockup,
          {
            opacity: lift,
            transform: [
              {
                translateY: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Image source={LOCKUP} resizeMode="contain" style={styles.lockupImage} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030305",
  },
  lockup: {
    width: 260,
    height: 260,
  },
  lockupImage: {
    width: "100%",
    height: "100%",
  },
});
