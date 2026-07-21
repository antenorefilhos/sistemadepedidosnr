/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl:  '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
    },
  },
  plugins: [],
}