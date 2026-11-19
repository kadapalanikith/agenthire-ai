/**
 * Design tokens: the single source for colours in both themes.
 * Consumed by tailwind.config.js (CSS-variable classes) and by components
 * that need raw values (icons, navigation chrome, status bar).
 *
 * CommonJS so tailwind.config.js can require it.
 */
const COLOR_TOKENS = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    'surface-muted': '#F1F3F6',
    border: '#E3E6EB',
    'border-strong': '#CDD2DA',
    foreground: '#0E1116',
    muted: '#5A6170',
    subtle: '#8A909C',
    primary: '#3B5BDB',
    'primary-foreground': '#FFFFFF',
    'primary-muted': '#ECF0FC',
    danger: '#C9323B',
    'danger-muted': '#FCEDEE',
    success: '#1E8049',
    'success-muted': '#E6F5EC',
    warning: '#9A5B05',
    'warning-muted': '#FDF4DB',
  },
  dark: {
    background: '#0B0D12',
    surface: '#13161D',
    'surface-muted': '#1A1E27',
    border: '#242934',
    'border-strong': '#333A47',
    foreground: '#F1F3F6',
    muted: '#A1A8B5',
    subtle: '#6E7584',
    primary: '#7D9BFF',
    'primary-foreground': '#0B0D12',
    'primary-muted': '#19213A',
    danger: '#FF7B81',
    'danger-muted': '#33171A',
    success: '#5ED08B',
    'success-muted': '#12271B',
    warning: '#F2C14E',
    'warning-muted': '#2D2410',
  },
};

function hexToRgbChannels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variables for NativeWind's vars(): { '--color-surface': '255 255 255', ... } */
function toCssVariables(scheme) {
  return Object.fromEntries(
    Object.entries(COLOR_TOKENS[scheme]).map(([name, hex]) => [`--color-${name}`, hexToRgbChannels(hex)])
  );
}

module.exports = { COLOR_TOKENS, toCssVariables, hexToRgbChannels };
