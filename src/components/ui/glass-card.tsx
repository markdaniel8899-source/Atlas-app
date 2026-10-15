import { View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  className?: string;
};

export function GlassCard({ className = '', children, ...rest }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-card ${className}`}
      {...rest}>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-px bg-white/[0.1]"
      />
      {children}
    </View>
  );
}
