import { Easing } from "react-native";

export const colors = {
  appBg: "#04040a",
  star: "#9db4ff",
  star70: "rgba(157,180,255,0.7)",
  star50: "rgba(157,180,255,0.5)",
  star30: "rgba(157,180,255,0.3)",
  star10: "rgba(157,180,255,0.10)",
  star06: "rgba(157,180,255,0.06)",
  lilac: "#cf9eff",
  lilac90: "rgba(207,158,255,0.9)",
  lilac70: "rgba(207,158,255,0.7)",
  lilac50: "rgba(207,158,255,0.5)",
  lilac45: "rgba(207,158,255,0.45)",
  lilac25: "rgba(207,158,255,0.25)",
  lilac12: "rgba(207,158,255,0.12)",
  lilac10: "rgba(207,158,255,0.10)",
  cardBg: "#0c0c16",
  cardBorder: "#24242f",
  primaryText: "#05050a",
  white: "#ffffff",
  w02: "rgba(255,255,255,0.02)",
  w03: "rgba(255,255,255,0.03)",
  w04: "rgba(255,255,255,0.04)",
  w05: "rgba(255,255,255,0.05)",
  w06: "rgba(255,255,255,0.06)",
  w07: "rgba(255,255,255,0.07)",
  w08: "rgba(255,255,255,0.08)",
  w10: "rgba(255,255,255,0.10)",
  w15: "rgba(255,255,255,0.15)",
  w20: "rgba(255,255,255,0.20)",
  w30: "rgba(255,255,255,0.46)",
  w35: "rgba(255,255,255,0.48)",
  w40: "rgba(255,255,255,0.50)",
  w45: "rgba(255,255,255,0.52)",
  w50: "rgba(255,255,255,0.54)",
  w60: "rgba(255,255,255,0.60)",
  w70: "rgba(255,255,255,0.70)",
  w75: "rgba(255,255,255,0.75)",
  w80: "rgba(255,255,255,0.80)",
  zinc500: "#7a7a84",
  flame: "#ff8f52",
  orangeBorder: "rgba(251,146,60,0.25)",
  orangeBg: "rgba(251,146,60,0.08)",
  avatarFrom: "#3d4f9e",
  avatarTo: "#7b8ee8",
} as const;

export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
  display: "Outfit_600SemiBold",
  brand: "CreateFuture",
} as const;

/** Cubic bezier [0.22, 1, 0.36, 1] - the app's shared ease-out curve. */
export const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const RADIUS = {
  card: 16,
  inner: 12,
} as const;

export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.37,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;
