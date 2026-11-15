import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPurchaseParams, getMetaBrowserContext, trackPurchase } from './analytics'

// Mesmo pedido do spec do backend (meta-conversions.service.spec.ts): navegador e
// servidor precisam produzir o MESMO conteudo, senao a Meta nao deduplica o Purchase.
const order = {
  id: 'cmorder123',
  total: 87.9,
  delivery: 7,
  items: [
    { productId: 'p1', quantity: 2, unitPrice: 10.5 },
    { productId: 'p2', quantity: 0.8, unitPrice: 59.9, subtotal: 47.92 },
  ],
}

describe('Purchase do Meta Pixel', () => {
  afterEach(() => {
    delete (window as { fbq?: unknown }).fbq
    delete (window as { gtag?: unknown }).gtag
    document.cookie = '_fbp=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    document.cookie = '_fbc=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('monta content_ids, contents, num_items, content_type e valor em BRL', () => {
    expect(buildPurchaseParams(order)).toEqual({
      value: 87.9,
      currency: 'BRL',
      content_type: 'product',
      content_ids: ['p1', 'p2'],
      contents: [
        { id: 'p1', quantity: 2, item_price: 10.5 },
        { id: 'p2', quantity: 1, item_price: 47.92 },
      ],
      num_items: 3,
      order_id: 'cmorder123',
    })
  })

  it('manda eventID = id do pedido (e o event_id que o servidor repete)', () => {
    const fbq = vi.fn()
    ;(window as { fbq?: unknown }).fbq = fbq
    trackPurchase(order)
    expect(fbq).toHaveBeenCalledTimes(1)
    const [cmd, name, params, options] = fbq.mock.calls[0]
    expect(cmd).toBe('track')
    expect(name).toBe('Purchase')
    expect(params).toMatchObject({ currency: 'BRL', content_type: 'product', num_items: 3 })
    expect(options).toEqual({ eventID: 'cmorder123' })
  })

  it('sem pixel carregado (bloqueador) nao quebra', () => {
    expect(() => trackPurchase(order)).not.toThrow()
  })

  it('le os cookies _fbp e _fbc e a URL da pagina para o servidor', () => {
    document.cookie = '_fbp=fb.1.111.222; path=/'
    document.cookie = '_fbc=fb.1.333.AbC; path=/'
    const ctx = getMetaBrowserContext()
    expect(ctx.fbp).toBe('fb.1.111.222')
    expect(ctx.fbc).toBe('fb.1.333.AbC')
    expect(ctx.eventSourceUrl).toContain(window.location.host)
  })

  it('sem cookies devolve indefinido, nao string vazia', () => {
    const ctx = getMetaBrowserContext()
    expect(ctx.fbp).toBeUndefined()
    expect(ctx.fbc).toBeUndefined()
  })
})
