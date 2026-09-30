import { hiddenReason, parseShelfDate } from './sponsored-shelves.service'

describe('parseShelfDate', () => {
  it('dia puro vale o dia inteiro em Brasilia', () => {
    expect(parseShelfDate('2026-10-05', 'start')?.toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(parseShelfDate('2026-10-05', 'end')?.toISOString()).toBe('2026-10-06T02:59:59.999Z')
  })
  it('vazio vira sem data; ISO completo passa direto', () => {
    expect(parseShelfDate('', 'start')).toBeNull()
    expect(parseShelfDate('2026-10-05T12:00:00.000Z', 'end')?.toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })
})

describe('hiddenReason', () => {
  it.each([
    [{ active: true, syncOption: 'SEMPRE', stock: -3, category: 'MERCEARIA' }, null],
    [{ active: true, syncOption: 'ESTOQUE', stock: 0, category: 'MERCEARIA' }, 'Sem estoque'],
    [{ active: false, syncOption: 'SEMPRE', stock: 5, category: 'MERCEARIA' }, 'Oculto no site'],
    [{ active: true, syncOption: 'NUNCA', stock: 5, category: 'MERCEARIA' }, 'Marcado para não vender online no ERP'],
    [{ active: true, syncOption: 'SEMPRE', stock: 5, category: 'TABACARIA' }, 'Tabacaria não sai em vitrine'],
  ])('%o -> %s', (product, reason) => {
    expect(hiddenReason(product)).toBe(reason)
  })
})
