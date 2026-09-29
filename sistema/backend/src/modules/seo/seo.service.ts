import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { isProductSellable } from '../../common/product-availability'

// O storefront e uma SPA: sem isto o Google e o preview de link do
// WhatsApp/Facebook recebiam um <div id="root"></div> vazio e o sitemap tinha
// 6 URLs fixas. Aqui o servidor entrega o HTML do produto ja preenchido
// (titulo, descricao, preco, foto, JSON-LD) e o sitemap com todo o catalogo.
// O React assume a pagina normalmente por cima (createRoot substitui o root).

export const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const productPath = (p: { id: string; name: string; erpProductId: number | null }) =>
  p.erpProductId ? `/p/${slugify(p.name)}-${p.erpProductId}` : `/produto/${p.id}`

const escapeHtml = (value: string) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// JSON dentro de <script>: impede "</script>" no nome do produto de fechar a tag.
const safeJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const PRODUCT_SELECT = {
  id: true,
  ean: true,
  erpProductId: true,
  name: true,
  alternativeDescription: true,
  price: true,
  promotionalPrice: true,
  isFractional: true,
  unit: true,
  category: true,
  ecommerceCategory: true,
  active: true,
  syncOption: true,
  stock: true,
} as const

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name)
  private indexCache: { html: string; at: number } | null = null

  constructor(private readonly prisma: PrismaService) {}

  get siteUrl() {
    return String(process.env.FRONTEND_URL || 'https://mercado.antenorefilhos.com.br').replace(/\/+$/, '')
  }

  /** index.html do build do storefront (cache de 5 min; muda a cada deploy). */
  private async getIndexHtml(): Promise<string> {
    if (this.indexCache && Date.now() - this.indexCache.at < 5 * 60_000) return this.indexCache.html
    const res = await fetch(`${process.env.STOREFRONT_INTERNAL_URL || 'http://storefront'}/index.html`)
    if (!res.ok) throw new Error(`index.html do storefront respondeu ${res.status}`)
    const html = await res.text()
    this.indexCache = { html, at: Date.now() }
    return html
  }

  async findProductByErpId(erpProductId: number) {
    return this.prisma.product.findFirst({ where: { erpProductId }, select: PRODUCT_SELECT })
  }

  async findProductById(id: string) {
    return this.prisma.product.findFirst({ where: { id }, select: PRODUCT_SELECT })
  }

  async renderProductPage(product: NonNullable<Awaited<ReturnType<SeoService['findProductByErpId']>>>) {
    const html = await this.getIndexHtml()
    const url = `${this.siteUrl}${productPath(product)}`
    const image = `${this.siteUrl}/uploads/products/${product.ean}.webp`
    const promo = product.promotionalPrice && product.promotionalPrice < product.price ? product.promotionalPrice : null
    const price = promo ?? product.price
    const unit = product.isFractional ? '/kg' : ''
    const sellable = isProductSellable(product)
    const category = product.category === 'ADEGA_VINHOS_ESPUMANTES' ? 'Adega' : product.ecommerceCategory || ''
    const categoryUrl =
      product.category === 'ADEGA_VINHOS_ESPUMANTES'
        ? `${this.siteUrl}/adega`
        : `${this.siteUrl}/mercado?cat=${String(product.category || '').toLowerCase().replace(/_/g, '-')}`
    const title = `${product.name} | Antenor & Filhos`
    const description =
      product.alternativeDescription ||
      `${product.name} por ${brl(price)}${unit} no Antenor & Filhos. Peça pelo site e receba em casa.`

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description,
        image,
        sku: String(product.erpProductId ?? product.ean),
        gtin: product.ean,
        category: category || undefined,
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'BRL',
          price: price.toFixed(2),
          availability: sellable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'Antenor & Filhos' },
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${this.siteUrl}/` },
          ...(category ? [{ '@type': 'ListItem', position: 2, name: category, item: categoryUrl }] : []),
          { '@type': 'ListItem', position: category ? 3 : 2, name: product.name },
        ],
      },
    ]

    const head = [
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<link rel="canonical" href="${escapeHtml(url)}" />`,
      `<meta property="og:site_name" content="Antenor &amp; Filhos" />`,
      `<meta property="og:type" content="product" />`,
      `<meta property="og:title" content="${escapeHtml(product.name)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(url)}" />`,
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta property="product:price:amount" content="${price.toFixed(2)}" />`,
      `<meta property="product:price:currency" content="BRL" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<script type="application/ld+json">${safeJson(jsonLd)}</script>`,
    ].join('\n    ')

    // Conteudo legivel sem JS (Google, preview); o React substitui ao montar.
    const body = `<main><nav><a href="${this.siteUrl}/">Início</a>${category ? ` › <a href="${escapeHtml(categoryUrl)}">${escapeHtml(category)}</a>` : ''}</nav><h1>${escapeHtml(product.name)}</h1><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" width="400" height="400" /><p>${escapeHtml(brl(price))}${unit}</p><p>${escapeHtml(description)}</p></main>`

    return html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name="description"[^>]*>/i, '')
      .replace(/<link\s+rel="canonical"[^>]*>/i, '')
      .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
      .replace('</head>', `    ${head}\n  </head>`)
      .replace(/<div id="root">\s*<\/div>/, `<div id="root">${body}</div>`)
  }

  async buildSitemap(): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { active: true, syncOption: { not: 'NUNCA' }, erpProductId: { not: null } },
      select: { id: true, name: true, erpProductId: true, updatedAt: true, category: true },
    })
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
    // So receita publicada (agendada ainda nao); sem nenhuma, /receitas fica fora.
    const recipes = await this.prisma.recipe.findMany({
      where: { active: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      select: { slug: true, updatedAt: true },
    })

    const entry = (loc: string, opts: { lastmod?: Date; changefreq?: string; priority?: string } = {}) =>
      `  <url><loc>${escapeHtml(loc)}</loc>${opts.lastmod ? `<lastmod>${opts.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}${opts.changefreq ? `<changefreq>${opts.changefreq}</changefreq>` : ''}${opts.priority ? `<priority>${opts.priority}</priority>` : ''}</url>`

    const s = this.siteUrl
    const urls = [
      entry(`${s}/`, { changefreq: 'daily', priority: '1.0' }),
      entry(`${s}/mercado`, { changefreq: 'daily', priority: '0.9' }),
      entry(`${s}/adega`, { changefreq: 'weekly', priority: '0.8' }),
      entry(`${s}/promocoes`, { changefreq: 'daily', priority: '0.8' }),
      ...(recipes.length ? [entry(`${s}/receitas`, { changefreq: 'weekly', priority: '0.6' })] : []),
      ...categories.map((c) => entry(`${s}/mercado?cat=${String(c).toLowerCase().replace(/_/g, '-')}`, { changefreq: 'daily', priority: '0.8' })),
      ...products.map((p) => entry(`${s}${productPath(p)}`, { lastmod: p.updatedAt, changefreq: 'weekly', priority: '0.7' })),
      ...recipes.map((r) => entry(`${s}/receitas/${r.slug}`, { lastmod: r.updatedAt, changefreq: 'monthly', priority: '0.5' })),
    ]
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  }

  async fallbackIndex() {
    try {
      return await this.getIndexHtml()
    } catch (error) {
      this.logger.warn(`seo_index_indisponivel: ${error instanceof Error ? error.message : error}`)
      return null
    }
  }
}
