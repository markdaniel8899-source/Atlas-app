import { View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  color: string;
  opacity?: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
};

const RINGS = [
  { scale: 1, weight: 0.17 },
  { scale: 0.84, weight: 0.19 },
  { scale: 0.68, weight: 0.21 },
  { scale: 0.52, weight: 0.22 },
  { scale: 0.36, weight: 0.23 },
] as const;

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`;
}

export function SoftGlow({ color, opacity = 0.12, radius, style }: Props) {
  const size = radius * 2;

  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}>
      {RINGS.map((ring) => {
        const diameter = size * ring.scale;
        return (
          <View
            key={ring.scale}
            style={{
              position: 'absolute',
              width: diameter,
              height: diameter,
              left: (size - diameter) / 2,
              top: (size - diameter) / 2,
              borderRadius: diameter / 2,
              backgroundColor: withAlpha(color, opacity * ring.weight),
            }}
          />
        );
      })}
    </View>
  );
}
