/**
 * DiceBear avatar generation - free, no API key.
 * Docs: https://www.dicebear.com/how-to-use/http-api/
 * The app requests PNG so React Native's Image can render the result.
 */

export type DiceBearStyle =
  | "bottts-neutral"
  | "avataaars"
  | "lorelei"
  | "bottts"
  | "adventurer"
  | "micah"
  | "big-ears"
  | "notionists"
  | "shapes";

export const DEFAULT_DICEBEAR_STYLE: DiceBearStyle = "bottts-neutral";

export const DICEBEAR_STYLES: { id: DiceBearStyle; label: string }[] = [
  { id: "bottts-neutral", label: "Bot" },
  { id: "avataaars", label: "Avataaars" },
  { id: "lorelei", label: "Lorelei" },
  { id: "bottts", label: "Bottts" },
  { id: "adventurer", label: "Adventurer" },
  { id: "micah", label: "Micah" },
  { id: "big-ears", label: "Big Ears" },
  { id: "notionists", label: "Notionists" },
  { id: "shapes", label: "Shapes" },
];

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";

/** Pastel backgrounds that read well on the dark ATLAS surface. */
const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffdfbf", "ffd5dc"];

export function dicebearUrl(style: DiceBearStyle, seed: string): string {
  const bg =
    BACKGROUNDS[
      Math.abs(
        [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7),
      ) % BACKGROUNDS.length
    ];
  return `${DICEBEAR_BASE}/${style}/png?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
}

export function isDicebearUrl(url: string): boolean {
  return url.startsWith("https://api.dicebear.com/");
}

/**
 * React Native's Image cannot render SVG, so DiceBear URLs saved by the
 * web client (`/svg?…`) are rewritten to the PNG variant for display.
 */
export function pngAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("https://api.dicebear.com/") && url.includes("/svg?")) {
    return url.replace("/svg?", "/png?");
  }
  return url;
}

/**
 * Seed = the raw user id, so an avatar is uniquely tied to the account
 * and every candidate grid still differs per user.
 */
export function baseSeedFor(userId: string): string {
  return userId;
}

/** 10 unique candidate URLs for the picker grid. */
export function generateAvatarCandidates(
  baseSeed: string,
  style: DiceBearStyle,
  count = 10,
): string[] {
  const stamp = Date.now().toString(36);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(dicebearUrl(style, `${baseSeed}-${stamp}-${i}`));
  }
  return out;
}
