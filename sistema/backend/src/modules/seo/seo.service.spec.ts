import { SeoService, productPath } from './seo.service'
process.env.FRONTEND_URL = 'https://mercado.antenorefilhos.com.br'

const INDEX = '<html><head>\n<meta name="description" content="x" />\n<title>Antenor</title>\n<meta property="og:title" content="t" />\n</head><body><div id="root"></div><script src="/a.js"></script></body></html>'

const build = () => {
  const prisma = {
    product: { findMany: jest.fn(), findFirst: jest.fn() },
    recipe: { findMany: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([{ name: 'Queijos, Frios & Laticínios' }]) },
  }
  const service = new SeoService(prisma as never)
  ;(service as any).indexCache = { html: INDEX, at: Date.now() }
  return { service, prisma }
}

const vinho = {
  id: 'cabc', ean: '7804655290228', erpProductId: 22030, name: 'Vinho Tinto Chileno <Intacto> Syrah 750ml',
  alternativeDescription: null, price: 45, promotionalPrice: null, isFractional: false, unit: 'UN',
  category: 'ADEGA_VINHOS_ESPUMANTES', ecommerceCategory: 'Vinhos & Espumantes', active: true, syncOption: 'SEMPRE', stock: 0,
}

describe('SeoService', () => {
  it('entrega o HTML do produto preenchido para Google/WhatsApp, com nome escapado', async () => {
    const { service } = build()
    const html = await service.renderProductPage(vinho as never)
    expect(html).toContain('<title>Vinho Tinto Chileno &lt;Intacto&gt; Syrah 750ml | Antenor &amp; Filhos</title>')
    expect(html).toContain(`<link rel="canonical" href="https://mercado.antenorefilhos.com.br${productPath(vinho)}" />`)
    expect(html).toContain('"@type":"Product"')
    expect(html).toContain('<h1>Vinho Tinto Chileno &lt;Intacto&gt; Syrah 750ml</h1>')
    expect(html).not.toContain('<title>Antenor</title>')
    expect(html).not.toContain('content="t"')
    // JSON-LD nao pode fechar o <script> com um "<" do nome
    expect(html).not.toMatch(/ld\+json">[^<]*<Intacto/)
    expect(html).toContain('<script src="/a.js"></script>')
  })

  it('caminho usa o departamento e a descricao nunca e a nota de fracionamento do ERP (07/10/2026)', async () => {
    const { service } = build()
    const requeijao = {
      ...vinho, name: 'Requeijão Cremoso Tradicional Catupiry Pouch 250g', category: 'QUEIJOS_FRIOS_LATICINIOS',
      ecommerceCategory: 'Manteigas & Requeijão', alternativeDescription: 'Fracionamento: Preços de produtos pesáveis podem sofrer variação',
    }
    const html = await service.renderProductPage(requeijao as never)
    expect(html).toContain('"name":"Queijos, Frios & Laticínios"')
    expect(html).not.toContain('Manteigas')
    expect(html).not.toContain('Fracionamento')
    expect(html.match(/twitter:card/g)).toHaveLength(1)
  })

  it('sitemap lista produto pela URL limpa e as categorias', async () => {
    const { service, prisma } = build()
    prisma.product.findMany.mockResolvedValue([{ id: 'cabc', name: vinho.name, erpProductId: 22030, updatedAt: new Date('2026-09-27'), category: 'ADEGA_VINHOS_ESPUMANTES' }])
    const xml = await service.buildSitemap()
    expect(xml).toContain('/p/vinho-tinto-chileno-intacto-syrah-750ml-22030</loc>')
    expect(xml).toContain('/mercado?cat=adega-vinhos-espumantes')
  })
})
