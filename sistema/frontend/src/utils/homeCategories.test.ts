import { describe, it, expect } from 'vitest'
import { resolveBannerLink, buildOverlayGradient, buildOverlaySolid } from './homeCategories'

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
      'linear-gradient(to right, rgba(93, 8, 42, 0.51) 0%, rgba(93, 8, 42, 0.30) 55%, transparent 100%)',
    )
    expect(gradient).not.toMatch(/\)[0-9a-f]{2}\s/i) // nunca concatena sufixo hex numa rgba()
  })

  it('mantem compatibilidade com overlayColor hex antigo', () => {
    expect(buildOverlayGradient('#231F20')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 0.85) 0%, rgba(35, 31, 32, 0.50) 55%, transparent 100%)',
    )
  })

  it('hex de 3 digitos expande corretamente', () => {
    expect(buildOverlayGradient('#fff')).toBe(
      'linear-gradient(to right, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.50) 55%, transparent 100%)',
    )
  })

  it('valor irreconhecivel cai no default (marrom Antenor) em vez de gerar CSS quebrado', () => {
    expect(buildOverlayGradient('nao-e-uma-cor')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 0.85) 0%, rgba(35, 31, 32, 0.50) 55%, transparent 100%)',
    )
  })

  // A direcao tem que seguir o alinhamento: com `to right` fixo, um banner
  // align=right escurecia o lado vazio e deixava o texto sobre a parte clara.
  it('align=right inverte a direcao pra escurecer o lado do texto', () => {
    expect(buildOverlayGradient('#231F20', 'right')).toBe(
      'linear-gradient(to left, rgba(35, 31, 32, 0.85) 0%, rgba(35, 31, 32, 0.50) 55%, transparent 100%)',
    )
  })

  it('align=center usa gradiente vertical (nao ha lado livre pra foto)', () => {
    expect(buildOverlayGradient('#231F20', 'center')).toBe(
      'linear-gradient(to bottom, rgba(35, 31, 32, 0.75) 0%, rgba(35, 31, 32, 0.45) 50%, rgba(35, 31, 32, 0.75) 100%)',
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
