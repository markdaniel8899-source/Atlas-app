import { useEffect, useId, useRef } from "react";
import { Animated } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { TIERS } from "../../lib/gamification";
import type { TierKey } from "../../lib/gamification";

interface RankBadgeProps {
  /** Which rank family the badge belongs to. */
  rank: TierKey;
  /** Tier within the rank (1-4). */
  tier: number;
  size?: number;
}

/** Thick 3D metallic border gradient per rank: [light, mid, dark]. */
const METAL: Record<TierKey, [string, string, string]> = {
  bronze: ["#f2b483", "#cd7f32", "#7c4a12"],
  silver: ["#f1f5f9", "#c0c0c0", "#6b7280"],
  gold: ["#fff0a8", "#ffd700", "#a1740a"],
  platinum: ["#a5f3fc", "#22d3ee", "#0b6678"],
  diamond: ["#ddd0ff", "#9370db", "#4c2a8f"],
  conqueror: ["#ff8fa8", "#ff0055", "#8f0f34"],
};

/** Bright white/silver inner icons, subtly tinted per rank. */
const ICON: Record<TierKey, [string, string]> = {
  bronze: ["#ffe4c4", "#f0b27a"],
  silver: ["#ffffff", "#d8dde6"],
  gold: ["#fffbe8", "#ffe680"],
  platinum: ["#f0feff", "#a5f3fc"],
  diamond: ["#f6efff", "#d8b4fe"],
  conqueror: ["#ffe4ec", "#ffb0c4"],
};

/** Shared hexagon base (48x48 viewBox): thick border + bevels + navy face. */
const HEX_OUTER = "M24 3 L41.5 13.25 V33.75 L24 44 L6.5 33.75 V13.25 Z";
const HEX_INNER = "M24 7.6 L37.77 15.55 V31.45 L24 39.4 L10.23 31.45 V15.55 Z";
const BEVEL_LIGHT = "M7.9 14.1 L24 4.6 L40.1 14.1";
const BEVEL_DARK = "M40.1 32.9 L24 42.4 L7.9 32.9";

/** Conqueror crown and the canonical large right wing (mirrored for left). */
const CROWN = "M17.5 13.5 L20.2 10 L24 13 L27.8 10 L30.5 13.5 V16.5 H17.5 Z";
const WING =
  "M34 17 C40.5 14.8 45.5 17 47.5 22.5 C43.8 20 40.4 20.6 38.4 22.6 " +
  "C41.6 24.4 42.6 27.8 42 32 C38.2 29.2 35.4 26.8 33.6 23.6 Z";

/** Filled chevron (V up) with apex at (24, y) and given half-width. */
function chevronPath(y: number, hw: number): string {
  const l = 24 - hw;
  const r = 24 + hw;
  return `M${l} ${y + 6} L24 ${y} L${r} ${y + 6} V${y + 9.2} L24 ${y + 3.2} L${l} ${y + 9.2} Z`;
}

/** Computed five-point star (point up) centered at (cx, cy). */
function starPath(cx: number, cy: number, ro: number): string {
  const ri = ro * 0.42;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`,
    );
  }
  return `M${pts[0]} L${pts.slice(1).join(" L")} Z`;
}

/** Shrink/position a wing by scale about its anchor near the hex edge. */
function wingXform(s: number): string {
  return `translate(35 24) scale(${s}) translate(-35 -24)`;
}

/**
 * Military-style rank badge - every rank shares one hexagon (thick 3D
 * metallic border + dark navy #0f172a face); ranks/tiers are told apart
 * by white-silver chevrons, stars and wings whose tint follows the rank.
 */
export function RankBadge({ rank, tier, size = 48 }: RankBadgeProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const t = Math.min(Math.max(tier, 1), 4);
  const label = TIERS[rank].label;
  const [mLight, mMid, mDark] = METAL[rank];
  const [iLight, iDark] = ICON[rank];
  const isConqueror = rank === "conqueror";

  // Chevron stack grows upward from a fixed base (additive evolution).
  const stack = [25, 19, 13];
  const chevrons: [number, number][] = []; // [y, halfWidth]
  const stars: [number, number, number][] = []; // [cx, cy, r]
  const wings: number[] = []; // wing scales; length 1 = right wing only
  let crown = false;
  let aura = false;

  if (rank === "bronze") {
    stack.slice(0, Math.min(t, 3)).forEach((y) => chevrons.push([y, 8]));
    if (t === 4) stars.push([24, 10.2, 2.6]);
  } else if (rank === "silver") {
    stack.slice(0, Math.min(t, 3)).forEach((y) => chevrons.push([y, 8]));
    if (t <= 3) {
      stars.push([24, t === 1 ? 17 : t === 2 ? 13.5 : 10, 2.7]);
    } else {
      stars.push([20, 10.2, 2.4], [28, 10.2, 2.4]);
    }
  } else if (rank === "gold") {
    if (t === 1) stars.push([24, 23, 7.2]);
    else if (t === 2) stars.push([18.5, 23, 5.4], [29.5, 23, 5.4]);
    else if (t === 3)
      stars.push([24, 15, 4.4], [18, 27, 4.4], [30, 27, 4.4]);
    else {
      stars.push([15.5, 16.5, 3.6], [24, 15, 3.6], [32.5, 16.5, 3.6]);
      chevrons.push([26, 7]);
    }
  } else if (rank === "platinum") {
    if (t === 1) {
      wings.push(0.58);
      stars.push([20.5, 23, 4.4]);
    } else if (t === 2) {
      wings.push(0.58, 0.58);
      stars.push([24, 23, 4.4]);
    } else if (t === 3) {
      wings.push(0.78, 0.78);
      stars.push([19.5, 24, 3.6], [28.5, 24, 3.6]);
    } else {
      wings.push(1, 1);
      stars.push([24, 16.5, 3.6], [19.5, 26, 3.2], [28.5, 26, 3.2]);
    }
  } else if (rank === "diamond") {
    wings.push(1, 1);
    if (t === 1) stars.push([24, 23.5, 5]);
    else if (t === 2) stars.push([19.5, 23.5, 3.6], [28.5, 23.5, 3.6]);
    else {
      stars.push([24, 17, 3.6], [20, 27, 3.2], [30, 27, 3.2]);
      if (t === 4) aura = true;
    }
  } else {
    // Conqueror: ultimate winged crown, unique star per tier, always pulses.
    crown = true;
    wings.push(1, 1);
    stars.push([24, 25.5, 3.3 + t * 0.6]);
    if (t >= 3) stars.push([16, 29, 1.7], [32, 29, 1.7]);
    if (t === 4) stars.push([17.5, 34, 1.3], [30.5, 34, 1.3]);
  }

  // Conqueror pulse (Tailwind animate-pulse equivalent on opacity).
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isConqueror) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isConqueror, pulse]);

  const svg = (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id={`m-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mLight} />
          <Stop offset="0.5" stopColor={mMid} />
          <Stop offset="1" stopColor={mDark} />
        </LinearGradient>
        <LinearGradient id={`i-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={iLight} />
          <Stop offset="1" stopColor={iDark} />
        </LinearGradient>
      </Defs>

      {/* Diamond tier-IV glowing aura behind the hexagon (layered, blur-free) */}
      {aura && (
        <>
          <Path
            d={HEX_OUTER}
            transform="translate(24 24) scale(1.18) translate(-24 -24)"
            fill="#a78bfa"
            opacity={0.22}
          />
          <Path
            d={HEX_OUTER}
            transform="translate(24 24) scale(1.12) translate(-24 -24)"
            fill="#a78bfa"
            opacity={0.4}
          />
        </>
      )}

      {/* Hexagon base: thick 3D metallic border + dark navy face */}
      <Path
        d={HEX_OUTER}
        fill={`url(#m-${uid})`}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <Path
        d={BEVEL_LIGHT}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={BEVEL_DARK}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={HEX_INNER}
        fill="#0f172a"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={1}
        strokeLinejoin="round"
      />

      {/* Wings (Platinum / Diamond / Conqueror) */}
      {wings.map((s, i) => (
        <G key={`w${i}`}>
          <Path
            d={WING}
            transform={wingXform(s)}
            fill={`url(#i-${uid})`}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
          {wings.length === 2 && (
            <Path
              d={WING}
              transform={`matrix(-1 0 0 1 48 0) ${wingXform(s)}`}
              fill={`url(#i-${uid})`}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          )}
        </G>
      ))}

      {/* Conqueror crown */}
      {crown && (
        <Path
          d={CROWN}
          fill={`url(#i-${uid})`}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      )}

      {/* Stars */}
      {stars.map(([cx, cy, ro], i) => (
        <Path key={`s${i}`} d={starPath(cx, cy, ro)} fill={`url(#i-${uid})`} />
      ))}

      {/* Chevrons (Bronze / Silver / Gold-tier-IV) */}
      {chevrons.map(([y, hw], i) => (
        <Path
          key={`c${i}`}
          d={chevronPath(y, hw)}
          fill={`url(#i-${uid})`}
          stroke="rgba(0,0,0,0.25)"
          strokeWidth={0.4}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );

  if (isConqueror) {
    return (
      <Animated.View accessible accessibilityLabel={`${label} tier ${t} rank badge`} style={{ opacity: pulse }}>
        {svg}
      </Animated.View>
    );
  }

  return (
    <Animated.View accessible accessibilityLabel={`${label} tier ${t} rank badge`}>
      {svg}
    </Animated.View>
  );
}
