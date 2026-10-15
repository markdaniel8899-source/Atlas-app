import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, ease, fonts } from "../theme/theme";

const RING_SIZE = 48;
const RING_RADIUS = 21;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface ScrollProgressIndicatorProps {
  percent: number;
  visible: boolean;
  onPress: () => void;
}

export function ScrollProgressIndicator({
  percent,
  visible,
  onPress,
}: ScrollProgressIndicatorProps) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: ease,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        easing: ease,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered, anim]);

  if (!rendered) return null;

  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          bottom: insets.bottom + 16,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.percentPill}>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scroll back to top"
        onPress={onPress}
        style={({ pressed }) => [styles.ringButton, pressed && styles.pressed]}
      >
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={styles.ring}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={2.5}
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={colors.lilac}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
        <ArrowUp size={20} color={colors.w80} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 16,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  percentPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(3,3,5,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    fontVariant: ["tabular-nums"],
    color: colors.w70,
  },
  ringButton: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: "rgba(3,3,5,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  ring: {
    position: "absolute",
    transform: [{ rotate: "-90deg" }],
  },
});
