import { LinearGradient } from 'expo-linear-gradient';
import { View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  className?: string;
};

const FILL = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

export function CardSheen() {
  return (
    <View pointerEvents="none" style={FILL}>
      <LinearGradient
        colors={['rgba(207,158,255,0.07)', 'rgba(207,158,255,0)']}
        locations={[0, 0.58]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.62 }}
        style={FILL}
      />
      <LinearGradient
        colors={['rgba(64,68,204,0)', 'rgba(64,68,204,0.08)']}
        locations={[0.38, 1]}
        start={{ x: 0.4, y: 0.3 }}
        end={{ x: 0, y: 1 }}
        style={FILL}
      />
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.04)',
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.3, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={FILL}
      />
    </View>
  );
}

export function GlassCard({ className = '', children, ...rest }: Props) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-card ${className}`}
      {...rest}>
      <CardSheen />
      {children}
    </View>
  );
}
