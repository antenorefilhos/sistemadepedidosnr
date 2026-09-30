import { BadRequestException } from '@nestjs/common'
import { normalizeHomeLayout } from './brand.service'

describe('normalizeHomeLayout', () => {
  it('guarda so a lista de blocos ocultos, sem repetir e sem lixo', () => {
    expect(normalizeHomeLayout(JSON.stringify({ hidden: ['faixa', 'vitrine:higiene-pessoal', 'faixa', 42, '<script>'], extra: 1 }))).toBe(
      JSON.stringify({ hidden: ['faixa', 'vitrine:higiene-pessoal'] }),
    )
  })
  it('sem lista vira lista vazia', () => {
    expect(normalizeHomeLayout('{}')).toBe('{"hidden":[]}')
  })
  it('recusa texto que nao e JSON', () => {
    expect(() => normalizeHomeLayout('nao-e-json')).toThrow(BadRequestException)
  })
})
