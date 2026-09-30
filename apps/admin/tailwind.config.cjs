/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [require('@naya/tokens/tailwind-preset')],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(46,32,44,0.04), 0 4px 16px rgba(46,32,44,0.05)',
        float: '0 12px 32px rgba(46,32,44,0.14)',
        button: '0 6px 14px rgba(107,54,87,0.26)',
      },
    },
  },
};
