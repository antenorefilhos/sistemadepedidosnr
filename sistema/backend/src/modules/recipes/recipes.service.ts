import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { CreateRecipeCategoryDto, UpdateRecipeCategoryDto } from './dto/recipe-category.dto'

const RECIPE_INCLUDE = {
  category: true,
  ingredients: { orderBy: { order: 'asc' as const } },
  steps: { orderBy: { order: 'asc' as const } },
  products: {
    orderBy: { order: 'asc' as const },
    include: { product: true },
  },
  relatedTo: {
    include: {
      relatedRecipe: {
        select: { id: true, title: true, slug: true, imageUrl: true, prepTime: true, difficulty: true },
      },
    },
  },
}

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Categories ----

  async listCategories() {
    return this.prisma.recipeCategory.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { recipes: true } } },
    })
  }

  async createCategory(dto: CreateRecipeCategoryDto) {
    return this.prisma.recipeCategory.create({ data: dto })
  }

  async updateCategory(id: string, dto: UpdateRecipeCategoryDto) {
    return this.prisma.recipeCategory.update({ where: { id }, data: dto })
  }

  async deleteCategory(id: string) {
    return this.prisma.recipeCategory.delete({ where: { id } })
  }

  // ---- Recipes ----

  async list(active?: boolean, categorySlug?: string, page = 1, limit = 12) {
    const where: Record<string, unknown> = {}
    if (active !== undefined) where.active = active
    if (categorySlug) {
      where.category = { slug: categorySlug }
    }

    const [data, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: { category: true },
      }),
      this.prisma.recipe.count({ where }),
    ])

    return { data, page, limit, total, hasNextPage: page * limit < total }
  }

  async findBySlug(slug: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { slug },
      include: RECIPE_INCLUDE,
    })
    if (!recipe) throw new NotFoundException(`Receita não encontrada: ${slug}`)
    return recipe
  }

  async findById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    })
    if (!recipe) throw new NotFoundException(`Receita não encontrada: ${id}`)
    return recipe
  }

  async create(dto: CreateRecipeDto) {
    const { ingredients, steps, products, relatedIds, publishedAt, ...fields } = dto

    return this.prisma.recipe.create({
      data: {
        ...fields,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        ingredients: ingredients
          ? { create: ingredients.map((ing, i) => ({ ...ing, order: ing.order ?? i })) }
          : undefined,
        steps: steps
          ? { create: steps.map((s, i) => ({ ...s, order: s.order ?? i })) }
          : undefined,
        products: products
          ? { create: products.map((p, i) => ({ ...p, order: p.order ?? i })) }
          : undefined,
        relatedTo: relatedIds?.length
          ? {
              create: relatedIds.map((relatedRecipeId) => ({ relatedRecipeId })),
            }
          : undefined,
      },
      include: RECIPE_INCLUDE,
    })
  }

  async update(id: string, dto: UpdateRecipeDto) {
    const { ingredients, steps, products, relatedIds, publishedAt, ...fields } = dto

    await this.findById(id)

    return this.prisma.$transaction(async (tx) => {
      if (ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
      }
      if (steps !== undefined) {
        await tx.recipeStep.deleteMany({ where: { recipeId: id } })
      }
      if (products !== undefined) {
        await tx.recipeProduct.deleteMany({ where: { recipeId: id } })
      }
      if (relatedIds !== undefined) {
        await tx.recipeRelation.deleteMany({ where: { recipeId: id } })
      }

      return tx.recipe.update({
        where: { id },
        data: {
          ...fields,
          publishedAt: publishedAt !== undefined ? (publishedAt ? new Date(publishedAt) : null) : undefined,
          ingredients: ingredients
            ? { create: ingredients.map((ing, i) => ({ ...ing, order: ing.order ?? i })) }
            : undefined,
          steps: steps
            ? { create: steps.map((s, i) => ({ ...s, order: s.order ?? i })) }
            : undefined,
          products: products
            ? { create: products.map((p, i) => ({ ...p, order: p.order ?? i })) }
            : undefined,
          relatedTo: relatedIds?.length
            ? { create: relatedIds.map((relatedRecipeId) => ({ relatedRecipeId })) }
            : undefined,
        },
        include: RECIPE_INCLUDE,
      })
    })
  }

  async remove(id: string) {
    await this.findById(id)
    return this.prisma.recipe.delete({ where: { id } })
  }
}
