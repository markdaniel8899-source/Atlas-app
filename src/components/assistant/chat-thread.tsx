import { memo, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Bot, UserRound } from "lucide-react-native";
import type { Turn } from "../../lib/assistant";
import { MOTION } from "../../theme/motion";
import { colors, ease, fonts } from "../../theme/theme";

interface ChatThreadProps {
  turns: Turn[];
  thinking: boolean;
}

function FadeSlideIn({ children }: { children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: MOTION.sheet,
      easing: MOTION.easing,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function TypingDot({ index }: { index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 160),
        Animated.timing(anim, {
          toValue: 1,
          duration: 550,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 550,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.delay((2 - index) * 160),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, index]);

  return (
    <Animated.View
      style={[
        styles.typingDot,
        {
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.25, 1],
          }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function TypingIndicator() {
  return (
    <FadeSlideIn>
      <View style={styles.turnRow}>
        <View style={styles.avatar}>
          <Bot size={16} color={colors.w60} />
        </View>
        <View style={styles.typingBubble}>
          <TypingDot index={0} />
          <TypingDot index={1} />
          <TypingDot index={2} />
        </View>
      </View>
    </FadeSlideIn>
  );
}

const TurnRow = memo(function TurnRow({ turn }: { turn: Turn }) {
  const mine = turn.role === "user";

  return (
    <FadeSlideIn>
      <View style={[styles.turnRow, mine ? styles.turnRowMine : null]}>
        <View style={[styles.avatar, mine ? styles.avatarMine : null]}>
          {mine ? (
            <UserRound size={16} color={colors.lilac} />
          ) : (
            <Bot size={16} color={colors.w60} />
          )}
        </View>

        <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : null]}>
          <View
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleBot]}
          >
            <Text
              style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}
            >
              {turn.content}
            </Text>
          </View>
          {!mine && turn.model ? (
            <Text style={styles.modelLabel}>ATLAS</Text>
          ) : null}
        </View>
      </View>
    </FadeSlideIn>
  );
});

export const ChatThread = memo(function ChatThread({
  turns,
  thinking,
}: ChatThreadProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (turns.length === 0) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [turns.length, thinking]);

  if (turns.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.threadScroll}
      contentContainerStyle={styles.threadContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {turns.map((turn) => (
        <TurnRow key={turn.id} turn={turn} />
      ))}
      {thinking ? <TypingIndicator /> : null}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  threadScroll: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 20,
  },
  turnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  turnRowMine: {
    flexDirection: "row-reverse",
  },
  avatar: {
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w05,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMine: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac12,
  },
  bubbleWrap: {
    flexShrink: 1,
    maxWidth: "82%",
  },
  bubbleWrapMine: {
    alignItems: "flex-end",
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleMine: {
    borderColor: colors.lilac25,
    backgroundColor: colors.lilac12,
    borderBottomRightRadius: 6,
  },
  bubbleBot: {
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: colors.w80,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  modelLabel: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: fonts.mono,
    letterSpacing: -0.2,
    color: colors.w30,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.w10,
    backgroundColor: colors.w04,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.w45,
  },
});
