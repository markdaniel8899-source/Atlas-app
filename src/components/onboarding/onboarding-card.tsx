import { Text, View } from 'react-native';

import { OnboardingVisual, type OnboardingVisualName } from './onboarding-visuals';

export type OnboardingCardData = {
  key: string;
  step: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: OnboardingVisualName;
};

export const ONBOARDING_CARDS: OnboardingCardData[] = [
  {
    key: 'stats',
    step: '01 / 03',
    eyebrow: 'Player stats',
    title: 'Your rank lives on one screen.',
    body: 'Streak, rank badge, XP bar and @handle — the PlayerStats card that opens your dashboard.',
    visual: 'stats',
  },
  {
    key: 'focus',
    step: '02 / 03',
    eyebrow: 'Focus & today',
    title: 'One tap from idle to focus.',
    body: 'Quick-start presets, total focus time and the next topic on deck — the FocusTimer and TodayFocus widgets, thumb-sized.',
    visual: 'focus',
  },
  {
    key: 'heatmap',
    step: '03 / 03',
    eyebrow: 'Activity heatmap',
    title: 'Watch your terrain fill in.',
    body: 'Every session lands on a 53-week heatmap, with total hours stacked across the year.',
    visual: 'heatmap',
  },
];

type Props = {
  card: OnboardingCardData;
  width: number;
};

export function OnboardingCard({ card, width }: Props) {
  return (
    <View style={{ width, flexShrink: 0 }} className="justify-center gap-9 px-7">
      <OnboardingVisual name={card.visual} />

      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <Text
            allowFontScaling={false}
            className="font-mono-medium text-[11px] tracking-[1.6px] text-star">
            {card.step}
          </Text>
          <View className="h-px flex-1 bg-white/[0.12]" />
          <Text
            allowFontScaling={false}
            className="font-mono-medium text-[11px] uppercase tracking-[1.6px] text-white/40">
            {card.eyebrow}
          </Text>
        </View>

        <Text
          allowFontScaling={false}
          className="font-syne-bold text-[30px] leading-[36px] text-white">
          {card.title}
        </Text>

        <Text allowFontScaling={false} className="font-sans text-[16px] leading-[24px] text-body">
          {card.body}
        </Text>
      </View>
    </View>
  );
}
