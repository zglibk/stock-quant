/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3b82f6', dark: '#2563eb' },
        accent:  { DEFAULT: '#f97316' },
        surface: { DEFAULT: '#1a2332', light: '#1f2b3d' },
        up:   '#ef4444',  // A股涨红
        down: '#10b981',  // A股跌绿
      }
    }
  },
  plugins: []
}
