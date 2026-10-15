import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

type Props = {
  percent: number;
  colors: [string, string, ...string[]];
  height?: number;
  glow?: string;
  trackColor?: string;
  className?: string;
};

export function ProgressBar({
  percent,
  colors,
  height = 10,
  glow,
  trackColor = 'rgba(255,255,255,0.06)',
  className = '',
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const target = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: target,
      duration: target > 0 ? 900 : 0,
      useNativeDriver: false,
    }).start();
  }, [target, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [0, trackWidth],
  });

  return (
    <View
      className={`h-2.5 overflow-hidden rounded-full ${className}`}
      style={{ height, backgroundColor: trackColor }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={{ width: fillWidth, height: '100%' }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flex: 1,
            borderRadius: height / 2,
            ...(glow ? { boxShadow: `0px 0px 18px 0px ${glow}` } : {}),
          }}
        />
      </Animated.View>
    </View>
  );
}
