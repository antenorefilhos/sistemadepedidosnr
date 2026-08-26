// Popula os 6 modelos ricos de banner (StoreBannersManager.tsx BANNER_TEMPLATES)
// como registros reais e ativos em store_banners_cms, com imagem propria
// (SVG gerado na hora, sem depender de asset externo) em vez de deixar o
// admin com a listagem vazia. Idempotente: usa id fixo por template, entao
// rodar de novo atualiza em vez de duplicar.
//
// Uso: node scripts/seed-banner-templates.js
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
const rgbToHex = (r, g, b) => `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
const shade = (hex, pct) => {
  const { r, g, b } = hexToRgb(hex)
  const f = pct < 0 ? 0 : 255
  const p = Math.abs(pct)
  return rgbToHex(r + (f - r) * p, g + (f - g) * p, b + (f - b) * p)
}

// Gera um SVG de fundo com gradiente elegante + textura sutil de pontos +
// titulo/badge -- serve como imagem valida do banner ate o lojista trocar
// pela foto real.
function buildBannerSvg({ width, height, colorHex, badgeText, title, ctaLabel }) {
  const from = shade(colorHex, 0.12)
  const to = shade(colorHex, -0.28)
  const dotColor = shade(colorHex, 0.4)
  const titleSize = Math.round(height * 0.11)
  const badgeSize = Math.round(height * 0.045)
  const ctaSize = Math.round(height * 0.045)
  const pad = Math.round(width * 0.06)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
    <pattern id="dots" width="${Math.round(height * 0.06)}" height="${Math.round(height * 0.06)}" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${dotColor}" opacity="0.25" />
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="url(#dots)" />
  ${badgeText ? `<rect x="${pad}" y="${Math.round(height * 0.32)}" width="${badgeText.length * badgeSize * 0.62 + 28}" height="${badgeSize + 20}" rx="${(badgeSize + 20) / 2}" fill="#D2BB8A" />
  <text x="${pad + 14}" y="${Math.round(height * 0.32) + badgeSize + 4}" font-family="Arial, sans-serif" font-size="${badgeSize}" font-weight="700" letter-spacing="1" fill="#231F20">${badgeText.toUpperCase()}</text>` : ''}
  <text x="${pad}" y="${Math.round(height * 0.55)}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="700" fill="#FFFFFF">${title}</text>
  ${ctaLabel ? `<rect x="${pad}" y="${Math.round(height * 0.68)}" width="${ctaLabel.length * ctaSize * 0.62 + 44}" height="${ctaSize + 26}" rx="8" fill="#FFFFFF" />
  <text x="${pad + 22}" y="${Math.round(height * 0.68) + ctaSize + 8}" font-family="Arial, sans-serif" font-size="${ctaSize}" font-weight="700" fill="${to}">${ctaLabel} →</text>` : ''}
</svg>`
}

const DIMS = {
  hero: { width: 1920, height: 720 },
  intercalado: { width: 850, height: 520 },
  tarja: { width: 1920, height: 420 },
  popup: { width: 900, height: 600 },
}

// Espelha BANNER_TEMPLATES de sistema/admin/src/pages/StoreBannersManager.tsx
// -- qualquer ajuste de copy/overlay la deveria refletir aqui tambem.
const TEMPLATES = [
  {
    id: 'seed-banner-hero-lancamento',
    slot: 'hero',
    name: 'Hero — Lançamento (modelo)',
    swatch: '#231F20',
    title: 'Chegou a novidade que você esperava',
    description: 'Conheça os lançamentos da semana com condições especiais.',
    badgeText: 'Novidade',
    ctaLabel: 'Conferir agora',
    overlayColor: 'rgba(35, 31, 32, 0.55)',
  },
  {
    id: 'seed-banner-hero-oferta',
    slot: 'hero',
    name: 'Hero — Grande Oferta (modelo)',
    swatch: '#5D082A',
    title: 'Grande oferta da semana',
    description: 'Preços especiais por tempo limitado. Aproveite antes que acabe.',
    badgeText: 'Só essa semana',
    ctaLabel: 'Ver ofertas',
    overlayColor: 'rgba(93, 8, 42, 0.6)',
  },
  {
    id: 'seed-banner-intercalado-destaque',
    slot: 'intercalado',
    name: 'Intercalado — Produto em Destaque (modelo)',
    swatch: '#231F20',
    title: 'Direto da nossa seleção especial',
    description: 'Qualidade Antenor & Filhos com preço que cabe no seu bolso.',
    badgeText: 'Mais vendido',
    ctaLabel: 'Aproveitar',
    overlayColor: 'rgba(35, 31, 32, 0.65)',
    align: 'left',
  },
  {
    id: 'seed-banner-intercalado-combo',
    slot: 'intercalado',
    name: 'Intercalado — Combo Econômico (modelo)',
    swatch: '#0F5132',
    title: 'Monte seu combo e economize',
    description: 'Combine produtos selecionados e pague menos.',
    badgeText: 'Economia',
    ctaLabel: 'Montar combo',
    overlayColor: 'rgba(15, 81, 50, 0.6)',
    align: 'right',
  },
  {
    id: 'seed-banner-tarja-frete',
    slot: 'tarja',
    name: 'Tarja — Frete Grátis (modelo)',
    swatch: '#1E3A5F',
    title: 'Frete grátis acima de R$150',
    description: 'Válido para toda a loja, direto no seu endereço.',
    badgeText: 'Frete grátis',
    ctaLabel: 'Aproveitar agora',
    overlayColor: 'rgba(35, 31, 32, 0.35)',
  },
  {
    id: 'seed-banner-popup-cupom',
    slot: 'popup',
    name: 'Popup — Cupom de Boas-vindas (modelo)',
    swatch: '#D2BB8A',
    title: 'Ganhe 10% na primeira compra',
    description: 'Use o cupom no fechamento do pedido.',
    badgeText: 'Exclusivo',
    ctaLabel: 'Resgatar cupom',
    overlayColor: 'rgba(93, 8, 42, 0.7)',
  },
]

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  let order = 0
  for (const t of TEMPLATES) {
    const dims = DIMS[t.slot]
    const filename = `${t.id}.svg`
    const filepath = path.join(UPLOADS_DIR, filename)
    const svg = buildBannerSvg({
      width: dims.width,
      height: dims.height,
      colorHex: t.swatch,
      badgeText: t.badgeText,
      title: t.title,
      ctaLabel: t.ctaLabel,
    })
    fs.writeFileSync(filepath, svg, 'utf8')

    const desktopImageUrl = `/uploads/${filename}`

    await prisma.storeBanner.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        slot: t.slot,
        title: t.title,
        description: t.description,
        badgeText: t.badgeText,
        ctaLabel: t.ctaLabel,
        overlayColor: t.overlayColor,
        align: t.align || 'left',
        desktopImageUrl,
        active: true,
      },
      create: {
        id: t.id,
        name: t.name,
        slot: t.slot,
        title: t.title,
        description: t.description,
        badgeText: t.badgeText,
        ctaLabel: t.ctaLabel,
        overlayColor: t.overlayColor,
        align: t.align || 'left',
        desktopImageUrl,
        linkType: 'url',
        linkValue: '/mercado',
        linkTarget: '_self',
        pages: 'home',
        active: true,
        order: order,
      },
    })
    order += 1
    console.log(`OK  ${t.slot.padEnd(11)} ${t.name}`)
  }

  console.log(`\n${TEMPLATES.length} banners-modelo prontos em store_banners_cms.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
