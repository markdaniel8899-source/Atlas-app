import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";

const LOCKUP = require("../../assets/splash-lockup.png");

const MAX_HOLD_MS = 650;
const EXIT_MS = 450;

/**
 * Branded launch splash drawn above the navigator. It shows the exact same
 * lockup as the native splash (same image width, same flat base color), so
 * the native splash fades into it without any visible step. It leaves as soon
 * as fonts and the first session resolution are ready - never later than
 * 650 ms - then fades out to reveal the app (no gradient, no zoom).
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const [done, setDone] = useState(false);
  const exit = useRef(new Animated.Value(0)).current;
  const exiting = useRef(false);

  const startExit = useCallback(() => {
    if (exiting.current) return;
    exiting.current = true;
    Animated.timing(exit, {
      toValue: 1,
      duration: EXIT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDone(true);
    });
  }, [exit]);

  useEffect(() => {
    if (ready) {
      startExit();
      return;
    }
    const timer = setTimeout(startExit, MAX_HOLD_MS);
    return () => clearTimeout(timer);
  }, [ready, startExit]);

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
