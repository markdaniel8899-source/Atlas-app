import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { colors } from '@/constants/tokens';

export function MeshBackground() {
  return (
    <View className="absolute inset-0 bg-void">
      <LinearGradient
        colors={[colors.void, colors.ink, colors.midnight]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <LinearGradient
        colors={[colors.star, 'rgba(157,180,255,0)']}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, opacity: 0.22 }}
      />
      <LinearGradient
        colors={['rgba(207,158,255,0)', colors.lilac]}
        locations={[0, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320, opacity: 0.16 }}
      />
    </View>
  );
}
