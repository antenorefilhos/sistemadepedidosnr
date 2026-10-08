import { describe, expect, it } from 'vitest'
import { formatDuration, ingredientAmount, pickOfTheDay, recipeProductRole, splitSteps } from './recipe'

describe('receitas', () => {
  it('tempo legivel', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(90)).toBe('1h30')
    expect(formatDuration(305)).toBe('5h05')
    expect(formatDuration(300)).toBe('5 h')
    expect(formatDuration(undefined)).toBe('')
  })

  it('quantidade do ingrediente nao perde o "a gosto"', () => {
    expect(ingredientAmount({ quantity: '2', unit: 'xícaras (320 g)' })).toBe('2 xícaras (320 g)')
    expect(ingredientAmount({ quantity: undefined, unit: 'a gosto' })).toBe('a gosto')
    expect(ingredientAmount({ quantity: '4', unit: undefined })).toBe('4')
    expect(ingredientAmount({})).toBe('')
  })

  it('dica e harmonizacao saem da contagem dos passos', () => {
    const { steps, notes } = splitSteps([
      { content: 'Ferva a água.' },
      { content: 'Dica: o limão entra no fim.' },
      { content: 'Harmonização: Malbec Catena.' },
      { content: 'Harmonizacao : Sauvignon Blanc.' },
    ])
    expect(steps.map((s) => s.content)).toEqual(['Ferva a água.'])
    expect(notes).toEqual([
      { kind: 'tip', text: 'o limão entra no fim.' },
      { kind: 'pairing', text: 'Malbec Catena.' },
      { kind: 'pairing', text: 'Sauvignon Blanc.' },
    ])
  })

  it('papel do produto na lista de compra', () => {
    expect(recipeProductRole({ note: 'para harmonizar' })).toBe('pairing')
    expect(recipeProductRole({ note: 'para cozinhar e para harmonizar' })).toBe('main')
    expect(recipeProductRole({ note: 'opcional' })).toBe('optional')
    expect(recipeProductRole({ note: 'sem tempo? as carnes já separadas' })).toBe('optional')
    expect(recipeProductRole({ note: 'para acompanhar' })).toBe('main')
    expect(recipeProductRole({ note: undefined })).toBe('main')
  })

  it('receita do dia e estavel no dia', () => {
    const list = ['a', 'b', 'c', 'd', 'e']
    const day = new Date('2026-10-07T12:00:00-03:00')
    expect(pickOfTheDay(list, day)).toBe(pickOfTheDay(list, new Date('2026-10-07T23:00:00-03:00')))
    expect(pickOfTheDay([], day)).toBeUndefined()
  })
})
