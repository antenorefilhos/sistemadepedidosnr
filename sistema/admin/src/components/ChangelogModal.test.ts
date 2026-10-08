import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import { ADMIN_CHANGELOG } from './ChangelogModal'

// A etiqueta "v1.x · Novidades" do painel vem do package.json e a lista, do
// ADMIN_CHANGELOG. Ficaram desencontradas de 22/09 a 08/10/2026 (172 commits
// sem nenhuma novidade registrada): sobe a versao, registra a novidade.
describe('Novidades do admin', () => {
  it('a versao do painel e a da novidade mais recente', () => {
    expect(ADMIN_CHANGELOG[0].version).toBe(pkg.version)
  })

  it('versoes em ordem, da mais nova para a mais antiga, sem repetir', () => {
    const toNumber = (v: string) => v.split('.').map(Number).reduce((acc, n) => acc * 1000 + n, 0)
    const numbers = ADMIN_CHANGELOG.map((release) => toNumber(release.version))
    expect(new Set(numbers).size).toBe(numbers.length)
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers)
  })
})
