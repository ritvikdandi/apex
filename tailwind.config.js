/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        card: '#111111',
        border: '#1a1a1a',
        accent: '#00FF87',
        'accent-glow': 'rgba(0, 255, 135, 0.15)',
        text: '#FFFFFF',
        muted: '#8E8E8E',
        danger: '#FF3B30',
        warning: '#FF9500',
        tabbar: '#0a0a0a',
        'tab-inactive': '#555555',
        'macro-protein': '#5AC8FA',
        'macro-carbs': '#FF9F0A',
        'macro-fat': '#FFD60A',
      },
    },
  },
  plugins: [],
};
