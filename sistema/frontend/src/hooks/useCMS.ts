import { useQuery } from '@tanstack/react-query'
import { analyticsAPI, cmsAPI } from '../services/api'
import type { Product } from '../types'

interface TopSellingProduct {
  product: Product
  soldQuantity: number
}

export interface StoreBannerCMS {
  id: string
  name?: string
  type?: 'full' | 'tarja' | 'vitrine' | 'mini' | 'lateral'
  active?: boolean
  link?: string
  linkTarget?: '_self' | '_blank'
  title?: string
  imageUrl: string
  mobileImageUrl?: string
  pages?: 'home' | 'all' | 'category' | 'product'
  order?: number
}

export function useStoreBanners() {
  return useQuery(['store-banners-cms'], async () => {
    const response = await cmsAPI.storeBanners.getAll()
    return response.data as StoreBannerCMS[]
  }, {
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true,
  })
}

export function useHeroSlides() {
  return useQuery(['hero-slides'], async () => {
    const response = await cmsAPI.heroSlides.getAll()
    return response.data
  }, {
    staleTime: 1000 * 60 * 10, // 10 minutes
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true,
  })
}

export function useCategoriesCMS() {
  return useQuery(['categories-cms'], async () => {
    const response = await cmsAPI.categories.getAll()
    return response.data
  }, {
    staleTime: 1000 * 60 * 10, // 10 minutes
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true,
  })
}

export function useCommercialTaxonomy() {
  return useQuery(['categories-commercial-taxonomy'], async () => {
    try {
      const response = await cmsAPI.categories.getCommercial()
      return response.data
    } catch {
      const fallback = await cmsAPI.categories.getAll()
      return fallback.data
    }
  }, {
    staleTime: 1000 * 60 * 10,
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true,
  })
}

export function usePromoBanners() {
  return useQuery(['promo-banners-cms'], async () => {
    const response = await cmsAPI.promoBanners.getAll()
    return response.data
  }, {
    staleTime: 1000 * 60 * 10, // 10 minutes
    cacheTime: 1000 * 60 * 15,
    keepPreviousData: true,
  })
}

export function useTopSellingProducts(limit = 8) {
  return useQuery(['analytics-top-products', limit], async () => {
    const response = await analyticsAPI.getTopProducts(limit)
    const payload = response.data as { data?: TopSellingProduct[] }
    return Array.isArray(payload?.data) ? payload.data : []
  }, {
    staleTime: 1000 * 60 * 5,
    cacheTime: 1000 * 60 * 10,
    keepPreviousData: true,
  })
}
