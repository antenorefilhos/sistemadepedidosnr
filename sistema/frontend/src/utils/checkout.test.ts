import { describe, it, expect } from 'vitest'
import type { CheckoutQuoteResponse } from '../services/api'
import { getCheckoutBlockerMessage } from './checkout'

/**
 * O cliente travou no checkout em 02/09/2026 com "alguns itens ficaram
 * indisponiveis" e sem saber qual item mexer (era um vinho: pediu 6, havia 3).
 * O dado sempre esteve no quote -- so nao chegava ao texto do erro.
 */
const quote = (over: Record<string, unknown> = {}) =>
  ({
    stock: { unavailableItems: [], items: [] },
    delivery: { outOfArea: false, validSlot: true },
    blockers: [],
    ...over,
  }) as unknown as CheckoutQuoteResponse

const nome = (id: string) => ({ p1: 'VINHO ROSE ADOBE 750ml' })[id]

describe('getCheckoutBlockerMessage', () => {
  it('nomeia o item e mostra pedido x disponivel', () => {
    const msg = getCheckoutBlockerMessage(
      quote({ stock: { unavailableItems: [{ productId: 'p1', requested: 6, available: 3 }], items: [] } }),
      nome,
    )
    expect(msg).toContain('VINHO ROSE ADOBE 750ml')
    expect(msg).toContain('voce pediu 6')
    expect(msg).toContain('temos 3')
  })

  it('sem estoque nenhum diz esgotado, nao "temos 0"', () => {
    const msg = getCheckoutBlockerMessage(
      quote({ stock: { unavailableItems: [{ productId: 'p1', requested: 2, available: 0 }], items: [] } }),
      nome,
    )
    expect(msg).toContain('esgotado')
  })

  // Produto removido do carrinho local entre o quote e o erro: nao pode
  // quebrar nem imprimir um id cru na cara do cliente.
  it('cai num rotulo generico quando o nome nao resolve', () => {
    const msg = getCheckoutBlockerMessage(
      quote({ stock: { unavailableItems: [{ productId: 'sumiu', requested: 1, available: 0 }], items: [] } }),
      nome,
    )
    expect(msg).toContain('Item do carrinho')
    expect(msg).not.toContain('sumiu')
  })

  it('lista todos os itens, nao so o primeiro', () => {
    const msg = getCheckoutBlockerMessage(
      quote({
        stock: {
          unavailableItems: [
            { productId: 'p1', requested: 6, available: 3 },
            { productId: 'p2', requested: 1, available: 0 },
          ],
          items: [],
        },
      }),
      nome,
    )
    expect(msg.split(';')).toHaveLength(2)
  })

  it('estoque ok nao sequestra a mensagem de outro bloqueio', () => {
    expect(getCheckoutBlockerMessage(quote({ delivery: { outOfArea: true, validSlot: true } }), nome)).toContain(
      'fora da zona',
    )
  })
})
