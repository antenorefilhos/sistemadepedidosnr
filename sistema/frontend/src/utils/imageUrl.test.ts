import { describe, expect, it } from 'vitest'
import { sizedImageUrl } from './imageUrl'

describe('imagem na largura da tela', () => {
  it('envio do admin vira a variante da API, relativo ou absoluto', () => {
    expect(sizedImageUrl('/uploads/a834cc03-af24.webp', 640)).toBe('/thumbs/uploads/a834cc03-af24.webp?w=640')
    expect(sizedImageUrl('https://api.antenorefilhos.com.br/uploads/seed-banner-popup-cupom.webp', 800))
      .toBe('https://api.antenorefilhos.com.br/thumbs/uploads/seed-banner-popup-cupom.webp?w=800')
    expect(sizedImageUrl('/api/uploads/x.jpg?v=2', 480)).toBe('/api/thumbs/uploads/x.jpg?w=480')
  })

  it('foto de produto e outro site passam direto', () => {
    expect(sizedImageUrl('/uploads/products/789.webp', 640)).toBe('/uploads/products/789.webp')
    expect(sizedImageUrl('https://exemplo.com/a.jpg', 640)).toBe('https://exemplo.com/a.jpg')
  })

  it('unsplash troca a largura', () => {
    expect(sizedImageUrl('https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1600&q=80', 800))
      .toBe('https://images.unsplash.com/photo-1?auto=format&fit=crop&w=800&q=70')
  })

  it('vazio', () => {
    expect(sizedImageUrl(null, 800)).toBeNull()
  })
})
