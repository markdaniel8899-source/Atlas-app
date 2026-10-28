"use no memo";

/**
 * Soft mesh-gradient background for the home-screen widgets.
 *
 * Android widgets cannot blur, and stacked linear-gradient circles read as
 * visible "blobs". Radial gradients that fade to fully transparent at their
 * edge have no boundary, so several oversized, low-opacity layers overlap into
 * an out-of-focus mesh instead.
 */

export type WidgetMeshVariant = "stats" | "notes";

interface Glow {
  /** Center and radii as fractions of the widget box. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  opacity: number;
}

const STATS_GLOWS: Glow[] = [
  { cx: 0.94, cy: 0.0, rx: 0.62, ry: 0.98, color: "#cf9eff", opacity: 0.34 },
  { cx: 0.0, cy: 1.02, rx: 0.56, ry: 0.88, color: "#9db4ff", opacity: 0.26 },
  { cx: 0.7, cy: 0.88, rx: 0.5, ry: 0.66, color: "#8b5cf6", opacity: 0.24 },
  { cx: 0.3, cy: 0.08, rx: 0.44, ry: 0.52, color: "#b394ff", opacity: 0.18 },
];

const NOTES_GLOWS: Glow[] = [
  { cx: 0.97, cy: 0.02, rx: 0.62, ry: 0.94, color: "#cf9eff", opacity: 0.32 },
  { cx: 0.0, cy: 1.0, rx: 0.58, ry: 0.86, color: "#9db4ff", opacity: 0.24 },
  { cx: 0.56, cy: 0.62, rx: 0.52, ry: 0.62, color: "#8b5cf6", opacity: 0.2 },
];

function px(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "0";
}

export function buildWidgetMeshSvg(
  width: number,
  height: number,
  variant: WidgetMeshVariant,
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const glows = variant === "stats" ? STATS_GLOWS : NOTES_GLOWS;

  const defs = glows
    .map(
      (glow, index) =>
        `<radialGradient id="g${index}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${glow.color}" stop-opacity="${glow.opacity}"/>` +
        `<stop offset="42%" stop-color="${glow.color}" stop-opacity="${(glow.opacity * 0.46).toFixed(3)}"/>` +
        `<stop offset="74%" stop-color="${glow.color}" stop-opacity="${(glow.opacity * 0.12).toFixed(3)}"/>` +
        `<stop offset="100%" stop-color="${glow.color}" stop-opacity="0"/>` +
        `</radialGradient>`,
    )
    .join("");

  const blobs = glows
    .map(
      (glow, index) =>
        `<ellipse cx="${px(w * glow.cx)}" cy="${px(h * glow.cy)}" ` +
        `rx="${px(w * glow.rx)}" ry="${px(h * glow.ry)}" fill="url(#g${index})"/>`,
    )
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px(w)}" height="${px(h)}" ` +
    `viewBox="0 0 ${px(w)} ${px(h)}">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="#0b0717"/>` +
    `<stop offset="55%" stop-color="#07050f"/>` +
    `<stop offset="100%" stop-color="#040409"/>` +
    `</linearGradient>` +
    defs +
    `</defs>` +
    `<rect width="${px(w)}" height="${px(h)}" fill="url(#bg)"/>` +
    blobs +
    `</svg>`
  );
}
