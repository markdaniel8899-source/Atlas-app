export const colors = {
  void: '#030305',
  ink: '#0a0a1a',
  midnight: '#0b1026',
  star: '#9db4ff',
  lilac: '#cf9eff',
  heading: '#ffffff',
  body: 'rgba(255,255,255,0.7)',
  selection: 'rgba(157,180,255,0.28)',
  glass: 'rgba(255,255,255,0.03)',
  hairline: 'rgba(255,255,255,0.08)',
} as const;

export const fontFamilies = {
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemibold: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  display: 'Outfit_400Regular',
  displaySemibold: 'Outfit_600SemiBold',
  syne: 'Syne_400Regular',
  syneBold: 'Syne_700Bold',
} as const;

export const glass = {
  backgroundColor: colors.glass,
  borderColor: colors.hairline,
  borderWidth: 1,
} as const;

export const meshStops = [colors.void, colors.ink, colors.midnight] as const;

export const glowStops = {
  star: 'rgba(157,180,255,0.16)',
  lilac: 'rgba(207,158,255,0.14)',
  transparent: 'rgba(207,158,255,0)',
} as const;
