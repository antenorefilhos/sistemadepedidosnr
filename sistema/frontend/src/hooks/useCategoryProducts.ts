import { useQuery } from '@tanstack/react-query'
import { productsAPI } from '../services/api'
import type { Product } from '../types'

/**
 * Busca os produtos de cada categoria comercial do CMS.
 *
 * Agrupar no cliente por `product.category` nao funciona: 99,8% do catalogo
 * esta como "GERAL". A fonte que casa com o Admin e o filtro `?category=`
 * (tabela EAN -> categoria) — a mesma que alimenta o `productCount` do CMS,
 * entao o que a loja mostra bate com o que o painel promete.
 *
 * E uma query so, com as categorias buscadas em SERIE, por dois motivos:
 * o numero de hooks nao varia com a quantidade de categorias, e o backend
 * limita a 20 req/min — uma rajada paralela devolvia 429 em parte das
 * vitrines, que entao sumiam de forma nao-deterministica.
 */
export function useCategoryProducts(codes: string[], limit = 12) {
  const codesKey = codes.join('|')

  const { data } = useQuery(
    ['products-by-category', codesKey, limit],
    async () => {
      const byCode: Record<string, Product[]> = {}
      for (const code of codes) {
        const response = await productsAPI.getAll(undefined, 1, limit, code)
        byCode[code] = (response.data?.data ?? []) as Product[]
      }
      return byCode
    },
    {
      enabled: codes.length > 0,
      staleTime: 1000 * 60 * 10,
      cacheTime: 1000 * 60 * 15,
      keepPreviousData: true,
    },
  )

  return data ?? {}
}
