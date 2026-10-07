import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { isProductSellable } from '../../common/product-availability'
import { categoryCodeFromName } from '../../common/not-offered-categories'

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
  private departmentCache: { names: Map<string, string>; at: number } | null = null

  constructor(private readonly prisma: PrismaService) {}

  get siteUrl() {
    return String(process.env.FRONTEND_URL || 'https://mercado.antenorefilhos.com.br').replace(/\/+$/, '')
  }

  /**
   * index.html do build do storefront. Cache CURTO de proposito (03/10/2026):
   * com 5 min, depois de cada deploy a pagina de produto seguia apontando para
   * os .js do build anterior, que ja nao existem no container novo -- a pagina
   * abria em branco ou com o codigo velho por ate 5 min. Buscar o arquivo na
   * rede interna a cada 30 s custa nada.
   */
  private async getIndexHtml(): Promise<string> {
    if (this.indexCache && Date.now() - this.indexCache.at < 30_000) return this.indexCache.html
    const res = await fetch(`${process.env.STOREFRONT_INTERNAL_URL || 'http://storefront'}/index.html`)
    if (!res.ok) throw new Error(`index.html do storefront respondeu ${res.status}`)
    const html = await res.text()
    this.indexCache = { html, at: Date.now() }
    return html
  }

  /**
   * Nome do departamento pelo codigo do produto ("Queijos, Frios & Laticinios").
   * Ate 07/10/2026 o caminho mostrava o `ecommerceCategory` ("Manteigas &
   * Requeijao") com link para o departamento inteiro: o nome nao batia com a
   * pagina que abria. O site nao tem pagina de subsecao.
   */
  private async departmentName(code: string | null): Promise<string> {
    if (!code) return ''
    if (!this.departmentCache || Date.now() - this.departmentCache.at > 300_000) {
      const rows = await this.prisma.category.findMany({ where: { parentId: null, active: true }, select: { name: true } })
      this.departmentCache = { names: new Map(rows.map((r) => [categoryCodeFromName(r.name), r.name])), at: Date.now() }
    }
    return this.departmentCache.names.get(code) || ''
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
    const category = product.category === 'ADEGA_VINHOS_ESPUMANTES' ? 'Adega' : await this.departmentName(product.category)
    const categoryUrl =
      product.category === 'ADEGA_VINHOS_ESPUMANTES'
        ? `${this.siteUrl}/adega`
        : `${this.siteUrl}/mercado?cat=${String(product.category || '').toLowerCase().replace(/_/g, '-')}`
    const title = `${product.name} | Antenor & Filhos`
    // O alternativeDescription do ERP e nota de fracionamento ("Precos de
    // produtos pesaveis podem sofrer variacao"), nao descricao: ia parar no
    // Google e na previa do WhatsApp (07/10/2026).
    const description = `${product.name} por ${brl(price)}${unit} no Antenor & Filhos. Peça pelo site e receba em casa.`

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description,
        image,
        sku: String(product.erpProductId ?? product.ean),
        // GTIN so quando e codigo de barras de verdade (8 a 14 digitos). Peso e
        // producao propria usam codigo interno curto (ex.: 1909), que o Google
        // acusa como GTIN invalido.
        gtin: /^\d{8,14}$/.test(product.ean || '') ? product.ean : undefined,
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
      .replace(/<meta\s+name="twitter:card"[^>]*>/gi, '')
      .replace('</head>', `    ${head}\n  </head>`)
      .replace(/<div id="root">\s*<\/div>/, `<div id="root">${body}</div>`)
  }

  /** Receita publicada (agendada ainda nao), com o que a pagina precisa. */
  async findPublishedRecipe(slug: string) {
    return this.prisma.recipe.findFirst({
      where: { slug, active: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      include: { category: true, ingredients: { orderBy: { order: 'asc' } }, steps: { orderBy: { order: 'asc' } } },
    })
  }

  /**
   * Receita pronta no HTML (29/09/2026): link compartilhado no WhatsApp mostra
   * foto, titulo e descricao, e o Google le ingredientes e preparo (Recipe).
   */
  async renderRecipePage(recipe: NonNullable<Awaited<ReturnType<SeoService['findPublishedRecipe']>>>) {
    const html = await this.getIndexHtml()
    const url = `${this.siteUrl}/receitas/${recipe.slug}`
    const abs = (u?: string | null) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${this.siteUrl}${u.startsWith('/') ? '' : '/'}${u}`)
    const image = abs(recipe.imageUrl)
    const title = `${recipe.seoTitle || recipe.title} | Receitas Antenor & Filhos`
    const description =
      recipe.seoDescription || recipe.description || `Receita de ${recipe.title} com ingredientes do Mercado Antenor & Filhos.`
    const ingredientLine = (i: { quantity: string | null; unit: string | null; name: string }) => [i.quantity, i.unit, i.name].filter(Boolean).join(' ')

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description,
        image: image || undefined,
        author: { '@type': 'Organization', name: 'Antenor & Filhos' },
        datePublished: (recipe.publishedAt || recipe.createdAt).toISOString().slice(0, 10),
        ...(recipe.prepTime ? { totalTime: `PT${recipe.prepTime}M` } : {}),
        ...(recipe.servings ? { recipeYield: `${recipe.servings} porções` } : {}),
        ...(recipe.category ? { recipeCategory: recipe.category.name } : {}),
        recipeIngredient: recipe.ingredients.map(ingredientLine),
        recipeInstructions: recipe.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s.content })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Receitas', item: `${this.siteUrl}/receitas` },
          { '@type': 'ListItem', position: 2, name: recipe.title },
        ],
      },
    ]

    const head = [
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<link rel="canonical" href="${escapeHtml(url)}" />`,
      `<meta property="og:site_name" content="Antenor &amp; Filhos" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:title" content="${escapeHtml(recipe.title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(url)}" />`,
      ...(image
        ? [`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta property="og:image:width" content="1600" />`, `<meta property="og:image:height" content="900" />`]
        : []),
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<script type="application/ld+json">${safeJson(jsonLd)}</script>`,
    ].join('\n    ')

    const body = `<main><nav><a href="${this.siteUrl}/receitas">Receitas</a></nav><h1>${escapeHtml(recipe.title)}</h1>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(recipe.title)}" width="1600" height="900" />` : ''}<p>${escapeHtml(description)}</p><h2>Ingredientes</h2><ul>${recipe.ingredients.map((i) => `<li>${escapeHtml(ingredientLine(i))}</li>`).join('')}</ul><h2>Modo de preparo</h2><ol>${recipe.steps.map((s) => `<li>${escapeHtml(s.content)}</li>`).join('')}</ol></main>`

    return html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name="description"[^>]*>/i, '')
      .replace(/<link\s+rel="canonical"[^>]*>/i, '')
      .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
      .replace(/<meta\s+name="twitter:card"[^>]*>/gi, '')
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
