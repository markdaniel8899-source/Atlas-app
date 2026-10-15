import { CheckCircle2, Info, X, XCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastTone,
} from '@/lib/toast';

const TONE: Record<
  ToastTone,
  { icon: typeof Info; color: string; border: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    color: '#9db4ff',
    border: 'rgba(157,180,255,0.35)',
    bg: 'rgba(157,180,255,0.10)',
  },
  error: {
    icon: XCircle,
    color: '#ff7a7a',
    border: 'rgba(255,122,122,0.35)',
    bg: 'rgba(255,122,122,0.10)',
  },
  info: {
    icon: Info,
    color: '#cf9eff',
    border: 'rgba(207,158,255,0.35)',
    bg: 'rgba(207,158,255,0.10)',
  },
};

function ToastRow({ item }: { item: ToastItem }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-16));
  const tone = TONE[item.tone];
  const Icon = tone.icon;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }] }}
      className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a1a]/95 shadow-card">
      <Pressable
        onPress={() => dismissToast(item.id)}
        accessibilityRole="alert"
        accessibilityLabel={item.title}
        accessibilityHint="Dismiss notification"
        className="flex-row items-start gap-3 px-4 py-3.5">
        <View
          className="mt-0.5 h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: tone.border, backgroundColor: tone.bg }}>
          <Icon size={15} color={tone.color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            allowFontScaling={false}
            className="font-sans-medium text-base leading-[22px] text-white">
            {item.title}
          </Text>
          {item.message ? (
            <Text
              allowFontScaling={false}
              className="mt-0.5 font-sans text-[15px] leading-[21px] text-white/55">
              {item.message}
            </Text>
          ) : null}
        </View>
        <View className="mt-1 h-6 w-6 items-center justify-center">
          <X size={13} color="rgba(255,255,255,0.35)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToasts((next) => {
      if (mountedRef.current) setItems(next);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 z-[90] items-center px-4 pt-3"
      accessibilityLiveRegion="polite">
      <View className="w-full max-w-md gap-2">
        {items.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </View>
    </View>
  );
}
