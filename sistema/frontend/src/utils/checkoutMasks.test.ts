import { describe, expect, it } from 'vitest'
import { maskCpfInput, maskPhoneInput } from './checkout'

describe('mascaras do checkout', () => {
  it('CPF enquanto digita', () => {
    expect(maskCpfInput('123')).toBe('123')
    expect(maskCpfInput('1234')).toBe('123.4')
    expect(maskCpfInput('1234567')).toBe('123.456.7')
    expect(maskCpfInput('12345678909')).toBe('123.456.789-09')
    expect(maskCpfInput('123.456.789-0999')).toBe('123.456.789-09')
  })
  it('WhatsApp enquanto digita, com ou sem 55', () => {
    expect(maskPhoneInput('2')).toBe('(2')
    expect(maskPhoneInput('2499')).toBe('(24) 99')
    expect(maskPhoneInput('2422221111')).toBe('(24) 2222-1111')
    expect(maskPhoneInput('24999990000')).toBe('(24) 99999-0000')
    expect(maskPhoneInput('5524999990000')).toBe('(24) 99999-0000')
  })
})
