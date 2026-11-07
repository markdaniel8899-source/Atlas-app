import { Easing } from "react-native";
import { ease } from "./theme";

export const MOTION = {
  page: 300,
  /** Incoming-section fade for direct (non-drawer) navigation. */
  section: 340,
  /** Gentler decelerate so the longer section fade reads as a settle. */
  sectionEase: Easing.out(Easing.quad),
  drawerOpen: 300,
  drawerClose: 240,
  sheet: 300,
  sheetClose: 250,
  /** Bottom-sheet rise: iOS sheet curve, slower than the small modals. */
  sheetRise: 380,
  sheetEase: Easing.bezier(0.32, 0.72, 0, 1),
  /** Menu/dropdown pop-in and pop-out. */
  menu: 260,
  menuClose: 220,
  easing: ease,
  /** Material exit curve: exits accelerate instead of easing out. */
  easingExit: Easing.bezier(0.3, 0, 0.8, 0.15),
  /** Press feedback: quick compress, softer release. */
  pressIn: 110,
  pressOut: 190,
} as const;

export const TAB_TRANSITION: "none" | "fade-through" = "none";
export const TAB_FADE_MS = 160;