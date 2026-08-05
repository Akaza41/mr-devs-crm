/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0d0d10',
        'bg-panel': '#151518',
        'bg-card': '#1c1c20',
        'bg-hover': '#242428',
        'border-primary': 'rgba(255, 255, 255, 0.08)',
        'border-secondary': 'rgba(255, 255, 255, 0.12)',
        'accent-green': '#3ecf8e',
        'accent-gold': '#f2b84b',
        'text-primary': '#f5f5f0',
        'text-secondary': '#8a8a85',
        'text-dim': '#555555',
        // Legacy fallbacks for compatibility
        'bg-primary': '#0d0d10',
        'bg-secondary': '#151518',
        'bg-tertiary': '#1c1c20',
      },
      fontFamily: {
        headline: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}