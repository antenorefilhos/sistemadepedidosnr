import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { productsAPI, recommendationsAPI } from '../services/api'
import { Product } from '../types'
import { useCartContext, CartItem } from '../contexts/CartContext'

// Re-exporta do contexto para compatibilidade
export { useCartContext as useCart }
export type { CartItem }

interface PaginatedProducts {
  data: Product[]
  page: number
  limit: number
  total: number
  hasNextPage: boolean
}

interface RecommendationItem {
  product: Product
  score?: number
  reason?: string
  margin?: number | null
  availableStock?: number
}

function extractRecommendationProducts(payload: unknown): Product[] {
  if (Array.isArray(payload)) return payload as Product[]
  const items = (payload as { items?: RecommendationItem[] } | undefined)?.items
  return Array.isArray(items)
    ? items.map((item) => item.product).filter((product): product is Product => Boolean(product?.id))
    : []
}

export function useProducts(search?: string, category?: string) {
  return useQuery({
    queryKey: ['products', search, category],
    queryFn: async () => {
      const response = await productsAPI.getAll(search, undefined, undefined, category)
      const res = response.data as PaginatedProducts
      return (res.data ?? res) as Product[]
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useInfiniteProducts(
  search?: string,
  category?: string,
  minPrice?: number,
  maxPrice?: number,
  classification01?: string,
  classification02?: string,
  classification03?: string,
  classification04?: string,
) {
  return useInfiniteQuery({
    queryKey: [
      'products-infinite',
      search,
      category,
      minPrice,
      maxPrice,
      classification01,
      classification02,
      classification03,
      classification04,
    ],
    queryFn: async ({ pageParam = 1 }): Promise<PaginatedProducts> => {
      const response = await productsAPI.getAll(
        search,
        pageParam as number,
        24,
        category,
        minPrice,
        maxPrice,
        classification01,
        classification02,
        classification03,
        classification04,
      )
      return response.data as PaginatedProducts
    },
    getNextPageParam: (lastPage: PaginatedProducts) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await productsAPI.getOne(id)
      return response.data
    },
  })
}

export function useProductRecommendations(id: string, limit = 6) {
  return useQuery({
    queryKey: ['product-recommendations', id, limit],
    queryFn: async () => {
      const response = await productsAPI.getRecommendations(id, limit)
      return (response.data || []) as Product[]
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })
}

export function useRecommendationShowcase(segmentKey?: string, limit = 12) {
  return useQuery({
    queryKey: ['recommendation-showcase', segmentKey || 'default', limit],
    queryFn: async () => {
      const response = await recommendationsAPI.getShowcase(segmentKey, limit)
      return extractRecommendationProducts(response.data)
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useRebuyRecommendations(customerId?: string, limit = 12) {
  return useQuery({
    queryKey: ['recommendation-rebuy', customerId, limit],
    queryFn: async () => {
      const response = await recommendationsAPI.getRebuy(customerId!, limit)
      return extractRecommendationProducts(response.data)
    },
    enabled: Boolean(customerId),
    staleTime: 1000 * 60 * 5,
  })
}

export function useSmartSubstitutes(productId?: string, limit = 8) {
  return useQuery({
    queryKey: ['recommendation-substitutes', productId, limit],
    queryFn: async () => {
      const response = await recommendationsAPI.getSubstitutes(productId!, limit)
      return extractRecommendationProducts(response.data)
    },
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  })
}
