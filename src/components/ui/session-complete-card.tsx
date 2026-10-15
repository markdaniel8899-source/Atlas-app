import { Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import { SoftGlow } from '@/components/ui/soft-glow';

type Props = {
  minutes: number;
  message: string;
  onDismiss: () => void;
};

export function SessionCompleteCard({ minutes, message, onDismiss }: Props) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(24));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }] }}
      className="absolute inset-x-5 bottom-6 z-[80]">
      <View className="relative overflow-hidden rounded-3xl border border-[#9db4ff]/25 bg-[#0a0a1a]/95 shadow-atlas-glow">
        <SoftGlow color="#cf9eff" opacity={0.22} radius={120} style={{ top: -80, right: -40 }} />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="alert"
          accessibilityLabel={`Session complete. ${message}`}
          className="flex-row items-center gap-4 px-5 py-4">
          <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#9db4ff]/35 bg-[#9db4ff]/10">
            <Sparkles size={20} color="#9db4ff" />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              allowFontScaling={false}
              className="font-syne-semibold text-base tracking-[-0.02em] text-white">
              Session complete
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-0.5 font-sans text-[15px] leading-[20px] text-white/60">
              {message}
            </Text>
            <Text
              allowFontScaling={false}
              className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[#9db4ff]">
              {minutes} min · +{minutes} XP
            </Text>
          </View>
          <View className="h-8 w-8 items-center justify-center">
            <X size={14} color="rgba(255,255,255,0.4)" />
          </View>
        </Pressable>

        <View className="h-1 w-full bg-white/[0.06]">
          <View className="h-full w-full bg-gradient-to-r from-[#9db4ff] to-[#cf9eff]" />
        </View>
      </View>
    </Animated.View>
  );
}
