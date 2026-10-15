import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/tokens';

type Variant = 'primary' | 'gradient' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  icon?: ReactNode;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  compact = false,
  icon,
}: Props) {
  const isDisabled = disabled || loading;
  const pad = compact ? 'min-h-[52px] px-7' : 'min-h-[60px] px-9';
  const isFilled = variant === 'primary' || variant === 'gradient';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`overflow-hidden rounded-full ${className} ${isDisabled ? 'opacity-50' : ''}`}>
      {({ pressed }) => (
        <View
          className={`${pad} w-full flex-row items-center justify-center gap-2.5 overflow-hidden rounded-full ${
            variant === 'primary' ? 'bg-[#9db4ff]' : ''
          } ${
            variant === 'outline'
              ? 'border border-white/[0.15] bg-white/[0.02]'
              : variant === 'ghost'
                ? 'border border-white/[0.08] bg-white/[0.03]'
                : ''
          } ${pressed ? (isFilled ? 'opacity-90' : 'bg-white/[0.06]') : ''}`}>
          {variant === 'gradient' ? (
            <LinearGradient
              colors={['#9db4ff', '#cf9eff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator color={isFilled ? '#030305' : colors.star} size="small" />
          ) : (
            icon
          )}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            className={`font-sans-semibold text-base ${
              isFilled ? 'text-[#030305]' : 'text-white'
            }`}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
