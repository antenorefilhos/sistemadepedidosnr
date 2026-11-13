const animate = require('tailwindcss-animate')
const plugin = require('tailwindcss/plugin')
const baseColors = require('tailwindcss/colors')

/*
 * TEMA ESCURO (13/11/2026): em vez de reescrever as ~1.900 classes de cor fixas do admin
 * (text-gray-500, bg-white, bg-rose-50...), as escalas viram VARIAVEIS CSS. No claro elas
 * valem exatamente o padrao do Tailwind (a tela nao muda); com `.dark` no <html> trocam.
 * O botao de tema esta em src/components/ThemeToggle.tsx, a logica em src/lib/theme.ts.
 *
 * Regras que evitam texto ilegivel:
 *  - FUNDO forte (tons 400+ de qualquer cor, ex.: bg-gray-900, bg-emerald-600) NAO inverte:
 *    quase sempre leva texto branco por cima. So os tons claros de fundo (50-300) trocam.
 *  - text-gray-300 NAO inverte: e o texto claro que fica sobre esses fundos fortes.
 *  - bg-white vira a superficie escura; text-white nunca muda.
 *  - border/ring/divide "black" (usados com 5-10% de opacidade como linha fina) viram branco no escuro.
 * Tom novo de uma familia nova: acrescentar em FAMILIES; o resto sai sozinho.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
const FAMILIES = ['gray', 'slate', 'rose', 'amber', 'emerald', 'red', 'blue']
// Familias coloridas no escuro: o tom espelhado da propria paleta (50 vira 950, 700 vira 300...).
const FLIP = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100 }
// Cinzas no escuro: rampa propria (azul-grafite) para dar hierarquia de superficies.
const DARK_GRAY = {
  50: '29 34 44', 100: '37 43 55', 200: '55 63 78', 300: '75 85 101', 400: '128 138 155',
  500: '152 161 176', 600: '178 186 199', 700: '203 209 219', 800: '226 230 236', 900: '243 245 248',
}
const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const cssVar = (name) => `rgb(var(${name}) / <alpha-value>)`
const lightVars = { '--c-surface': '255 255 255', '--c-black': '0 0 0' }
const darkVars = { '--c-surface': '23 27 35', '--c-black': '255 255 255' }
for (const family of FAMILIES) {
  for (const shade of SHADES) {
    lightVars[`--c-${family}-${shade}`] = toRgb(baseColors[family][shade])
    darkVars[`--c-${family}-${shade}`] = family === 'gray' ? DARK_GRAY[shade] : toRgb(baseColors[family][FLIP[shade]])
  }
}
const scale = (family) => Object.fromEntries(SHADES.map((s) => [s, cssVar(`--c-${family}-${s}`)]))
const strongBackgrounds = (family) => Object.fromEntries(SHADES.filter((s) => s >= 400).map((s) => [s, baseColors[family][s]]))
const themeVarsPlugin = plugin(({ addBase }) => addBase({ ':root': lightVars, '.dark': darkVars }))

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'in': 'fadeIn 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-out-left': 'slideOutLeft 0.2s ease-in',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        slideInLeft: {
          'from': { transform: 'translateX(-100%)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          'from': { transform: 'translateX(0)', opacity: '1' },
          'to': { transform: 'translateX(-100%)', opacity: '0' },
        },
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          50: '#fbf6ee',
          100: '#f7eee2',
          200: '#ead8be',
          500: '#5d082a',
          600: '#4a0622',
          700: '#3a051b',
        },
        // Escalas por variavel CSS (ver o comentario no topo): trocam com `.dark`.
        ...Object.fromEntries(FAMILIES.map((family) => [family, scale(family)])),
      },
      backgroundColor: {
        white: cssVar('--c-surface'),
        ...Object.fromEntries(FAMILIES.map((family) => [family, strongBackgrounds(family)])),
      },
      textColor: {
        gray: { 300: baseColors.gray[300] },
      },
      borderColor: { black: cssVar('--c-black') },
      // DEFAULT explicito: estender ringColor sem ele trocava o anel padrao de azul-500 para azul-300.
      ringColor: { DEFAULT: baseColors.blue[500], black: cssVar('--c-black') },
      divideColor: { black: cssVar('--c-black') },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl:  '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
      },
      spacing: {
        'safe': 'max(1rem, env(safe-area-inset-bottom))',
      },
    },
  },
  plugins: [animate, themeVarsPlugin],
}
