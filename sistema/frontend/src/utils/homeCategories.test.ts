import { describe, it, expect } from 'vitest'
import { resolveBannerLink, buildOverlayGradient } from './homeCategories'

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
      'linear-gradient(to right, rgba(93, 8, 42, 0.49) 0%, rgba(93, 8, 42, 0.27) 45%, transparent 100%)',
    )
    expect(gradient).not.toMatch(/\)[0-9a-f]{2}\s/i) // nunca concatena sufixo hex numa rgba()
  })

  it('mantem compatibilidade com overlayColor hex antigo (mesmos stops de sempre)', () => {
    expect(buildOverlayGradient('#231F20')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 0.82) 0%, rgba(35, 31, 32, 0.45) 45%, transparent 100%)',
    )
  })

  it('hex de 3 digitos expande corretamente', () => {
    expect(buildOverlayGradient('#fff')).toBe(
      'linear-gradient(to right, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.45) 45%, transparent 100%)',
    )
  })

  it('valor irreconhecivel cai no default (marrom Antenor) em vez de gerar CSS quebrado', () => {
    expect(buildOverlayGradient('nao-e-uma-cor')).toBe(
      'linear-gradient(to right, rgba(35, 31, 32, 0.82) 0%, rgba(35, 31, 32, 0.45) 45%, transparent 100%)',
    )
  })
})
