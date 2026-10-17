import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { HEADER_HEIGHT } from "./app-header";
import { subscribeNetwork } from "../lib/net";
import { fonts } from "../theme/theme";

/** How long the offline pill stays on screen before fading out. */
const VISIBLE_MS = 3000;

/**
 * Floating "offline" pill shown under the header for a few seconds when the
 * device drops offline (ambient notice only - internet-only actions surface
 * their own "You are offline" alerts through ensureOnline).
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hide = () => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    };

    const unsubscribe = subscribeNetwork((online) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (online) {
        hide();
        return;
      }
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        hide();
      }, VISIBLE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [anim]);

  if (!rendered) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { top: insets.top + HEADER_HEIGHT + 6, opacity: anim },
      ]}
    >
      <WifiOff size={13} color="#fda4af" />
      <Text style={styles.text}>You are offline</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(253,164,175,0.35)",
    backgroundColor: "rgba(45,18,28,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 30,
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#fda4af",
  },
});
