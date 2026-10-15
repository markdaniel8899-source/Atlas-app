import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/constants/tokens';

export function MeshBackground() {
  return (
    <View className="absolute inset-0 bg-void">
      <LinearGradient
        colors={[colors.void, colors.ink, colors.midnight]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={['rgba(64,68,204,0.20)', 'rgba(64,68,204,0)']}
        locations={[0, 0.7]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.95, y: 0.75 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <LinearGradient
        colors={[
          'rgba(207,158,255,0)',
          'rgba(207,158,255,0.10)',
          'rgba(207,158,255,0)',
        ]}
        locations={[0.05, 0.28, 0.65]}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 1, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['rgba(11,34,70,0)', 'rgba(11,34,70,0.40)']}
        locations={[0.35, 1]}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}
