import { Sparkle } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { colors } from '@/constants/tokens';

type Props = {
  size?: 'sm' | 'md' | 'lg';
};

const sizes = {
  sm: { star: 13, text: 'text-sm', gap: 'gap-1.5' },
  md: { star: 16, text: 'text-xl', gap: 'gap-2' },
  lg: { star: 22, text: 'text-3xl', gap: 'gap-2.5' },
} as const;

export function AtlasWordmark({ size = 'md' }: Props) {
  const config = sizes[size];
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="ATLAS"
      className={`flex-row items-center ${config.gap}`}>
      <Sparkle color={colors.star} size={config.star} strokeWidth={1.75} />
      <Text
        className={`font-syne-bold text-white ${config.text} tracking-[4px]`}
        allowFontScaling={false}>
        ATLAS
      </Text>
    </View>
  );
}
