import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/tokens';

type Variant = 'primary' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`h-14 overflow-hidden rounded-full ${className} ${
        isDisabled ? 'opacity-50' : ''
      }`}>
      {({ pressed }) =>
        variant === 'primary' ? (
          <View className="flex-1">
            <LinearGradient
              colors={
                pressed
                  ? [colors.lilac, colors.star]
                  : [colors.star, colors.lilac]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <View className="flex-1 flex-row items-center justify-center gap-2">
              {loading && <ActivityIndicator color={colors.void} size="small" />}
              <Text
                allowFontScaling={false}
                className="font-sans-semibold text-base text-void">
                {label}
              </Text>
            </View>
          </View>
        ) : (
          <View
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full ${
              variant === 'outline'
                ? 'border border-white/[0.16] bg-white/[0.04]'
                : 'bg-transparent'
            }`}>
            {loading && <ActivityIndicator color={colors.star} size="small" />}
            <Text
              allowFontScaling={false}
              className="font-sans-semibold text-base text-white">
              {label}
            </Text>
          </View>
        )
      }
    </Pressable>
  );
}
