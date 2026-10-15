import { Sparkle } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { colors } from '@/constants/tokens';

type Props = {
  size?: 'sm' | 'md' | 'lg';
};

const sizes = {
  sm: { star: 13, text: 'text-[15px]', gap: 'gap-1.5', trailing: 3 },
  md: { star: 16, text: 'text-xl', gap: 'gap-2', trailing: 4 },
  lg: { star: 22, text: 'text-3xl', gap: 'gap-2.5', trailing: 6 },
} as const;

export function AtlasWordmark({ size = 'md' }: Props) {
  const config = sizes[size];
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="ATLAS"
      className={`shrink-0 flex-row items-center ${config.gap}`}>
      <Sparkle color={colors.star} size={config.star} strokeWidth={1.75} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        className={`shrink-0 font-syne-bold text-white ${config.text}`}
        style={{
          letterSpacing: config.trailing,
          paddingRight: config.trailing,
        }}>
        ATLAS
      </Text>
    </View>
  );
}
