export type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'conqueror';

export const RANK_TIER_KEYS: readonly TierKey[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'conqueror',
];

export interface Tier {
  key: TierKey;
  label: string;
  gradientColors: [string, string];
  pillText: string;
  pillBg: string;
  pillBorder: string;
}

export interface RankStep {
  key: string;
  name: string;
  tier: Tier;
  minXP: number;
  step: number;
  numeral: string;
}

export interface RankData {
  current: RankStep;
  tier: Tier;
  name: string;
  percent: number;
  xpInto: number;
  xpNeed: number;
  xpToNext: number;
  nextRankName: string | null;
}

export const TIERS: Record<TierKey, Tier> = {
  bronze: {
    key: 'bronze',
    label: 'Bronze',
    gradientColors: ['#cd7f32', '#fb923c'],
    pillText: '#fdba74',
    pillBg: 'rgba(251,146,60,0.1)',
    pillBorder: 'rgba(251,146,60,0.4)',
  },
  silver: {
    key: 'silver',
    label: 'Silver',
    gradientColors: ['#71717a', '#d4d4d8'],
    pillText: '#d4d4d8',
    pillBg: 'rgba(161,161,170,0.1)',
    pillBorder: 'rgba(161,161,170,0.4)',
  },
  gold: {
    key: 'gold',
    label: 'Gold',
    gradientColors: ['#eab308', '#ffd700'],
    pillText: '#fde047',
    pillBg: 'rgba(250,204,21,0.1)',
    pillBorder: 'rgba(250,204,21,0.4)',
  },
  platinum: {
    key: 'platinum',
    label: 'Platinum',
    gradientColors: ['#06b6d4', '#67e8f9'],
    pillText: '#67e8f9',
    pillBg: 'rgba(34,211,238,0.1)',
    pillBorder: 'rgba(34,211,238,0.4)',
  },
  diamond: {
    key: 'diamond',
    label: 'Diamond',
    gradientColors: ['#9333ea', '#9370db'],
    pillText: '#d8b4fe',
    pillBg: 'rgba(192,132,252,0.1)',
    pillBorder: 'rgba(192,132,252,0.4)',
  },
  conqueror: {
    key: 'conqueror',
    label: 'Conqueror',
    gradientColors: ['#ff0055', '#ff5500'],
    pillText: '#fda4af',
    pillBg: 'rgba(244,63,94,0.1)',
    pillBorder: 'rgba(244,63,94,0.4)',
  },
};

const NUMERALS = ['I', 'II', 'III', 'IIII'];

export const RANK_THRESHOLDS = [
  { key: 'bronze_1', tier: 'bronze' as TierKey, step: 1, minXP: 0 },
  { key: 'bronze_2', tier: 'bronze' as TierKey, step: 2, minXP: 250 },
  { key: 'bronze_3', tier: 'bronze' as TierKey, step: 3, minXP: 500 },
  { key: 'bronze_4', tier: 'bronze' as TierKey, step: 4, minXP: 750 },
  { key: 'silver_1', tier: 'silver' as TierKey, step: 1, minXP: 1000 },
  { key: 'silver_2', tier: 'silver' as TierKey, step: 2, minXP: 1375 },
  { key: 'silver_3', tier: 'silver' as TierKey, step: 3, minXP: 1750 },
  { key: 'silver_4', tier: 'silver' as TierKey, step: 4, minXP: 2125 },
  { key: 'gold_1', tier: 'gold' as TierKey, step: 1, minXP: 2500 },
  { key: 'gold_2', tier: 'gold' as TierKey, step: 2, minXP: 3125 },
  { key: 'gold_3', tier: 'gold' as TierKey, step: 3, minXP: 3750 },
  { key: 'gold_4', tier: 'gold' as TierKey, step: 4, minXP: 4375 },
  { key: 'platinum_1', tier: 'platinum' as TierKey, step: 1, minXP: 5000 },
  { key: 'platinum_2', tier: 'platinum' as TierKey, step: 2, minXP: 5750 },
  { key: 'platinum_3', tier: 'platinum' as TierKey, step: 3, minXP: 6500 },
  { key: 'platinum_4', tier: 'platinum' as TierKey, step: 4, minXP: 7250 },
  { key: 'diamond_1', tier: 'diamond' as TierKey, step: 1, minXP: 8000 },
  { key: 'diamond_2', tier: 'diamond' as TierKey, step: 2, minXP: 9000 },
  { key: 'diamond_3', tier: 'diamond' as TierKey, step: 3, minXP: 10000 },
  { key: 'diamond_4', tier: 'diamond' as TierKey, step: 4, minXP: 11000 },
  { key: 'conqueror_1', tier: 'conqueror' as TierKey, step: 1, minXP: 12000 },
  { key: 'conqueror_2', tier: 'conqueror' as TierKey, step: 2, minXP: 13000 },
  { key: 'conqueror_3', tier: 'conqueror' as TierKey, step: 3, minXP: 14000 },
  { key: 'conqueror_4', tier: 'conqueror' as TierKey, step: 4, minXP: 15000 },
];

export const RANKS: RankStep[] = RANK_THRESHOLDS.map((t) => ({
  key: t.key,
  name: `${TIERS[t.tier].label} ${NUMERALS[t.step - 1]}`,
  tier: TIERS[t.tier],
  minXP: t.minXP,
  step: t.step,
  numeral: NUMERALS[t.step - 1],
}));

export function getRankFromXP(totalXP: number): RankData {
  const xp = Math.max(0, Math.floor(totalXP));

  let low = 0;
  let high = RANKS.length - 1;
  let currentIdx = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (RANKS[mid].minXP <= xp) {
      currentIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const current = RANKS[currentIdx];
  const next = RANKS[currentIdx + 1] ?? null;

  const xpInto = xp - current.minXP;
  const xpNeed = next ? next.minXP - current.minXP : 0;
  const xpToNext = next ? Math.max(0, next.minXP - xp) : 0;
  const percent = next ? Math.min(100, (xpInto / xpNeed) * 100) : 100;

  return {
    current,
    tier: current.tier,
    name: current.name,
    percent,
    xpInto,
    xpNeed,
    xpToNext,
    nextRankName: next?.name ?? null,
  };
}

export function getRankProgression(): RankStep[] {
  return RANKS;
}
