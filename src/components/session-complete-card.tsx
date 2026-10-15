import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, X } from "lucide-react-native";
import { useTimer } from "../context/timer-context";
import { colors, ease, fonts } from "../theme/theme";

/**
 * Bottom "Session Complete!" card shown when a focus session hits its
 * target. Auto-hides after 8 seconds (handled in TimerContext) or on close.
 */
export function SessionCompleteCard() {
  const { showCompletionCard, dismissCompletionCard } = useTimer();
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(showCompletionCard);
  const anim = useRef(new Animated.Value(showCompletionCard ? 1 : 0)).current;

  useEffect(() => {
    if (showCompletionCard) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: ease,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: ease,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [showCompletionCard, rendered, anim]);

  if (!rendered) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        {
          bottom: insets.bottom + 24,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <CheckCircle2 size={20} color={colors.lilac} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Session Complete!</Text>
          <Text style={styles.message}>
            Great job! Your focus session has ended.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close notification"
          onPress={dismissCompletionCard}
          hitSlop={8}
          style={styles.close}
        >
          <X size={16} color={colors.w50} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    right: 24,
    zIndex: 60,
    width: 320,
    maxWidth: "86%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w20,
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.w20,
    backgroundColor: colors.w10,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  message: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.w70,
  },
  close: {
    margin: -4,
    padding: 4,
  },
});
