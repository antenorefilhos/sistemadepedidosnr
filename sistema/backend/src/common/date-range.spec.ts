import { BadRequestException } from '@nestjs/common'
import { validateDateRangeParams } from './date-range'

describe('validateDateRangeParams', () => {
  it('aceita um periodo valido e devolve as strings', () => {
    expect(validateDateRangeParams('2026-09-01', '2026-09-15')).toEqual({ from: '2026-09-01', to: '2026-09-15' })
  })

  it.each([
    ['sem from', undefined, '2026-09-15'],
    ['sem to', '2026-09-01', undefined],
    ['formato errado', '01/09/2026', '2026-09-15'],
    ['data invalida', '2026-13-40', '2026-09-15'],
  ])('rejeita %s', (_label, from, to) => {
    expect(() => validateDateRangeParams(from, to)).toThrow(BadRequestException)
  })

  it('rejeita data inicial depois da final', () => {
    expect(() => validateDateRangeParams('2026-09-15', '2026-09-01')).toThrow(BadRequestException)
  })

  it('rejeita periodo maior que o teto (protege consulta sem paginacao)', () => {
    expect(() => validateDateRangeParams('2025-01-01', '2026-09-15', 366)).toThrow(BadRequestException)
  })

  it('aceita exatamente no teto', () => {
    expect(() => validateDateRangeParams('2026-01-01', '2026-12-31', 366)).not.toThrow()
  })
})
