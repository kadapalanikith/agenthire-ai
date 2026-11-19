const { COLOR_TOKENS } = require('./src/theme/tokens');

// Every semantic colour resolves to a CSS variable set by ThemeProvider, so
// the same class (e.g. `bg-surface`) works in light and dark themes.
const colors = Object.fromEntries(
  Object.keys(COLOR_TOKENS.light).map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`])
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      borderRadius: { xl: '14px', '2xl': '18px' },
      fontSize: {
        display: ['30px', { lineHeight: '36px', letterSpacing: '-0.6px' }],
        title: ['22px', { lineHeight: '28px', letterSpacing: '-0.3px' }],
        heading: ['17px', { lineHeight: '24px', letterSpacing: '-0.2px' }],
        body: ['15px', { lineHeight: '22px' }],
        label: ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
    },
  },
  plugins: [],
};
