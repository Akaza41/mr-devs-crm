/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0a0a0a',
        'bg-panel': '#161616',
        'bg-card': '#232323',
        'bg-hover': '#2a2a2a',
        'border-primary': '#232323',
        'border-secondary': '#333333',
        'accent-green': '#3ecf8e',
        'text-primary': '#f5f5f0',
        'text-secondary': '#8a8a85',
        'text-dim': '#555555',
        // Legacy fallbacks for compatibility
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#161616',
        'bg-tertiary': '#232323',
      },
      fontFamily: {
        headline: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}