import { isProductSellable } from './product-availability'

/**
 * Decisao do lojista (02/09/2026): o estoque do ERP governa EXIBICAO, nao
 * limite de quantidade. Antes disso o cliente montava o pedido inteiro e
 * levava "alguns itens ficaram indisponiveis" no fim -- caso real: vinho com
 * 3 em estoque, pediu 6.
 */
describe('isProductSellable', () => {
  it('ESTOQUE com saldo positivo vende', () => {
    expect(isProductSellable({ syncOption: 'ESTOQUE', stock: 1, active: true })).toBe(true)
  })

  it('ESTOQUE zerado ou negativo nao vende (some da vitrine)', () => {
    expect(isProductSellable({ syncOption: 'ESTOQUE', stock: 0 })).toBe(false)
    expect(isProductSellable({ syncOption: 'ESTOQUE', stock: -20 })).toBe(false)
  })

  // Carne/padaria: producao propria carrega estoque negativo no ERP de rotina.
  it('SEMPRE vende mesmo com estoque negativo', () => {
    expect(isProductSellable({ syncOption: 'SEMPRE', stock: -2897 })).toBe(true)
  })

  it('NUNCA nao vende, nem com estoque cheio', () => {
    expect(isProductSellable({ syncOption: 'NUNCA', stock: 500 })).toBe(false)
  })

  it('inativo nunca vende', () => {
    expect(isProductSellable({ syncOption: 'SEMPRE', stock: 10, active: false })).toBe(false)
  })

  // Typo real presente em dados legados do ERP; a vitrine ja trata, e divergir
  // aqui faria o produto aparecer na tela e o checkout recusar.
  it('trata o typo ESTQOUE igual a ESTOQUE', () => {
    expect(isProductSellable({ syncOption: 'ESTQOUE', stock: 0 })).toBe(false)
    expect(isProductSellable({ syncOption: 'ESTQOUE', stock: 5 })).toBe(true)
  })

  it('produto sem syncOption e vendavel (legado/manual, ERP nao opinou)', () => {
    expect(isProductSellable({ stock: 0 })).toBe(true)
  })
})
