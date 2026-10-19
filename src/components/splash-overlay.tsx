import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

const LOCKUP = require("../../assets/splash-lockup.png");

const HOLD_MS = 650;
const EXIT_MS = 450;

/**
 * Branded launch splash drawn above the navigator. It shows the exact same
 * lockup as the native splash (same image width, same flat base color), so
 * the native splash fades into it without any visible step; after a short
 * hold the whole scene fades out to reveal the app - no gradient, no zoom.
 */
export function SplashOverlay() {
  const [done, setDone] = useState(false);
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 1,
        duration: EXIT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setDone(true);
      });
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [exit]);

  if (done) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: exit.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
        },
      ]}
    >
      <Image source={LOCKUP} resizeMode="contain" style={styles.lockup} />
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
    width: 200,
    height: 200,
  },
});
