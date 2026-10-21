import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../../hooks/use-reduced-motion";

const COLORS = [
  "#ff5fa2",
  "#a855f7",
  "#22d3ee",
  "#cf9eff",
  "#fde047",
  "#fb7185",
  "#60a5fa",
];

const COUNT = 34;

interface Piece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotate: number;
  delay: number;
  round: boolean;
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1700,
      delay: piece.delay * 1000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, piece.delay]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: piece.round ? 10 : 7,
        height: piece.round ? 10 : 16,
        borderRadius: piece.round ? 9999 : 3,
        backgroundColor: piece.color,
        shadowColor: piece.color,
        shadowOpacity: 0.5,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
        opacity: progress.interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        }),
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, piece.x],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, piece.y - 60, piece.y + 40],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${piece.rotate}deg`],
            }),
          },
        ],
      }}
    />
  );
}

/** One-shot confetti burst shown when a Boss Level is completed. */
export function BossConfetti() {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: COUNT }, (_, index) => {
        const angle = (index / COUNT) * Math.PI * 2 + (index % 4) * 0.17;
        const distance = 130 + ((index * 53) % 190);
        return {
          id: index,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 80,
          color: COLORS[index % COLORS.length],
          rotate: 180 + ((index * 61) % 360),
          delay: (index % 6) * 0.035,
          round: index % 3 !== 0,
        };
      }),
    [],
  );

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {pieces.map((piece) => (
        <ConfettiPiece key={piece.id} piece={piece} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
