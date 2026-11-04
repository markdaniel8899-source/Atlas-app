import { Easing } from "react-native";
import { ease } from "./theme";

export const MOTION = {
  page: 250,
  /** Incoming-section fade for direct (non-drawer) navigation. */
  section: 200,
  drawerOpen: 240,
  drawerClose: 200,
  sheet: 240,
  sheetClose: 200,
  easing: ease,
  /** Material exit curve: exits accelerate instead of easing out. */
  easingExit: Easing.bezier(0.3, 0, 0.8, 0.15),
} as const;

export const TAB_TRANSITION: "none" | "fade-through" = "none";
export const TAB_FADE_MS = 160;