import { searchWords } from './unaccent-search'

describe('busca do separador por palavras', () => {
  it('sem acento, sem pontuacao, sem repetir', () => {
    expect(searchWords('Arroz Tio João!')).toEqual(['arroz', 'tio', 'joao'])
    expect(searchWords('  café   café pilão 500g ')).toEqual(['cafe', 'pilao', '500g'])
  })

  it('palavra de ligacao nao e exigida, a nao ser que seja a unica', () => {
    expect(searchWords('pão de queijo')).toEqual(['pao', 'queijo'])
    expect(searchWords('de')).toEqual(['de'])
  })

  it('vazio', () => {
    expect(searchWords('  ')).toEqual([])
  })
})
