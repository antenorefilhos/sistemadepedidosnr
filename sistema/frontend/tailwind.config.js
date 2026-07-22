/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Source Sans 3', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      // Rampa de tipo do DESIGN.md. Seis degraus, todos em rem para respeitar a
      // preferencia de tamanho de fonte do usuario. Razao ~1.2 na ponta pequena
      // (10-12-14-16) e ~1.25-1.5 no topo (16-20-30).
      fontSize: {
        label:    ['0.625rem', { lineHeight: '1.2' }],   // 10px
        caption:  ['0.75rem',  { lineHeight: '1.35' }],  // 12px
        body:     ['0.875rem', { lineHeight: '1.5' }],   // 14px
        title:    ['1rem',     { lineHeight: '1.4' }],   // 16px
        headline: ['1.25rem',  { lineHeight: '1.3' }],   // 20px
        display:  ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 30px
      },
      borderRadius: {
        xl:  '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
    },
  },
  plugins: [],
}