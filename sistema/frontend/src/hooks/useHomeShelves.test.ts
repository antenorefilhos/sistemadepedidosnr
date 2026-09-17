import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHomeShelves } from './useHomeShelves'
import type { Product } from '../types'

// JON-172: deduplicacao sem reposicao esvaziava vitrines da Home -- uma
// categoria (ex.: acougue) alimenta varias secoes (churrasco, carnes-dia-
// -a-dia, "fresh"/"churrascoOccasion" de intencao); sem overfetch nem
// reposicao, a segunda/terceira secao que reusa a categoria sobrava com
// quase nada. O fix: backend manda um pool bem maior que o limit de
// exibicao, e este hook reabastece a secao a partir desse pool antes de
// desistir; so esconde a secao se mesmo depois de reabastecer ela nao
// alcancar o minimo coerente (MIN_SHELF_ITEMS).

function makeProducts(prefix: string, count: number): Product[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `${prefix} produto ${i}`,
    price: 10 + i,
  })) as Product[]
}

const baseInput = {
  productsList: [] as Product[],
  topSellingProducts: [],
  rebuyProducts: [] as Product[],
  marginShowcase: [] as Product[],
  promotionalProducts: [] as Product[],
}

describe('useHomeShelves', () => {
  it('reabastece secoes de categoria que ficaram vazias apos as vitrines de intencao consumirem o pool compartilhado', () => {
    const acougue = makeProducts('acougue', 30)
    const hortifruti = makeProducts('hortifruti', 30)
    const cervejas = makeProducts('cervejas', 30)

    const cmsCategories = [
      { code: 'ACOUGUE_CHURRASCO', limit: 6, priority: 1, productCount: 30, products: acougue },
      { code: 'HORTIFRUTI', limit: 8, priority: 6, productCount: 30, products: hortifruti },
      { code: 'CERVEJAS', limit: 6, priority: 3, productCount: 30, products: cervejas },
    ]

    const { result } = renderHook(() => useHomeShelves({ ...baseInput, cmsCategories }))

    // As tres secoes que reusam acougue/hortifruti sobrevivem com reposicao,
    // em vez de ficarem com 0-2 itens (carrossel acidental).
    expect(result.current.categorized.churrasco.length).toBeGreaterThanOrEqual(4)
    expect(result.current.categorized.carnesDiaADia.length).toBeGreaterThanOrEqual(4)
    expect(result.current.categorized.feira.length).toBeGreaterThanOrEqual(4)

    // Nenhum produto aparece duas vezes entre as secoes de categoria e as
    // vitrines de intencao -- reposicao nao pode reintroduzir duplicata.
    const allShown = [
      ...result.current.categorized.churrasco,
      ...result.current.categorized.carnesDiaADia,
      ...result.current.categorized.feira,
      ...result.current.categorized.bebidas,
      result.current.freshShelf,
      result.current.fairShelf,
      result.current.churrascoOccasionShelf,
    ].flat()
    const ids = allShown.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)

    // bebidas (cervejas) nao foi tocada pelas vitrines de intencao neste
    // cenario (churrascoOccasion satisfez o limite so com acougue) -- segue
    // com o tamanho original, sem precisar de reposicao.
    expect(result.current.categorized.bebidas.length).toBe(6)
  })

  it('esconde a secao inteira (array vazio) quando o pool real acaba mesmo depois de tentar reabastecer', () => {
    // Pool de acougue deliberadamente pequeno (8): categorizado (churrasco+
    // carnesDiaADia, 6+2) e a vitrine de intencao (churrascoOccasion, ate 10)
    // brigam pelo mesmo total de 8 -- depois da vitrine de intencao levar
    // tudo, nao sobra nada nem pra reabastecer.
    const acougue = makeProducts('acougue', 8)
    const hortifruti = makeProducts('hortifruti', 10)

    const cmsCategories = [
      { code: 'ACOUGUE_CHURRASCO', limit: 6, priority: 1, productCount: 8, products: acougue },
      { code: 'HORTIFRUTI', limit: 8, priority: 6, productCount: 10, products: hortifruti },
    ]

    const { result } = renderHook(() => useHomeShelves({ ...baseInput, cmsCategories }))

    // Pool de acougue (8) inteiro foi pra vitrine de intencao (churrascoOccasion,
    // ate 10) -- nao sobra nada real pra reabastecer churrasco/carnesDiaADia.
    expect(result.current.churrascoOccasionShelf.length).toBe(8)
    expect(result.current.categorized.churrasco).toEqual([])
    expect(result.current.categorized.carnesDiaADia).toEqual([])
  })

  it('deduplica por nome+preco (residuo do sync do ERP: mesmo nome/preco, id diferente)', () => {
    // 6 candidatos distintos + 1 duplicata (mesmo nome+preco de a1, id
    // diferente) -- fica acima do minimo mesmo apos a duplicata cair, entao
    // o teste isola so o comportamento de dedup, sem tocar no corte de minimo.
    const duplicated: Product[] = [
      { id: 'a1', name: 'Picanha', price: 50 } as Product,
      { id: 'a1-dup', name: 'Picanha', price: 50 } as Product, // mesmo nome+preco, id diferente -- e o MESMO SKU
      { id: 'a2', name: 'Alcatra', price: 45 } as Product, // nome diferente -- variante real, nao e duplicata
      { id: 'a3', name: 'Contra File', price: 40 } as Product,
      { id: 'a4', name: 'Fraldinha', price: 38 } as Product,
      { id: 'a5', name: 'Costela', price: 30 } as Product,
    ]
    // PADARIA de proposito: nenhuma vitrine de intencao (fresh/fair/
    // churrascoOccasion) reusa essa regra, entao o teste isola so o dedup,
    // sem interacao com o resto da cascata.
    const cmsCategories = [{ code: 'PADARIA', limit: 6, priority: 8, productCount: 6, products: duplicated }]

    const { result } = renderHook(() => useHomeShelves({ ...baseInput, cmsCategories }))

    const padaria = result.current.categorized.padaria
    expect(padaria.map((p) => p.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })
})
