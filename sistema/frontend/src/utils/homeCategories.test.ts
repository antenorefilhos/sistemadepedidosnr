import { describe, it, expect } from 'vitest'
import { resolveBannerLink } from './homeCategories'

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
