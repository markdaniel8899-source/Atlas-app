import { View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  className?: string;
};

export function GlassCard({ className = '', children, ...rest }: Props) {
  return (
    <View className={`glass overflow-hidden rounded-[28px] ${className}`} {...rest}>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-px bg-white/[0.14]"
      />
      {children}
    </View>
  );
}
