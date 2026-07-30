/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf6ee',
          100: '#f7eee2',
          500: '#5d082a',
          600: '#4a0622',
          700: '#3a051b',
        },
      },
    },
  },
  plugins: [],
}
