import { sanitizeWineProfile } from './wine-profile'

describe('ficha do vinho', () => {
  it('mantem so os campos conhecidos e normaliza listas', () => {
    const p = sanitizeWineProfile({
      tipo: 'Tinto', estilo: 'seco', pais: ' Argentina ', uvas: 'Malbec, Cabernet Franc', produtor: 'Luigi Bosca',
      fontes: ['https://luigibosca.com', 'javascript:alert(1)'], inventado: 'x', descricaoCurta: 'Tinto macio.',
    })
    expect(p).toEqual({ tipo: 'tinto', estilo: 'seco', pais: 'Argentina', uvas: ['Malbec', 'Cabernet Franc'], produtor: 'Luigi Bosca', fontes: ['https://luigibosca.com'], descricaoCurta: 'Tinto macio.' })
  })

  it('tipo e estilo fora da lista sao descartados; ficha vazia vira null', () => {
    expect(sanitizeWineProfile({ tipo: 'laranja', estilo: 'xpto' })).toBeNull()
    expect(sanitizeWineProfile(null)).toBeNull()
    expect(sanitizeWineProfile([])).toBeNull()
  })
})
