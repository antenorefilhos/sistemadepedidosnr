// Popula os 6 modelos ricos de banner (StoreBannersManager.tsx BANNER_TEMPLATES)
// como registros reais e ativos em store_banners_cms, com foto real
// (assets/banner-templates/*.webp, gerada por IA e otimizada uma vez via
// scripts/optimize-banner-templates.js -- ver esse script pra regenerar) em
// vez de deixar o admin com a listagem vazia. Idempotente: usa id fixo por
// template, entao rodar de novo atualiza em vez de duplicar.
//
// Uso: node scripts/seed-banner-templates.js
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const ASSETS_DIR = path.join(process.cwd(), 'assets', 'banner-templates')

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

// Fallback quando o webp real (assets/banner-templates/) nao existe pra um
// template -- gradiente elegante + textura sutil de pontos, SEM
// titulo/badge/CTA desenhados na imagem. Todo componente do storefront que
// consome o banner (PromoBanner, HeroSlider, TarjaStrip, PopupBanner) ja
// desenha titulo/badge/CTA como camada de texto por cima da imagem a partir
// dos campos do banner -- uma primeira versao deste script desenhava esse
// mesmo texto DENTRO do SVG tambem, duplicando (texto do React por cima do
// texto da imagem) e, na tarja (56px de altura real vs SVG pensado pra
// 420px), vazando gigante pra fora da faixa. So o fundo evita os dois.
function buildBannerSvg({ width, height, colorHex }) {
  const from = shade(colorHex, 0.12)
  const to = shade(colorHex, -0.28)
  const dotColor = shade(colorHex, 0.4)
  const dotSize = Math.round(height * 0.06)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
    <pattern id="dots" width="${dotSize}" height="${dotSize}" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${dotColor}" opacity="0.25" />
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="url(#dots)" />
</svg>`
}

const DIMS = {
  hero: { width: 1920, height: 720 },
  intercalado: { width: 850, height: 520 },
  category: { width: 1600, height: 600 },
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
  // Banners de categoria: aparecem na aba "Categorias" do admin. targetCategory
  // e obrigatorio pro slot (o backend recusa sem ele) e guarda o NOME da
  // categoria do CMS, nao um id -- e o que o select do admin envia.
  {
    id: 'seed-banner-category-acougue',
    slot: 'category',
    name: 'Categoria — Açougue (modelo)',
    swatch: '#5D082A',
    title: 'Cortes selecionados do nosso açougue',
    description: 'Carne fresca escolhida a dedo, cortada na hora pra sua receita.',
    badgeText: 'Especial',
    ctaLabel: 'Ver ofertas do açougue',
    overlayColor: 'rgba(93, 8, 42, 0.55)',
    align: 'left',
    targetCategory: 'Acougue Churrasco',
    linkType: 'url',
    linkValue: '/promocoes',
    // Reaproveita a foto de outro modelo (nao existe webp proprio em
    // assets/banner-templates) -- o arquivo e copiado com o id deste banner,
    // entao cada um fica com a sua copia.
    imageFrom: 'seed-banner-hero-oferta',
  },
  {
    id: 'seed-banner-category-adega',
    slot: 'category',
    name: 'Categoria — Adega (modelo)',
    swatch: '#231F20',
    title: 'Vinhos que valem a pena',
    description: 'Rótulos escolhidos pra acompanhar do dia a dia à ocasião especial.',
    badgeText: 'Seleção especial',
    ctaLabel: 'Ver ofertas da adega',
    overlayColor: 'rgba(35, 31, 32, 0.6)',
    align: 'right',
    targetCategory: 'Adega Vinhos Espumantes',
    linkType: 'url',
    linkValue: '/promocoes',
    imageFrom: 'seed-banner-intercalado-destaque',
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

// Mesma normalizacao do storefront (normalizeCategoryCode em
// utils/homeCategories.ts): sem acento, MAIUSCULO, separador virando _.
const normalizeCategoryCode = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/**
 * targetCategory precisa guardar o nome da categoria EXATAMENTE como esta no
 * banco, porque o select do admin casa por nome (`value={c.name}`) -- um valor
 * escrito a mao aqui abriria o formulario sem opcao selecionada e o operador
 * sobrescreveria sem perceber. O nome varia por ambiente ("Acougue Churrasco"
 * local, "Açougue & Churrasco" em producao), entao o literal do template serve
 * so pra achar a categoria pelo codigo normalizado; o nome real vem do banco.
 */
async function resolveCategoryName(literal) {
  const target = normalizeCategoryCode(literal)
  const categories = await prisma.category.findMany({ where: { active: true }, select: { name: true } })
  const match = categories.find((c) => normalizeCategoryCode(c.name) === target)
  if (!match) {
    console.warn(`  (categoria "${literal}" nao existe neste banco -- gravando o literal)`)
    return literal
  }
  if (match.name !== literal) console.log(`  categoria "${literal}" -> "${match.name}" (nome real do banco)`)
  return match.name
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  let order = 0
  for (const t of TEMPLATES) {
    const dims = DIMS[t.slot]
    // imageFrom: modelo sem webp proprio que emprestа a foto de outro. A copia
    // vai pro uploads com o id DESTE banner, entao os dois ficam independentes.
    const webpSrc = path.join(ASSETS_DIR, `${t.imageFrom || t.id}.webp`)
    let filename
    if (fs.existsSync(webpSrc)) {
      filename = `${t.id}.webp`
      fs.copyFileSync(webpSrc, path.join(UPLOADS_DIR, filename))
    } else {
      console.warn(`  (sem foto real em assets/banner-templates/${t.id}.webp -- usando fundo gerado)`)
      filename = `${t.id}.svg`
      const svg = buildBannerSvg({ width: dims.width, height: dims.height, colorHex: t.swatch })
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), svg, 'utf8')
    }

    const desktopImageUrl = `/uploads/${filename}`

    // Banner de categoria aponta pra propria categoria (resolveBannerLink
    // transforma o nome no /mercado?cat=... certo, e manda Adega pra /adega).
    const isCategory = t.slot === 'category'
    const targetCategory = isCategory && t.targetCategory ? await resolveCategoryName(t.targetCategory) : null
    // O CTA do banner de categoria NAO aponta pra propria categoria: o banner ja
    // fica dentro dela, entao o botao recarregaria a mesma tela. Os modelos
    // levam pras promocoes -- destino real, e o operador troca pra onde quiser.
    const linkType = t.linkType || 'url'
    const linkValue = t.linkValue || '/mercado'

    await prisma.storeBanner.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        slot: t.slot,
        targetCategory,
        title: t.title,
        description: t.description,
        badgeText: t.badgeText,
        ctaLabel: t.ctaLabel,
        overlayColor: t.overlayColor,
        align: t.align || 'left',
        linkType,
        linkValue,
        desktopImageUrl,
        active: true,
      },
      create: {
        id: t.id,
        name: t.name,
        slot: t.slot,
        targetCategory,
        title: t.title,
        description: t.description,
        badgeText: t.badgeText,
        ctaLabel: t.ctaLabel,
        overlayColor: t.overlayColor,
        align: t.align || 'left',
        desktopImageUrl,
        linkType,
        linkValue,
        linkTarget: '_self',
        pages: isCategory ? 'category' : 'home',
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
