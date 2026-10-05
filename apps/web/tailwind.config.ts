import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { plum: '#6B3657', pearl: '#F8F7F9', ink: '#30232D', muted: '#7A7178' },
      fontFamily: { sans: ['Inter', 'sans-serif'], display: ['Newsreader', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
} satisfies Config;
