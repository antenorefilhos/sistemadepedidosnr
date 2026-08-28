import { describe, it, expect } from 'vitest'
import {
  resolveBannerLink,
  buildOverlayGradient,
  buildOverlaySolid,
  findCategoryBanner,
  findWineCategoryBanner,
  bannerAppearsOnPage,
} from './homeCategories'

describe('resolveBannerLink', () => {
  it('resolve produto para /produto/:id, nao pra filtro de categoria', () => {
    expect(resolveBannerLink('cmspojqwu000eo6fecglzp23m', 'product')).toBe(
      '/produto/cmspojqwu000eo6fecglzp23m',
    )
  })

  it('mantem URL externa intacta', () => {
    expect(resolveBannerLink('https://exemplo.com/promo', 'url')).toBe('https://exemplo.com/promo')
  })

  it('mantem rota relativa ja formatada', () => {
    expect(resolveBannerLink('/promocoes', 'url')).toBe('/promocoes')
  })

  it('categoria com acento e maiuscula vira slug valido', () => {
    expect(resolveBannerLink('Padaria, Confeitaria & Café', 'category')).toBe(
      '/mercado?cat=padaria-confeitaria-cafe',
    )
  })

  it('categoria de vinho/adega sempre cai em /adega', () => {
    expect(resolveBannerLink('Adega, Vinhos & Espumantes', 'category')).toBe('/adega')
    expect(resolveBannerLink('vinho', 'category')).toBe('/adega')
  })

  it('sem linkValue cai no fallback /mercado', () => {
    expect(resolveBannerLink(undefined, 'category')).toBe('/mercado')
    expect(resolveBannerLink('   ', 'category')).toBe('/mercado')
  })
})

describe('buildOverlayGradient', () => {
  it('gera gradiente valido (sem sufixo de hex colado) a partir de rgba() do color picker', () => {
    const gradient = buildOverlayGradient('rgba(93, 8, 42, 0.6)')
    expect(gradient).toBe(
      'linear-gradient(to right, rgba(93, 8, 42, 0.60) 0%, rgba(93, 8, 42, 0.45) 55%, transparent 100%)',
    )
    expect(gradient).not.toMatch(/\)[0-9a-f]{2}\s/i) // nunca concatena sufixo hex numa rgba()
  })

  it('mantem compatibilidade com overlayColor hex antigo', () => {
    expect(buildOverlayGradient('#231F20')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 1.00) 0%, rgba(35, 31, 32, 0.75) 55%, transparent 100%)',
    )
  })

  it('hex de 3 digitos expande corretamente', () => {
    expect(buildOverlayGradient('#fff')).toBe(
      'linear-gradient(to right, rgba(255, 255, 255, 1.00) 0%, rgba(255, 255, 255, 0.75) 55%, transparent 100%)',
    )
  })

  it('valor irreconhecivel cai no default (marrom Antenor) em vez de gerar CSS quebrado', () => {
    expect(buildOverlayGradient('nao-e-uma-cor')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 1.00) 0%, rgba(35, 31, 32, 0.75) 55%, transparent 100%)',
    )
  })

  // A direcao tem que seguir o alinhamento: com `to right` fixo, um banner
  // align=right escurecia o lado vazio e deixava o texto sobre a parte clara.
  it('align=right inverte a direcao pra escurecer o lado do texto', () => {
    expect(buildOverlayGradient('#231F20', 'right')).toBe(
      'linear-gradient(to left, rgba(35, 31, 32, 1.00) 0%, rgba(35, 31, 32, 0.75) 55%, transparent 100%)',
    )
  })

  it('align=center usa gradiente vertical (nao ha lado livre pra foto)', () => {
    expect(buildOverlayGradient('#231F20', 'center')).toBe(
      'linear-gradient(to bottom, rgba(35, 31, 32, 1.00) 0%, rgba(35, 31, 32, 0.60) 50%, rgba(35, 31, 32, 1.00) 100%)',
    )
  })

  it('sem align explicito continua se comportando como left', () => {
    expect(buildOverlayGradient('#231F20')).toBe(buildOverlayGradient('#231F20', 'left'))
  })
})

describe('buildOverlaySolid', () => {
  it('gera rgba solido a partir do rgba() do color picker, aplicando o multiplicador de alpha', () => {
    expect(buildOverlaySolid('rgba(93, 8, 42, 0.6)')).toBe('rgba(93, 8, 42, 0.43)')
  })

  it('nunca ultrapassa alpha 1 mesmo com tone e multiplicador altos', () => {
    expect(buildOverlaySolid('rgba(0, 0, 0, 1)', 1.5)).toBe('rgba(0, 0, 0, 1.00)')
  })

  it('aceita hex e usa o multiplicador default (0.72)', () => {
    expect(buildOverlaySolid('#231F20')).toBe('rgba(35, 31, 32, 0.72)')
  })
})

describe('findCategoryBanner', () => {
  const banner = (over: Record<string, unknown> = {}) => ({
    id: 'b1',
    slot: 'category',
    active: true,
    targetCategory: 'Acougue Churrasco',
    desktopImageUrl: '/uploads/x.webp',
    order: 0,
    ...over,
  })

  // O codigo vem da URL ja normalizado (?cat=acougue-churrasco ->
  // ACOUGUE_CHURRASCO), enquanto targetCategory guarda o nome como cadastrado.
  it('casa o nome cadastrado com o codigo normalizado da URL', () => {
    expect(findCategoryBanner([banner()], 'ACOUGUE_CHURRASCO')?.id).toBe('b1')
  })

  it('ignora acento, caixa e hifen dos dois lados', () => {
    expect(findCategoryBanner([banner({ targetCategory: 'AÇOUGUE CHURRASCO' })], 'acougue-churrasco')?.id).toBe('b1')
    expect(findCategoryBanner([banner({ targetCategory: 'açougue_churrasco' })], 'Acougue Churrasco')?.id).toBe('b1')
  })

  // Caso real: em producao a categoria se chama "Açougue & Churrasco" e a URL
  // traz acougue-churrasco. O "&" tem que colapsar no mesmo separador dos dois
  // lados, senao o banner nunca aparece la (e aparece no ambiente local, onde
  // o nome nao tem "&") -- o tipo de divergencia que so apareceria em producao.
  it('casa nome com "&" e espacos com o codigo da URL', () => {
    expect(findCategoryBanner([banner({ targetCategory: 'Açougue & Churrasco' })], 'ACOUGUE_CHURRASCO')?.id).toBe('b1')
    expect(findCategoryBanner([banner({ targetCategory: 'Açougue & Churrasco' })], 'acougue-churrasco')?.id).toBe('b1')
  })

  it('nao casa categoria diferente', () => {
    expect(findCategoryBanner([banner()], 'HORTIFRUTI_ORGANICOS')).toBeUndefined()
  })

  it('nao vaza banner de outro slot com a mesma categoria', () => {
    expect(findCategoryBanner([banner({ slot: 'hero' })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
    expect(findCategoryBanner([banner({ slot: 'intercalado' })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
  })

  it('ignora banner inativo ou sem foto', () => {
    expect(findCategoryBanner([banner({ active: false })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
    expect(findCategoryBanner([banner({ desktopImageUrl: '' })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
    expect(findCategoryBanner([banner({ desktopImageUrl: undefined })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
  })

  it('ignora banner de categoria sem targetCategory preenchido', () => {
    expect(findCategoryBanner([banner({ targetCategory: null })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
    expect(findCategoryBanner([banner({ targetCategory: '' })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
  })

  // Sem categoria na URL a pagina e busca livre/catalogo geral -- nao ha
  // categoria pra anunciar, entao nenhum banner deve aparecer.
  it('sem categoria (busca livre) nao devolve banner', () => {
    expect(findCategoryBanner([banner()], undefined)).toBeUndefined()
    expect(findCategoryBanner([banner()], '')).toBeUndefined()
    expect(findCategoryBanner([banner()], '   ')).toBeUndefined()
  })

  it('lida com lista ausente ou vazia sem quebrar', () => {
    expect(findCategoryBanner(undefined, 'ACOUGUE_CHURRASCO')).toBeUndefined()
    expect(findCategoryBanner([], 'ACOUGUE_CHURRASCO')).toBeUndefined()
  })

  // Dois banners na mesma categoria: escolha estavel pelo order do admin, pra
  // nao alternar entre eles a cada render.
  it('com mais de um na mesma categoria, escolhe o de menor order', () => {
    const escolhido = findCategoryBanner(
      [banner({ id: 'b-depois', order: 5 }), banner({ id: 'b-antes', order: 1 })],
      'ACOUGUE_CHURRASCO',
    )
    expect(escolhido?.id).toBe('b-antes')
  })
})

describe('findWineCategoryBanner', () => {
  const wine = (over: Record<string, unknown> = {}) => ({
    id: 'w1',
    slot: 'category',
    active: true,
    targetCategory: 'Adega Vinhos Espumantes',
    desktopImageUrl: '/uploads/x.webp',
    order: 0,
    ...over,
  })

  // A Adega tem rota propria (/adega), sem ?cat= -- por isso a regra e por
  // nome, a mesma que resolveBannerLink usa pra mandar o CTA pra /adega.
  it('acha o banner da Adega pelo nome da categoria', () => {
    expect(findWineCategoryBanner([wine()])?.id).toBe('w1')
    expect(findWineCategoryBanner([wine({ targetCategory: 'Vinhos' })])?.id).toBe('w1')
    expect(findWineCategoryBanner([wine({ targetCategory: 'ADEGA' })])?.id).toBe('w1')
  })

  it('nao pega banner de outra categoria', () => {
    expect(findWineCategoryBanner([wine({ targetCategory: 'Acougue Churrasco' })])).toBeUndefined()
    expect(findWineCategoryBanner([wine({ targetCategory: 'Cervejas Chopp' })])).toBeUndefined()
  })

  it('respeita slot, ativo e foto', () => {
    expect(findWineCategoryBanner([wine({ slot: 'hero' })])).toBeUndefined()
    expect(findWineCategoryBanner([wine({ active: false })])).toBeUndefined()
    expect(findWineCategoryBanner([wine({ desktopImageUrl: '' })])).toBeUndefined()
  })

  it('lida com lista ausente ou vazia sem quebrar', () => {
    expect(findWineCategoryBanner(undefined)).toBeUndefined()
    expect(findWineCategoryBanner([])).toBeUndefined()
  })
})

// Admin e storefront sao pacotes npm separados e cada imagem Docker builda com
// o contexto na propria pasta, entao a tinta do overlay e duplicada de
// proposito (ver o cabecalho de admin/src/utils/bannerOverlay.ts). Este bloco e
// o que impede as duas copias de divergirem em silencio: os testes rodam no
// host, sem Docker, entao conseguem importar os dois lados e comparar.
describe('paridade com o preview do admin', () => {
  const TONES = ['#231F20', '#fff', 'rgba(93, 8, 42, 0.6)', 'rgba(15, 81, 50, 0.7)', 'nao-e-uma-cor']
  const ALIGNS = ['left', 'center', 'right'] as const

  it('buildOverlayGradient gera exatamente a mesma string nos dois pacotes', async () => {
    const admin = await import('../../../admin/src/utils/bannerOverlay')
    for (const tone of TONES) {
      for (const align of ALIGNS) {
        expect(admin.buildOverlayGradient(tone, align)).toBe(buildOverlayGradient(tone, align))
      }
      // sem align explicito (default) tambem precisa bater
      expect(admin.buildOverlayGradient(tone)).toBe(buildOverlayGradient(tone))
    }
  })

  it('buildOverlaySolid gera exatamente a mesma string nos dois pacotes', async () => {
    const admin = await import('../../../admin/src/utils/bannerOverlay')
    for (const tone of TONES) {
      expect(admin.buildOverlaySolid(tone)).toBe(buildOverlaySolid(tone))
      expect(admin.buildOverlaySolid(tone, 0.5)).toBe(buildOverlaySolid(tone, 0.5))
      expect(admin.buildOverlaySolid(tone, 1.5)).toBe(buildOverlaySolid(tone, 1.5))
    }
  })
})

describe('bannerAppearsOnPage', () => {
  it('respeita a pagina escolhida no admin', () => {
    expect(bannerAppearsOnPage('home', 'home')).toBe(true)
    expect(bannerAppearsOnPage('home', 'category')).toBe(false)
    expect(bannerAppearsOnPage('category', 'category')).toBe(true)
    expect(bannerAppearsOnPage('category', 'home')).toBe(false)
  })

  it('"Todas as paginas" vale em qualquer tela', () => {
    expect(bannerAppearsOnPage('all', 'home')).toBe(true)
    expect(bannerAppearsOnPage('all', 'category')).toBe(true)
  })

  // Ligar o filtro nao pode sumir com banner que ja estava no ar antes de o
  // campo passar a ser respeitado.
  it('banner sem pages definido continua aparecendo', () => {
    expect(bannerAppearsOnPage(undefined, 'home')).toBe(true)
    expect(bannerAppearsOnPage('', 'category')).toBe(true)
  })
})

describe('findCategoryBanner + pages', () => {
  const b = (over: Record<string, unknown> = {}) => ({
    id: 'b1', slot: 'category', active: true, targetCategory: 'Acougue Churrasco',
    desktopImageUrl: '/x.webp', order: 0, ...over,
  })

  it('banner de categoria marcado so pra home nao aparece na categoria', () => {
    expect(findCategoryBanner([b({ pages: 'home' })], 'ACOUGUE_CHURRASCO')).toBeUndefined()
  })

  it('aparece com pages=category, all, ou sem valor', () => {
    expect(findCategoryBanner([b({ pages: 'category' })], 'ACOUGUE_CHURRASCO')?.id).toBe('b1')
    expect(findCategoryBanner([b({ pages: 'all' })], 'ACOUGUE_CHURRASCO')?.id).toBe('b1')
    expect(findCategoryBanner([b()], 'ACOUGUE_CHURRASCO')?.id).toBe('b1')
  })
})
