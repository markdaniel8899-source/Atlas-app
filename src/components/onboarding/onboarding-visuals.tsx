import { Flame, Timer } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/glass-card';
import { colors } from '@/constants/tokens';

function Eyebrow({ children }: { children: string }) {
  return (
    <Text
      allowFontScaling={false}
      className="font-mono-medium text-[11px] uppercase tracking-[1.6px] text-white/40">
      {children}
    </Text>
  );
}

function StatsVisual() {
  return (
    <GlassCard className="gap-5 p-6">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-lilac/25">
            <Text allowFontScaling={false} className="font-syne-bold text-[15px] text-lilac">
              A
            </Text>
          </View>
          <View>
            <Text allowFontScaling={false} className="font-sans-semibold text-[15px] text-white">
              Alex Rivera
            </Text>
            <Text allowFontScaling={false} className="font-mono text-[12px] text-white/45">
              @alex
            </Text>
          </View>
        </View>
        <View className="rounded-full border border-star/40 bg-star/10 px-3 py-1.5">
          <Text
            allowFontScaling={false}
            className="font-sans-semibold text-[10px] uppercase tracking-[1.2px] text-star">
            Orbit III
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 self-start">
        <Flame color={colors.lilac} size={14} strokeWidth={2} />
        <Text allowFontScaling={false} className="font-sans-medium text-[12px] text-white/70">
          12 day streak
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Eyebrow>XP progress</Eyebrow>
          <Text allowFontScaling={false} className="font-mono text-[12px] text-star">
            680 / 1000
          </Text>
        </View>
        <View className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <View className="h-full w-[68%] flex-row overflow-hidden rounded-full">
            <View className="flex-1 bg-star" />
            <View className="flex-1 bg-lilac" />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const PRESETS = ['25 min', '50 min', '90 min'];

function FocusVisual() {
  return (
    <GlassCard className="gap-5 p-6">
      <View className="flex-row items-center justify-between">
        <Eyebrow>Focus timer</Eyebrow>
        <View className="flex-row items-center gap-1.5">
          <Timer color={colors.star} size={14} strokeWidth={2} />
          <Text allowFontScaling={false} className="font-mono text-[12px] text-star">
            1h 20m today
          </Text>
        </View>
      </View>

      <View className="items-center gap-1 py-1">
        <Text
          allowFontScaling={false}
          className="font-mono-semibold text-[44px] leading-[52px] text-white">
          24:59
        </Text>
        <Text allowFontScaling={false} className="font-sans text-[13px] text-white/50">
          Systems Design · Chapter 4
        </Text>
      </View>

      <View className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <View className="h-full w-[62%] rounded-full bg-star" />
      </View>

      <View className="flex-row gap-2">
        {PRESETS.map((preset, index) => (
          <View
            key={preset}
            className={`flex-1 items-center rounded-full border py-2 ${
              index === 0 ? 'border-transparent bg-star' : 'border-white/[0.12] bg-white/[0.04]'
            }`}>
            <Text
              allowFontScaling={false}
              className={`font-sans-semibold text-[12px] ${
                index === 0 ? 'text-void' : 'text-white/70'
              }`}>
              {preset}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function cellColor(row: number, col: number): string {
  const recent = col > 9 ? 3 : col > 5 ? 1 : 0;
  const seed = (row * 13 + col * 7 + ((row * col) % 5) + recent) % 12;
  if (seed < 3) return 'rgba(255,255,255,0.05)';
  if (seed < 5) return 'rgba(157,180,255,0.22)';
  if (seed < 7) return 'rgba(157,180,255,0.45)';
  if (seed < 9) return 'rgba(157,180,255,0.75)';
  if (seed < 11) return 'rgba(157,180,255,1)';
  return 'rgba(207,158,255,1)';
}

const HEATMAP_ROWS = Array.from({ length: 7 }, (_, row) =>
  Array.from({ length: 14 }, (_, col) => cellColor(row, col)),
);

function HeatmapVisual() {
  return (
    <GlassCard className="gap-4 p-6">
      <View className="flex-row items-center justify-between">
        <Eyebrow>Activity</Eyebrow>
        <Text allowFontScaling={false} className="font-mono text-[12px] text-star">
          128h logged
        </Text>
      </View>

      <View className="gap-1.5">
        {HEATMAP_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-1.5">
            {row.map((color, colIndex) => (
              <View
                key={colIndex}
                className="h-3 flex-1 rounded-[3px]"
                style={{ backgroundColor: color }}
              />
            ))}
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between">
        <Text allowFontScaling={false} className="font-sans text-[11px] text-white/40">
          53 weeks
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text allowFontScaling={false} className="font-sans text-[11px] text-white/40">
            less
          </Text>
          {['rgba(255,255,255,0.05)', 'rgba(157,180,255,0.45)', 'rgba(157,180,255,0.75)', 'rgba(207,158,255,1)'].map(
            (color) => (
              <View key={color} className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
            ),
          )}
          <Text allowFontScaling={false} className="font-sans text-[11px] text-white/40">
            more
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

export type OnboardingVisualName = 'stats' | 'focus' | 'heatmap';

export function OnboardingVisual({ name }: { name: OnboardingVisualName }) {
  if (name === 'stats') return <StatsVisual />;
  if (name === 'focus') return <FocusVisual />;
  return <HeatmapVisual />;
}
