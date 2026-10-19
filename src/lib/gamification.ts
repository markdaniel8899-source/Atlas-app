/**
 * Atlas Ranks - minimalist geometric rank system.
 * 6 ranks x 4 tiers = 24 ranks total:
 *   Bronze (hexagon, copper)   · Silver (circle, silver)
 *   Gold (shield, gold)        · Platinum (rhombus, cyan)
 *   Diamond (gem, violet)      · Conqueror (starburst, red-pink, pulsing)
 * Ranks are computed client-side from lifetime XP (profiles.xp); nothing
 * is stored in the database. Tiers use Roman numerals I, II, III, IIII.
 */

export type TierKey =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "conqueror";

/** Display/iteration order, weakest to strongest. */
export const RANK_TIER_KEYS: readonly TierKey[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "conqueror",
];

export interface Tier {
  key: TierKey;
  label: string;
  /** Text color */
  text: string;
  /** Border color */
  border: string;
  /** Background color */
  bg: string;
  /** Progress bar gradient [from, to] */
  gradient: readonly [string, string];
}

export interface RankStep {
  /** Unique key like "bronze_1" */
  key: string;
  /** Display name like "Bronze I" */
  name: string;
  /** Tier this step belongs to */
  tier: Tier;
  /** XP required to enter this rank (cumulative) */
  minXP: number;
  /** Step within tier (1-4) */
  step: number;
  /** Roman numeral (I, II, III, IIII) */
  numeral: string;
}

export interface RankData {
  current: RankStep;
  tier: Tier;
  name: string;
  /** Progress within current rank (0-100) */
  percent: number;
  /** XP into current rank */
  xpInto: number;
  /** XP needed for current rank */
  xpNeed: number;
  /** XP remaining to next rank */
  xpToNext: number;
  /** Next rank name, or null if max rank */
  nextRankName: string | null;
}

/** Tier color definitions (concrete RN colors). */
export const TIERS: Record<TierKey, Tier> = {
  bronze: {
    key: "bronze",
    label: "Bronze",
    text: "#fdba74",
    border: "rgba(249,115,22,0.4)",
    bg: "rgba(249,115,22,0.10)",
    gradient: ["#cd7f32", "#fb923c"],
  },
  silver: {
    key: "silver",
    label: "Silver",
    text: "#d4d4d8",
    border: "rgba(161,161,170,0.4)",
    bg: "rgba(161,161,170,0.10)",
    gradient: ["#71717a", "#d4d4d8"],
  },
  gold: {
    key: "gold",
    label: "Gold",
    text: "#fde047",
    border: "rgba(250,204,21,0.4)",
    bg: "rgba(250,204,21,0.10)",
    gradient: ["#eab308", "#ffd700"],
  },
  platinum: {
    key: "platinum",
    label: "Platinum",
    text: "#67e8f9",
    border: "rgba(34,211,238,0.4)",
    bg: "rgba(34,211,238,0.10)",
    gradient: ["#06b6d4", "#67e8f9"],
  },
  diamond: {
    key: "diamond",
    label: "Diamond",
    text: "#d8b4fe",
    border: "rgba(192,132,252,0.4)",
    bg: "rgba(192,132,252,0.10)",
    gradient: ["#9333ea", "#9370db"],
  },
  conqueror: {
    key: "conqueror",
    label: "Conqueror",
    text: "#fda4af",
    border: "rgba(244,63,94,0.4)",
    bg: "rgba(244,63,94,0.10)",
    gradient: ["#ff0055", "#ff5500"],
  },
};

/** Roman numerals for tiers 1-4 (IIII, not IV) */
const NUMERALS = ["I", "II", "III", "IIII"];

/**
 * Cumulative XP thresholds for each of the 24 ranks.
 * Band widths: Bronze 0-1000, Silver 1000-2500, Gold 2500-5000,
 * Platinum 5000-8000, Diamond 8000-12000, Conqueror 12000+.
 * Tiers subdivide each band evenly.
 */
export const RANK_THRESHOLDS = [
  // Bronze: 0 - 1000 XP
  { key: "bronze_1", tier: "bronze" as TierKey, step: 1, minXP: 0 },
  { key: "bronze_2", tier: "bronze" as TierKey, step: 2, minXP: 250 },
  { key: "bronze_3", tier: "bronze" as TierKey, step: 3, minXP: 500 },
  { key: "bronze_4", tier: "bronze" as TierKey, step: 4, minXP: 750 },
  // Silver: 1000 - 2500 XP
  { key: "silver_1", tier: "silver" as TierKey, step: 1, minXP: 1000 },
  { key: "silver_2", tier: "silver" as TierKey, step: 2, minXP: 1375 },
  { key: "silver_3", tier: "silver" as TierKey, step: 3, minXP: 1750 },
  { key: "silver_4", tier: "silver" as TierKey, step: 4, minXP: 2125 },
  // Gold: 2500 - 5000 XP
  { key: "gold_1", tier: "gold" as TierKey, step: 1, minXP: 2500 },
  { key: "gold_2", tier: "gold" as TierKey, step: 2, minXP: 3125 },
  { key: "gold_3", tier: "gold" as TierKey, step: 3, minXP: 3750 },
  { key: "gold_4", tier: "gold" as TierKey, step: 4, minXP: 4375 },
  // Platinum: 5000 - 8000 XP
  { key: "platinum_1", tier: "platinum" as TierKey, step: 1, minXP: 5000 },
  { key: "platinum_2", tier: "platinum" as TierKey, step: 2, minXP: 5750 },
  { key: "platinum_3", tier: "platinum" as TierKey, step: 3, minXP: 6500 },
  { key: "platinum_4", tier: "platinum" as TierKey, step: 4, minXP: 7250 },
  // Diamond: 8000 - 12000 XP
  { key: "diamond_1", tier: "diamond" as TierKey, step: 1, minXP: 8000 },
  { key: "diamond_2", tier: "diamond" as TierKey, step: 2, minXP: 9000 },
  { key: "diamond_3", tier: "diamond" as TierKey, step: 3, minXP: 10000 },
  { key: "diamond_4", tier: "diamond" as TierKey, step: 4, minXP: 11000 },
  // Conqueror: 12000+ XP
  { key: "conqueror_1", tier: "conqueror" as TierKey, step: 1, minXP: 12000 },
  { key: "conqueror_2", tier: "conqueror" as TierKey, step: 2, minXP: 13000 },
  { key: "conqueror_3", tier: "conqueror" as TierKey, step: 3, minXP: 14000 },
  { key: "conqueror_4", tier: "conqueror" as TierKey, step: 4, minXP: 15000 },
];

/** Build the full rank list with resolved tier objects and numerals */
export const RANKS: RankStep[] = RANK_THRESHOLDS.map((t) => ({
  key: t.key,
  name: `${TIERS[t.tier].label} ${NUMERALS[t.step - 1]}`,
  tier: TIERS[t.tier],
  minXP: t.minXP,
  step: t.step,
  numeral: NUMERALS[t.step - 1],
}));

/**
 * Get the current rank from total XP.
 * Returns rank name, tier styling, progress percentage, and XP details.
 */
export function getRankFromXP(totalXP: number): RankData {
  const xp = Math.max(0, Math.floor(totalXP));

  // Binary search for current rank
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

