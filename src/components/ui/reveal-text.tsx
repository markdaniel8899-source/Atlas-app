import { useEffect, useMemo, useRef } from "react";
import { Animated, View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { ease } from "../../theme/theme";

interface RevealTextProps {
  text: string;
  /** Applied to each word's Text. */
  style?: StyleProp<TextStyle>;
  /** Hold the words hidden before the stagger starts (ms). */
  delay?: number;
  /** Per-word stagger (ms). */
  stagger?: number;
  wordGap?: number;
}

/**
 * Word-by-word entrance: each word rises (~135% of its height) and fades in
 * on the shared ease curve, staggered left to right — the RN port of the
 * dashboard heading reveal.
 */
export function RevealText({
  text,
  style,
  delay = 0,
  stagger = 90,
  wordGap = 8,
}: RevealTextProps) {
  const words = useMemo(() => text.split(" "), [text]);
  const valuesRef = useRef<Animated.Value[]>([]);

  if (valuesRef.current.length !== words.length) {
    valuesRef.current = words.map(() => new Animated.Value(0));
  }
  const values = valuesRef.current;

  useEffect(() => {
    values.forEach((value) => value.setValue(0));
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.stagger(
        stagger,
        values.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 850,
            easing: ease,
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay, stagger]);

  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }}
      accessible
      accessibilityLabel={text}
    >
      {words.map((word, index) => (
        <Animated.View
          key={`${word}-${index}`}
          style={{
            opacity: values[index],
            transform: [
              {
                translateY: values[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [34, 0],
                }),
              },
            ],
            marginRight: index < words.length - 1 ? wordGap : 0,
          }}
        >
          <Animated.Text style={style}>{word}</Animated.Text>
        </Animated.View>
      ))}
    </View>
  );
}
