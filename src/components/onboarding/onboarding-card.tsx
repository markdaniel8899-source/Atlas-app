import { Text, View } from 'react-native';

import { OnboardingVisual, type OnboardingVisualName } from './onboarding-visuals';

export type OnboardingCardData = {
  key: string;
  title: string;
  body: string;
  visual: OnboardingVisualName;
};

export const ONBOARDING_CARDS: OnboardingCardData[] = [
  {
    key: 'stats',
    title: 'Own your rank.',
    body: 'Streak, XP and rank badge. Your whole grind on one PlayerStats card.',
    visual: 'stats',
  },
  {
    key: 'focus',
    title: 'Focus in one tap.',
    body: 'Quick-start presets, live timer and today’s topic. Idle to deep work instantly.',
    visual: 'focus',
  },
  {
    key: 'ai',
    title: 'Study smarter with AI.',
    body: 'Stuck on a topic? Ask your built-in AI study buddy and keep the streak alive.',
    visual: 'ai',
  },
  {
    key: 'heatmap',
    title: 'Watch hours stack up.',
    body: 'Every session lands on your 53-week heatmap. One glance, a year of effort.',
    visual: 'heatmap',
  },
  {
    key: 'orbit',
    title: 'Welcome to ATLAS.',
    body: 'Where discipline becomes a leaderboard. Track, focus and level up every day.',
    visual: 'orbit',
  },
];

type Props = {
  card: OnboardingCardData;
  width: number;
  height: number;
};

export function OnboardingCard({ card, width, height }: Props) {
  const heroHeight = Math.round(Math.min(300, Math.max(190, height * 0.32)));

  return (
    <View style={{ width, flexShrink: 0 }} className="justify-center gap-6 px-7 pb-2">
      <OnboardingVisual name={card.visual} height={heroHeight} />

      <View className="shrink gap-3.5">
        <Text
          allowFontScaling={false}
          className="text-center font-syne-bold text-[34px] leading-[40px] text-white">
          {card.title}
        </Text>

        <Text
          allowFontScaling={false}
          className="text-center font-sans-medium text-[17px] leading-[26px] text-body">
          {card.body}
        </Text>
      </View>
    </View>
  );
}
