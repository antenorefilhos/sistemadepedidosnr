import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { isProductSellable } from '../../common/product-availability'
import { toCustomerFacingProduct } from '../cms/categories/categories.service'
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
        select: { id: true, title: true, slug: true, imageUrl: true, prepTime: true, difficulty: true, active: true, publishedAt: true },
      },
    },
  },
}

/** Publicada = ativa e com data de publicacao vazia ou ja passada (agendamento, 29/09/2026). */
const publishedWhere = (): Prisma.RecipeWhereInput => ({
  active: true,
  OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
})
const isPublished = (r: { active: boolean; publishedAt: Date | null }) => r.active && (!r.publishedAt || r.publishedAt.getTime() <= Date.now())

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Categories ----

  /** Admin ve todas; o site so as ativas que tem receita publicada (senao o filtro leva a lista vazia). */
  async listCategories(isAdmin = false) {
    if (isAdmin) {
      return this.prisma.recipeCategory.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { recipes: true } } },
      })
    }
    return this.prisma.recipeCategory.findMany({
      where: { active: true, recipes: { some: publishedWhere() } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
  }

  async createCategory(dto: CreateRecipeCategoryDto) {
    return this.uniqueGuard(() => this.prisma.recipeCategory.create({ data: dto }), 'Já existe uma categoria com esse nome.')
  }

  async updateCategory(id: string, dto: UpdateRecipeCategoryDto) {
    return this.uniqueGuard(() => this.prisma.recipeCategory.update({ where: { id }, data: dto }), 'Já existe uma categoria com esse nome.')
  }

  async deleteCategory(id: string) {
    // Receitas da categoria ficam sem categoria (onDelete: SetNull), nao somem.
    return this.prisma.recipeCategory.delete({ where: { id } })
  }

  // ---- Recipes ----

  async list(active?: boolean, categorySlug?: string, page = 1, limit = 12, isAdmin = false, productId?: string) {
    const where: Prisma.RecipeWhereInput = isAdmin ? (active !== undefined ? { active } : {}) : publishedWhere()
    if (categorySlug) where.category = { slug: categorySlug }
    // "Receitas com este produto" na pagina do produto (29/09/2026).
    if (productId) where.products = { some: { productId } }

    if (!isAdmin) {
      const [rows, total] = await Promise.all([
        this.prisma.recipe.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            category: true,
            products: { select: { product: { select: { active: true, syncOption: true, stock: true } } } },
          },
        }),
        this.prisma.recipe.count({ where }),
      ])
      // productCount (07/10/2026): quantos ingredientes da para comprar agora --
      // o card da lista mostra "9 ingredientes na loja". Mesmo filtro do findBySlug.
      const data = rows.map(({ products, ...r }) => ({
        ...r,
        productCount: (products ?? []).filter((p) => isProductSellable(p.product)).length,
      }))
      return { data, page, limit, total, hasNextPage: page * limit < total }
    }

    // Admin: tudo de uma vez (poucas dezenas) com o que a lista precisa mostrar.
    const rows = await this.prisma.recipe.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        category: true,
        _count: { select: { ingredients: true, steps: true } },
        products: { select: { product: { select: { active: true, syncOption: true, stock: true } } } },
      },
    })
    const data = rows.map(({ products, ...r }) => ({
      ...r,
      productCount: products.length,
      unavailableProducts: products.filter((p) => !isProductSellable(p.product)).length,
      published: isPublished(r),
    }))
    return { data, page: 1, limit: data.length, total: data.length, hasNextPage: false }
  }

  async findBySlug(slug: string, isAdmin = false) {
    const recipe = await this.prisma.recipe.findUnique({ where: { slug }, include: RECIPE_INCLUDE })
    // JON-156: consulta publica por slug nao filtrava active. 29/09/2026: nem a
    // data de publicacao -- receita agendada ja aparecia.
    if (!recipe || (!isAdmin && !isPublished(recipe))) {
      throw new NotFoundException(`Receita não encontrada: ${slug}`)
    }
    if (isAdmin) {
      return {
        ...recipe,
        products: recipe.products.map((rp) => ({ ...rp, available: isProductSellable(rp.product) })),
      }
    }
    // Site: so produto que da para comprar agora, com o nome do site; e so
    // receita relacionada que tambem esta publicada.
    return {
      ...recipe,
      products: recipe.products.filter((rp) => isProductSellable(rp.product)).map((rp) => ({ ...rp, product: toCustomerFacingProduct(rp.product) })),
      relatedTo: recipe.relatedTo.filter((rel) => isPublished(rel.relatedRecipe)),
    }
  }

  async findById(id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, include: RECIPE_INCLUDE })
    if (!recipe) throw new NotFoundException(`Receita não encontrada: ${id}`)
    return recipe
  }

  async create(dto: CreateRecipeDto) {
    const { ingredients, steps, products, relatedIds, publishedAt, ...fields } = dto

    return this.uniqueGuard(() =>
      this.prisma.recipe.create({
        data: {
          ...fields,
          publishedAt: publishedAt ? new Date(publishedAt) : null,
          ingredients: ingredients ? { create: ingredients.map((ing, i) => ({ ...ing, order: ing.order ?? i })) } : undefined,
          steps: steps ? { create: steps.map((s, i) => ({ ...s, order: s.order ?? i })) } : undefined,
          products: products ? { create: dedupeProducts(products).map((p, i) => ({ ...p, order: p.order ?? i })) } : undefined,
          relatedTo: relatedIds?.length ? { create: [...new Set(relatedIds)].map((relatedRecipeId) => ({ relatedRecipeId })) } : undefined,
        },
        include: RECIPE_INCLUDE,
      }),
    )
  }

  async update(id: string, dto: UpdateRecipeDto) {
    const { ingredients, steps, products, relatedIds, publishedAt, ...fields } = dto

    await this.findById(id)

    return this.uniqueGuard(() =>
      this.prisma.$transaction(async (tx) => {
        if (ingredients !== undefined) await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
        if (steps !== undefined) await tx.recipeStep.deleteMany({ where: { recipeId: id } })
        if (products !== undefined) await tx.recipeProduct.deleteMany({ where: { recipeId: id } })
        if (relatedIds !== undefined) await tx.recipeRelation.deleteMany({ where: { recipeId: id } })

        return tx.recipe.update({
          where: { id },
          data: {
            ...fields,
            publishedAt: publishedAt !== undefined ? (publishedAt ? new Date(publishedAt) : null) : undefined,
            ingredients: ingredients ? { create: ingredients.map((ing, i) => ({ ...ing, order: ing.order ?? i })) } : undefined,
            steps: steps ? { create: steps.map((s, i) => ({ ...s, order: s.order ?? i })) } : undefined,
            products: products ? { create: dedupeProducts(products).map((p, i) => ({ ...p, order: p.order ?? i })) } : undefined,
            relatedTo: relatedIds?.length
              ? { create: [...new Set(relatedIds)].filter((r) => r !== id).map((relatedRecipeId) => ({ relatedRecipeId })) }
              : undefined,
          },
          include: RECIPE_INCLUDE,
        })
      }),
    )
  }

  async remove(id: string) {
    await this.findById(id)
    return this.prisma.recipe.delete({ where: { id } })
  }

  /** Endereco (slug) ou nome repetido virava erro 500 cru. */
  private async uniqueGuard<T>(run: () => Promise<T>, message = 'Já existe uma receita com esse endereço. Mude o título ou o endereço.') {
    try {
      return await run()
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException(message)
      throw error
    }
  }
}

/** Mesmo produto duas vezes quebrava o @@unique([recipeId, productId]). */
function dedupeProducts<T extends { productId: string }>(products: T[]) {
  const seen = new Set<string>()
  return products.filter((p) => (seen.has(p.productId) ? false : (seen.add(p.productId), true)))
}
