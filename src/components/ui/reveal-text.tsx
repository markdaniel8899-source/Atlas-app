import { useEffect, useState, type ComponentProps } from 'react';
import { Animated, Text } from 'react-native';

type Props = ComponentProps<typeof Text> & {
  text: string;
  duration?: number;
};

export function RevealText({ text, duration = 600, ...rest }: Props) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(14));

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(14);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [text, duration, opacity, translateY]);

  return (
    <Animated.Text
      allowFontScaling={false}
      {...rest}
      style={[{ opacity, transform: [{ translateY }] }, rest.style]}>
      {text}
    </Animated.Text>
  );
}
