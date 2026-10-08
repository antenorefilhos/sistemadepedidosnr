// Rodar com o vitest da loja: cd sistema/frontend && npx vitest run --root ../picking-app src/utils/weight.test.ts
import { describe, expect, it } from 'vitest'
import { parseWeightInput, weightLong, weightLooksOff, weightOnScale, weightShort } from './weight'

describe('peso para o separador', () => {
  it('mostra em gramas abaixo de 1 kg e em quilos e gramas acima', () => {
    expect(weightShort(0.22)).toBe('220 g')
    expect(weightShort('0.360')).toBe('360 g')
    expect(weightShort(1)).toBe('1 kg')
    expect(weightShort(1.588)).toBe('1 kg e 588 g')
    expect(weightLong(0.22)).toBe('220 gramas')
    expect(weightLong(1)).toBe('1 quilo')
    expect(weightLong(2.05)).toBe('2 quilos e 50 gramas')
    expect(weightOnScale(0.22)).toBe('0,220 kg')
    expect(weightOnScale(1.588)).toBe('1,588 kg')
  })

  it('le o que vier digitado', () => {
    expect(parseWeightInput('0,268')).toEqual({ kg: 0.268, read: 'kg' })
    expect(parseWeightInput('0.268 kg')).toEqual({ kg: 0.268, read: 'kg' })
    expect(parseWeightInput('268')).toEqual({ kg: 0.268, read: 'g' })
    expect(parseWeightInput('268g')).toEqual({ kg: 0.268, read: 'g' })
    expect(parseWeightInput('1,25')).toEqual({ kg: 1.25, read: 'kg' })
    expect(parseWeightInput('2')).toEqual({ kg: 2, read: 'kg' })
    expect(parseWeightInput('1500')).toEqual({ kg: 1.5, read: 'g' })
    expect(parseWeightInput('268,5')).toEqual({ kg: 0.269, read: 'g' })
    expect(parseWeightInput('')).toBeNull()
    expect(parseWeightInput('abc')).toBeNull()
    expect(parseWeightInput('0')).toBeNull()
  })

  it('avisa quando o peso esta muito longe do pedido', () => {
    expect(weightLooksOff(0.268, 0.22)).toBe(false)
    expect(weightLooksOff(2.68, 0.22)).toBe(true)
    expect(weightLooksOff(0.05, 0.22)).toBe(true)
  })
})
