/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0f0f0f',
        'bg-secondary': '#1a1a1a',
        'bg-tertiary': '#242424',
        'bg-hover': '#2a2a2a',
        'border-primary': '#2a2a2a',
        'border-secondary': '#333333',
        'accent-green': '#3ecf8e',
        'text-primary': '#ededed',
        'text-secondary': '#a0a0a0',
        'text-dim': '#555555',
      },
    },
  },
  plugins: [],
}