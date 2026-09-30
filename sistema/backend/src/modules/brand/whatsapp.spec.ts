import { BadRequestException } from '@nestjs/common'
import { normalizeWhatsapp } from './brand.service'

describe('normalizeWhatsapp', () => {
  it.each([
    ['(24) 99218-6056', '5524992186056'],
    ['5524992186056', '5524992186056'],
    ['+55 24 99218-6056', '5524992186056'],
    ['24 2237-7205', '552422377205'],
  ])('%s -> %s', (raw, ok) => {
    expect(normalizeWhatsapp(raw)).toBe(ok)
  })
  it.each(['99218-6056', '12345', '1 555 123 4567'])('recusa %s', (raw) => {
    expect(() => normalizeWhatsapp(raw)).toThrow(BadRequestException)
  })
})
