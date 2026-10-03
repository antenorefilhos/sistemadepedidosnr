import { isSoldOnDay, normalizeSaleWeekdays, saleDaysLabel, weekdayOf } from './sale-days'

describe('dias de venda do produto', () => {
  it('quinta a domingo vira um intervalo so, passando do sabado para o domingo', () => {
    expect(saleDaysLabel([0, 4, 5, 6])).toBe('de quinta a domingo')
    expect(saleDaysLabel([1, 2, 3, 4, 5])).toBe('de segunda a sexta')
  })

  it('dias soltos com o artigo certo', () => {
    expect(saleDaysLabel([2, 4])).toBe('às terças e quintas')
    expect(saleDaysLabel([6])).toBe('aos sábados')
    expect(saleDaysLabel([0, 6])).toBe('aos sábados e domingos')
    expect(saleDaysLabel([5, 6])).toBe('às sextas e aos sábados')
  })

  it('vazio ou os sete dias = todos os dias', () => {
    expect(saleDaysLabel([])).toBe('todos os dias')
    expect(normalizeSaleWeekdays([0, 1, 2, 3, 4, 5, 6])).toEqual([])
    expect(normalizeSaleWeekdays([6, 4, '5', 9, -1, 4.5, 0])).toEqual([0, 4, 5, 6])
  })

  it('o dia vale pelo calendario de Brasilia', () => {
    expect(weekdayOf('2026-10-03')).toBe(6) // sabado
    expect(weekdayOf('2026-10-07')).toBe(3) // quarta
    const pizza = { saleWeekdays: [0, 4, 5, 6] }
    expect(isSoldOnDay(pizza, '2026-10-03')).toBe(true)
    expect(isSoldOnDay(pizza, '2026-10-07')).toBe(false)
    expect(isSoldOnDay({ saleWeekdays: [] }, '2026-10-07')).toBe(true)
    expect(isSoldOnDay({}, '2026-10-07')).toBe(true)
  })
})
