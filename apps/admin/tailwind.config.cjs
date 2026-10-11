const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [require('@naya/tokens/tailwind-preset')],
  theme: {
    extend: {
      // Same token names as the shared preset, backed by CSS variables (light + dark, see index.css).
      colors: {
        background: v('background'),
        surface: v('surface'),
        selected: v('selected'),
        ink: v('ink'),
        muted: v('muted'),
        inverse: v('inverse'),
        accent: { DEFAULT: v('accent'), pressed: v('accent-pressed'), deep: v('accent-deep') },
        mauve: { DEFAULT: v('mauve'), soft: v('mauve-soft') },
        line: v('line'),
        disabled: { fill: v('disabled-fill'), text: v('disabled-text') },
        success: { DEFAULT: v('success'), soft: v('success-soft') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
        info: { DEFAULT: v('info'), soft: v('info-soft') },
        map: v('map'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(46,32,44,0.04), 0 4px 16px rgba(46,32,44,0.05)',
        float: '0 12px 32px rgba(46,32,44,0.14)',
        button: '0 6px 14px rgba(107,54,87,0.26)',
      },
    },
  },
};
