import { describe, expect, it } from 'vitest'
import { isSoldOnWeekday, saleDaysLabel, saleDaysShort } from './saleDays'
import { getProductCardViewModel } from './productCard'
import { getFulfillmentWeekday, parseHoursConfig } from './deliveryOperation'

const pizza = { id: 'p', ean: '1', name: 'Pizza com Assadeira', price: 19.99, active: true, syncOption: 'SEMPRE' as const, stock: -5, saleWeekdays: [0, 4, 5, 6] }

describe('dias de venda', () => {
  it('rotulos', () => {
    expect(saleDaysLabel([0, 4, 5, 6])).toBe('de quinta a domingo')
    expect(saleDaysShort([0, 4, 5, 6])).toBe('qui a dom')
    expect(saleDaysLabel([5, 6])).toBe('às sextas e aos sábados')
    expect(saleDaysLabel([])).toBe('todos os dias')
  })

  it('card: fora do dia mostra o selo e nao deixa comprar', () => {
    const quarta = getProductCardViewModel(pizza, 3)
    expect(quarta.outOfStock).toBe(true)
    expect(quarta.offDay).toBe(true)
    expect(quarta.unavailableLabel).toBe('Só qui a dom')
    const sabado = getProductCardViewModel(pizza, 6)
    expect(sabado.outOfStock).toBe(false)
    expect(sabado.saleDaysText).toBe('de quinta a domingo')
    expect(isSoldOnWeekday({ saleWeekdays: [] }, 3)).toBe(true)
  })

  it('depois do fechamento vale o proximo dia aberto', () => {
    const config = parseHoursConfig(JSON.stringify({ 0: { enabled: true, windows: [{ start: '08:00', end: '13:00' }] }, 1: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] }, 2: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] }, 3: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] }, 4: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] }, 5: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] }, 6: { enabled: true, windows: [{ start: '07:00', end: '21:00' }] } }), null)
    expect(getFulfillmentWeekday(config, new Date('2026-10-07T15:00:00-03:00'))).toBe(3) // quarta, aberta
    expect(getFulfillmentWeekday(config, new Date('2026-10-07T22:00:00-03:00'))).toBe(4) // quarta depois de fechar -> quinta
  })
})

import { wineCardTitle, wineFacts, wineSubtitle, wineVolumeTag } from './wine'
describe('card da adega', () => {
  it('titulo e so o rotulo; volume fora do padrao vai para a linha de baixo', () => {
    expect(wineCardTitle('Vinho Tinto Argentino Luigi Bosca Malbec 750ml')).toBe('Luigi Bosca Malbec')
    expect(wineCardTitle('Espumante Nacional Chandon Réserve Brut 750ml')).toBe('Chandon Réserve Brut')
    expect(wineCardTitle('Espumante Nacional Sem Álcool Salton Zero Moscato 750ml')).toBe('Salton Zero Moscato')
    expect(wineCardTitle('Vinho Tinto Nacional Suave Galiotto Safra Especial 1L')).toBe('Galiotto Safra Especial')
    expect(wineCardTitle('Vinho Tinto Português Esporão Pé Tinto 750ml')).toBe('Esporão Pé Tinto')
    expect(wineVolumeTag('Vinho Tinto Nacional Suave Galiotto Safra Especial 1L')).toBe('1L')
    expect(wineVolumeTag('Vinho Tinto Argentino Luigi Bosca Malbec 750ml')).toBe('')
    const f = wineFacts({ name: 'Vinho Tinto Argentino Luigi Bosca Malbec 750ml', classification03: 'Vinho Tinto' })
    expect(wineSubtitle(f, 'Vinho Tinto Argentino Luigi Bosca Malbec 750ml')).toBe('Tinto · Malbec · Argentina')
  })
})
