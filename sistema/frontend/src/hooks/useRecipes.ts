import { useQuery } from '@tanstack/react-query'
import { recipesAPI } from '../services/api'
import type { Recipe, RecipeCategory } from '../types'

interface PaginatedRecipes {
  data: Recipe[]
  page: number
  limit: number
  total: number
  hasNextPage: boolean
}

export function useRecipes(category?: string, page = 1, limit = 12) {
  return useQuery({
    queryKey: ['recipes', category, page, limit],
    queryFn: async () => {
      const response = await recipesAPI.list(category, page, limit)
      return response.data as PaginatedRecipes
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useRecipe(slug: string) {
  return useQuery({
    queryKey: ['recipe', slug],
    queryFn: async () => {
      const response = await recipesAPI.getBySlug(slug)
      return response.data as Recipe
    },
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  })
}

export function useRecipeCategories() {
  return useQuery({
    queryKey: ['recipe-categories'],
    queryFn: async () => {
      const response = await recipesAPI.categories()
      return response.data as RecipeCategory[]
    },
    staleTime: 1000 * 60 * 10,
  })
}
