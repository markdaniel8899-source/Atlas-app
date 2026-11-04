import { Easing } from "react-native";
import { ease } from "./theme";

export const MOTION = {
  page: 250,
  /** Incoming-section fade for direct (non-drawer) navigation. */
  section: 280,
  /** Gentler decelerate so the longer section fade reads as a settle. */
  sectionEase: Easing.out(Easing.quad),
  drawerOpen: 240,
  drawerClose: 200,
  sheet: 240,
  sheetClose: 200,
  /** Bottom-sheet rise: iOS sheet curve, slower than the small modals. */
  sheetRise: 320,
  sheetEase: Easing.bezier(0.32, 0.72, 0, 1),
  easing: ease,
  /** Material exit curve: exits accelerate instead of easing out. */
  easingExit: Easing.bezier(0.3, 0, 0.8, 0.15),
} as const;

export const TAB_TRANSITION: "none" | "fade-through" = "none";
export const TAB_FADE_MS = 160;