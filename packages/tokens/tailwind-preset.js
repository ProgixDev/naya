// Tailwind CSS 3 preset shared by the Expo apps (NativeWind 4) and the admin web app.
// Values mirror src/index.ts; keep both in sync when a token changes.
const colors = {
  background: '#F8F7F9',
  surface: '#FFFFFF',
  selected: '#EDE3EA',
  ink: '#29232D',
  muted: '#716977',
  inverse: '#FFFFFF',
  accent: { DEFAULT: '#6B3657', pressed: '#56294A', deep: '#3F1B34' },
  mauve: { DEFAULT: '#B98AA8', soft: '#F1EBF0' },
  line: '#E7E2E8',
  disabled: { fill: '#ECE6EA', text: '#A0939E' },
  success: { DEFAULT: '#2F6B4F', soft: '#E6F2EB' },
  warning: { DEFAULT: '#8A5A12', soft: '#FBF0DC' },
  danger: { DEFAULT: '#A5313F', soft: '#F9E5E8' },
  info: { DEFAULT: '#3C5A86', soft: '#E6ECF5' },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Naya is a light, art-directed product; the scheme is never switched by the OS.
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['Inter_400Regular', 'Inter', 'system-ui', 'sans-serif'],
        regular: ['Inter_400Regular', 'Inter'],
        medium: ['Inter_500Medium', 'Inter'],
        semibold: ['Inter_600SemiBold', 'Inter'],
        bold: ['Inter_700Bold', 'Inter'],
      },
      fontSize: {
        display: ['44px', { lineHeight: '52px', letterSpacing: '-1.3px' }],
        hero: ['34px', { lineHeight: '39px', letterSpacing: '-1.1px' }],
        title: ['21px', { lineHeight: '26px', letterSpacing: '-0.2px' }],
        heading: ['18px', { lineHeight: '24px' }],
        body: ['16px', { lineHeight: '22px' }],
        action: ['15px', { lineHeight: '20px' }],
        caption: ['13px', { lineHeight: '18px' }],
        micro: ['12px', { lineHeight: '16px' }],
      },
      spacing: { gutter: '20px', 13: '52px', 15: '60px', 18: '72px' },
      borderRadius: { row: '16px', card: '22px', sheet: '32px', field: '18px' },
      height: { major: '50px', control: '44px', compact: '36px', chip: '32px' },
      minHeight: { major: '50px', control: '44px', compact: '36px', touch: '44px' },
    },
  },
};
