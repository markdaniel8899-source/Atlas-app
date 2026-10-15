/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#030305',
        surface: '#0a0a1a',
        heading: '#ffffff',
        text: 'rgba(255,255,255,0.7)',
        void: '#030305',
        ink: '#0a0a1a',
        midnight: '#0b1026',
        star: '#9db4ff',
        lilac: '#cf9eff',
        body: 'rgba(255,255,255,0.7)',
        selection: 'rgba(157,180,255,0.28)',
        hairline: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Geist_400Regular'],
        'sans-medium': ['Geist_500Medium'],
        'sans-semibold': ['Geist_600SemiBold'],
        'sans-bold': ['Geist_700Bold'],
        mono: ['GeistMono_400Regular'],
        'mono-medium': ['GeistMono_500Medium'],
        'mono-semibold': ['GeistMono_600SemiBold'],
        display: ['Outfit_400Regular'],
        'display-medium': ['Outfit_500Medium'],
        'display-semibold': ['Outfit_600SemiBold'],
        'display-bold': ['Outfit_700Bold'],
        outfit: ['Outfit_400Regular'],
        'outfit-semibold': ['Outfit_600SemiBold'],
        'outfit-bold': ['Outfit_700Bold'],
        syne: ['Syne_400Regular'],
        'syne-medium': ['Syne_500Medium'],
        'syne-semibold': ['Syne_600SemiBold'],
        'syne-bold': ['Syne_700Bold'],
      },
      boxShadow: {
        'atlas-glow': '0 0 48px -12px rgba(207,158,255,0.55)',
        'star-glow': '0 0 32px -8px rgba(157,180,255,0.6)',
        sheen: 'inset 0 1px 0 rgba(255,255,255,0.07)',
        card: '0 24px 60px -32px rgba(0,0,0,0.9)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        },
        '.card-sheen': {
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
        },
        '.no-scrollbar': {
          scrollbarWidth: 'none',
        },
      });
    },
  ],
};
