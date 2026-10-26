import { PixelRatio, useWindowDimensions } from "react-native";

/** Below this width the card layouts switch to their compact spacing. */
const COMPACT_WIDTH = 390;
/** Large phones keep the roomy layout. */
const WIDE_WIDTH = 430;
/** System font scaling above this gets the compact layout as well. */
const COMPACT_FONT_SCALE = 1.15;

/**
 * Shared responsive sizing for dense cards (leaderboard rows, player stats).
 * Spacing and fixed columns shrink on narrow phones, while the structure of
 * the row stays the same so alignment is identical on every device.
 */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const scale = Math.max(fontScale || 1, PixelRatio.getFontScale());
  const compact = width < COMPACT_WIDTH || scale > COMPACT_FONT_SCALE;
  const wide = width >= WIDE_WIDTH && !compact;

  return { width, height, fontScale: scale, compact, wide };
}
