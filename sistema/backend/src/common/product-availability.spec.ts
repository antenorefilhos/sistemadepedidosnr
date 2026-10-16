import { isProductSellable, resolveSiteVisibility } from './product-availability'

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

describe('applySiteVisibility', () => {
  const { applySiteVisibility } = require('./product-availability')
  it('segue o ERP sem ajuste', () => {
    expect(applySiteVisibility({ active: true, syncOption: 'ESTOQUE' }, null)).toEqual({ active: true, syncOption: 'ESTOQUE' })
  })
  it('OCULTO tira do site mesmo ativo no ERP', () => {
    expect(applySiteVisibility({ active: true, syncOption: 'SEMPRE' }, 'OCULTO').active).toBe(false)
  })
  it('SEMPRE vende sem estoque, mas nao reativa inativo no ERP', () => {
    expect(applySiteVisibility({ active: true, syncOption: 'ESTOQUE' }, 'SEMPRE')).toEqual({ active: true, syncOption: 'SEMPRE' })
    expect(applySiteVisibility({ active: false, syncOption: 'ESTOQUE' }, 'SEMPRE').active).toBe(false)
  })
})

/**
 * "Ocultar até" (16/10/2026): reverte a exibicao de um produto vendido por
 * erro no PDV sem exigir volta manual -- ver CLAUDE.md.
 */
describe('resolveSiteVisibility', () => {
  it('sem prazo, OCULTO vale para sempre', () => {
    expect(resolveSiteVisibility('OCULTO', null)).toBe('OCULTO')
  })

  it('prazo no futuro, OCULTO continua valendo', () => {
    const amanha = new Date(Date.now() + 86_400_000)
    expect(resolveSiteVisibility('OCULTO', amanha)).toBe('OCULTO')
  })

  it('prazo vencido, volta a seguir o ERP (null)', () => {
    const ontem = new Date(Date.now() - 86_400_000)
    expect(resolveSiteVisibility('OCULTO', ontem)).toBeNull()
  })

  it('prazo so vale para OCULTO -- SEMPRE nunca expira por data', () => {
    const ontem = new Date(Date.now() - 86_400_000)
    expect(resolveSiteVisibility('SEMPRE', ontem)).toBe('SEMPRE')
  })

  it('sem siteVisibility, segue o ERP independente de prazo', () => {
    expect(resolveSiteVisibility(null, new Date(Date.now() - 86_400_000))).toBeNull()
  })
})
