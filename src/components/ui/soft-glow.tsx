import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

type Props = {
  color: string;
  opacity?: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
};

export function SoftGlow({ color, opacity = 0.12, radius, style }: Props) {
  const rawId = useId();
  const gid = `glow-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const size = radius * 2;

  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="50%" stopColor={color} stopOpacity={opacity * 0.45} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}
