import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';

interface CurtainController {
  play: (run: () => void) => void;
}

let controller: CurtainController | null = null;

export function doubleCurtainNavigate(run: () => void) {
  if (controller) {
    controller.play(run);
  } else {
    run();
  }
}

const CLOSE_MS = 480;
const OPEN_MS = 620;
const SWAP_HOLD_MS = 170;

export function DoubleCurtainHost() {
  const { width } = useWindowDimensions();
  const panelWidth = Math.ceil(width / 2) + 12;
  const closedLeft = -panelWidth;
  const closedRight = panelWidth;

  const [progress] = useState(() => new Animated.Value(1));
  const [visible, setVisible] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    const play = (run: () => void) => {
      if (runningRef.current) {
        run();
        return;
      }
      runningRef.current = true;
      setVisible(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: CLOSE_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        run();
        setTimeout(() => {
          Animated.timing(progress, {
            toValue: 2,
            duration: OPEN_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            runningRef.current = false;
            setVisible(false);
          });
        }, SWAP_HOLD_MS);
      });
    };
    controller = { play };
    return () => {
      controller = null;
    };
  }, [progress]);

  const leftX = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [closedLeft, 0, closedLeft],
  });
  const rightX = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [closedRight, 0, closedRight],
  });

  if (!visible) return null;

  return (
    <View pointerEvents="none" className="absolute inset-0 z-[100]" accessibilityElementsHidden>
      <Animated.View
        className="absolute inset-y-0 left-0 overflow-hidden border-r border-[#9db4ff]/25"
        style={{ width: panelWidth, transform: [{ translateX: leftX }] }}>
        <LinearGradient
          colors={['#030305', '#0a0a1a', '#0b1026']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View className="absolute inset-y-0 right-0 w-px bg-[#9db4ff]/40" />
      </Animated.View>

      <Animated.View
        className="absolute inset-y-0 right-0 overflow-hidden border-l border-[#cf9eff]/25"
        style={{ width: panelWidth, transform: [{ translateX: rightX }] }}>
        <LinearGradient
          colors={['#0b1026', '#0a0a1a', '#030305']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View className="absolute inset-y-0 left-0 w-px bg-[#cf9eff]/40" />
      </Animated.View>
    </View>
  );
}
