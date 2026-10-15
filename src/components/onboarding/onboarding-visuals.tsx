import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity,
  Bot,
  Calendar,
  Flame,
  Lightbulb,
  Moon,
  Play,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/tokens';

type GradientPair = readonly [string, string];

type BadgeSpec = {
  Icon: LucideIcon;
  gradient: GradientPair;
  style: StyleProp<ViewStyle>;
};

const BADGE_STAR: GradientPair = ['#9db4ff', '#5b7cff'];
const BADGE_LILAC: GradientPair = ['#cf9eff', '#8f5bff'];

const BADGE_BASE =
  'absolute h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border border-white/20';

function FloatBadge({ Icon, gradient, style }: BadgeSpec) {
  return (
    <View className={BADGE_BASE} style={style}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon color="#ffffff" size={18} strokeWidth={2.25} />
    </View>
  );
}

function Chip({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  accent: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-2xl border border-white/[0.14] bg-black/50 px-3 py-2.5">
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accent}33` }}>
        <Icon color={accent} size={15} strokeWidth={2.25} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          allowFontScaling={false}
          className="font-mono text-[10px] uppercase tracking-[1.4px] text-star">
          {label}
        </Text>
        <Text allowFontScaling={false} className="font-sans-semibold text-[13px] text-white">
          {value}
        </Text>
      </View>
    </View>
  );
}

function HeroStage({
  height,
  badges,
  source,
  chip,
}: {
  height: number;
  badges: BadgeSpec[];
  source: ImageSource;
  chip: ReactNode;
}) {
  return (
    <View className="relative w-full items-center justify-center" style={{ height }}>
      <View className="absolute inset-0 items-center justify-center">
        <View
          className="h-[248px] w-[196px] overflow-hidden rounded-[36px] border border-lilac/25"
          style={{ transform: [{ rotate: '-9deg' }] }}>
          <LinearGradient
            colors={['rgba(207,158,255,0.40)', 'rgba(207,158,255,0.06)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
      <View className="absolute inset-0 items-center justify-center">
        <View
          className="h-[252px] w-[204px] overflow-hidden rounded-[36px] border border-star/25"
          style={{ transform: [{ rotate: '8deg' }] }}>
          <LinearGradient
            colors={['rgba(157,180,255,0.38)', 'rgba(11,34,70,0.55)']}
            start={{ x: 0.9, y: 0 }}
            end={{ x: 0.1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      <View
        className="w-[240px] overflow-hidden rounded-[34px] border border-white/[0.14] bg-surface shadow-card"
        style={{ height: height - 16 }}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View className="absolute inset-0 bg-[#0b1026]/40" pointerEvents="none" />
        <LinearGradient
          colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.55)', 'rgba(3,3,5,0.93)']}
          locations={[0.3, 0.66, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5">{chip}</View>
      </View>

      {badges.map((badge, i) => (
        <FloatBadge key={i} {...badge} />
      ))}
    </View>
  );
}

const ORBIT_NODES: { source: ImageSource }[] = [
  { source: require('../../../assets/onboarding/stats.jpg') },
  { source: require('../../../assets/onboarding/focus.jpg') },
  { source: require('../../../assets/onboarding/heatmap.jpg') },
  { source: require('../../../assets/onboarding/ai.jpg') },
];

function OrbitHero({ height }: { height: number }) {
  const outer = Math.min(276, height - 16);
  const inner = Math.round(outer * 0.72);
  const center = Math.round(outer * 0.41);
  const node = Math.round(outer * 0.2);
  const offset = Math.round(outer * 0.27);

  return (
    <View className="relative w-full items-center justify-center" style={{ height }}>
      <View
        className="absolute rounded-full border border-white/[0.08]"
        style={{ width: outer, height: outer }}
      />
      <View
        className="absolute rounded-full border border-white/[0.14]"
        style={{ width: inner, height: inner }}
      />

      <View
        className="items-center justify-center overflow-hidden rounded-full border-2 border-star/50 shadow-atlas-glow"
        style={{ width: center, height: center }}>
        <LinearGradient
          colors={['rgba(157,180,255,0.35)', 'rgba(207,158,255,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Sparkles color={colors.star} size={Math.round(center * 0.36)} strokeWidth={1.5} />
      </View>

      {ORBIT_NODES.map(({ source }, index) => {
        const angle = (Math.PI / 4) * (1 + index * 2);
        const tx = Math.round(Math.cos(angle) * offset);
        const ty = Math.round(Math.sin(angle) * offset);
        return (
          <View
            key={index}
            className="absolute inset-0 items-center justify-center"
            style={{ transform: [{ translateX: tx }, { translateY: ty }] }}>
            <View
              className="overflow-hidden rounded-full border border-white/25 bg-surface shadow-card"
              style={{ width: node, height: node }}>
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          </View>
        );
      })}

      <FloatBadge Icon={Sparkles} gradient={BADGE_LILAC} style={{ top: '5%', left: '16%' }} />
      <FloatBadge Icon={Zap} gradient={BADGE_STAR} style={{ top: '32%', right: '8%' }} />
      <FloatBadge Icon={Flame} gradient={BADGE_STAR} style={{ bottom: '10%', left: '12%' }} />
    </View>
  );
}

export type OnboardingVisualName = 'stats' | 'focus' | 'heatmap' | 'ai' | 'orbit';

export function OnboardingVisual({ name, height }: { name: OnboardingVisualName; height: number }) {
  if (name === 'stats') {
    return (
      <HeroStage
        height={height}
        source={require('../../../assets/onboarding/stats.jpg')}
        chip={
          <Chip
            label="Active rank"
            value="Orbit III · 12 day streak"
            Icon={Trophy}
            accent={colors.star}
          />
        }
        badges={[
          { Icon: Sparkles, gradient: BADGE_LILAC, style: { top: '3%', right: '13%' } },
          { Icon: Trophy, gradient: BADGE_STAR, style: { top: '38%', left: '9%' } },
          { Icon: Flame, gradient: BADGE_STAR, style: { bottom: '12%', right: '18%' } },
        ]}
      />
    );
  }

  if (name === 'focus') {
    return (
      <HeroStage
        height={height}
        source={require('../../../assets/onboarding/focus.jpg')}
        chip={
          <Chip
            label="Focus session"
            value="24:59 · Systems Design"
            Icon={Timer}
            accent={colors.lilac}
          />
        }
        badges={[
          { Icon: Timer, gradient: BADGE_STAR, style: { top: '4%', left: '12%' } },
          { Icon: Play, gradient: BADGE_LILAC, style: { top: '34%', right: '8%' } },
          { Icon: Moon, gradient: BADGE_STAR, style: { bottom: '14%', left: '16%' } },
        ]}
      />
    );
  }

  if (name === 'heatmap') {
    return (
      <HeroStage
        height={height}
        source={require('../../../assets/onboarding/heatmap.jpg')}
        chip={
          <Chip
            label="This year"
            value="128h logged · 53 weeks"
            Icon={Activity}
            accent={colors.star}
          />
        }
        badges={[
          { Icon: Calendar, gradient: BADGE_LILAC, style: { top: '3%', right: '14%' } },
          { Icon: Activity, gradient: BADGE_STAR, style: { top: '40%', left: '8%' } },
          { Icon: TrendingUp, gradient: BADGE_LILAC, style: { bottom: '13%', right: '17%' } },
        ]}
      />
    );
  }

  if (name === 'ai') {
    return (
      <HeroStage
        height={height}
        source={require('../../../assets/onboarding/ai.jpg')}
        chip={
          <Chip
            label="ATLAS AI"
            value="Online · Ask anything"
            Icon={Sparkles}
            accent={colors.lilac}
          />
        }
        badges={[
          { Icon: Lightbulb, gradient: BADGE_LILAC, style: { top: '4%', right: '12%' } },
          { Icon: Bot, gradient: BADGE_STAR, style: { top: '36%', left: '9%' } },
          { Icon: Zap, gradient: BADGE_STAR, style: { bottom: '10%', right: '22%' } },
        ]}
      />
    );
  }

  return <OrbitHero height={height} />;
}
