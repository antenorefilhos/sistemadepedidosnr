import { firstName, personalize } from './personalize'

describe('personalize (aviso com o nome do cliente)', () => {
  it('primeiro nome, so com a inicial maiuscula', () => {
    expect(firstName('GIOVANA conceição')).toBe('Giovana')
    expect(firstName('  luana porciano ')).toBe('Luana')
    expect(firstName("D'avila Souza")).toBe("D'avila")
  })

  it('nome que nao e nome nao entra', () => {
    expect(firstName('')).toBeNull()
    expect(firstName(null)).toBeNull()
    expect(firstName('Cliente123')).toBeNull()
    expect(firstName('a')).toBeNull()
    expect(firstName('teste@email.com')).toBeNull()
  })

  it('troca {nome} pelo primeiro nome', () => {
    expect(personalize('{nome}, esqueceu algo no carrinho?', 'giovana conceição')).toBe('Giovana, esqueceu algo no carrinho?')
    expect(personalize('Oi, {Nome}! Chegou oferta.', 'ANA')).toBe('Oi, Ana! Chegou oferta.')
  })

  it('sem nome confiavel, a frase sai inteira e sem virgula sobrando', () => {
    expect(personalize('{nome}, esqueceu algo no carrinho?', null)).toBe('Esqueceu algo no carrinho?')
    expect(personalize('Oi, {nome}! Chegou oferta.', '')).toBe('Oi! Chegou oferta.')
    expect(personalize('Separamos para você {nome}', '123')).toBe('Separamos para você')
  })

  it('texto sem {nome} nao muda', () => {
    expect(personalize('Chegou o encarte', 'Ana')).toBe('Chegou o encarte')
  })
})
