import { ease } from "./theme";

export const MOTION = {
  page: 250,
  drawerOpen: 240,
  drawerClose: 200,
  sheet: 240,
  sheetClose: 200,
  easing: ease,
} as const;

export const TAB_TRANSITION: "none" | "fade-through" = "none";
export const TAB_FADE_MS = 160;