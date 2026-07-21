const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const frontendPublicDir = path.resolve(__dirname, '..', '..', 'frontend', 'public')

const expectedCategories = [
  'jantar-pratico',
  'churrasco-completo',
  'lanches-e-praticos',
  'adega-e-harmonizacao',
]

const expectedRecipes = [
  {
    slug: 'picadinho-de-acem-da-casa',
    categorySlug: 'jantar-pratico',
    ingredients: 5,
    steps: 4,
    products: 2,
    related: 2,
    imageUrl: '/recipes/picadinho-de-acem-da-casa.webp',
  },
  {
    slug: 'churrasco-de-familia-antenor',
    categorySlug: 'churrasco-completo',
    ingredients: 5,
    steps: 4,
    products: 5,
    related: 2,
    imageUrl: '/recipes/churrasco-de-familia-antenor.webp',
  },
  {
    slug: 'noite-de-pizza-crocante',
    categorySlug: 'lanches-e-praticos',
    ingredients: 4,
    steps: 4,
    products: 4,
    related: 2,
    imageUrl: '/recipes/noite-de-pizza-crocante.webp',
  },
  {
    slug: 'lanche-quente-da-padaria',
    categorySlug: 'lanches-e-praticos',
    ingredients: 4,
    steps: 4,
    products: 3,
    related: 2,
    imageUrl: '/recipes/lanche-quente-da-padaria.webp',
  },
  {
    slug: 'tabua-de-vinhos-e-snacks',
    categorySlug: 'adega-e-harmonizacao',
    ingredients: 4,
    steps: 4,
    products: 6,
    related: 2,
    imageUrl: '/recipes/tabua-de-vinhos-e-snacks.webp',
  },
]

const failures = []

function fail(message) {
  failures.push(message)
}

function resolvePublicAsset(publicPath) {
  return path.join(frontendPublicDir, String(publicPath || '').replace(/^\//, ''))
}

async function validateCategories() {
  const categories = await prisma.recipeCategory.findMany({
    where: { slug: { in: expectedCategories } },
    select: { slug: true, active: true },
  })
  const bySlug = new Map(categories.map((category) => [category.slug, category]))

  for (const slug of expectedCategories) {
    const category = bySlug.get(slug)
    if (!category) {
      fail(`categoria ausente: ${slug}`)
      continue
    }
    if (!category.active) fail(`categoria inativa: ${slug}`)
  }
}

async function validateRecipes() {
  const recipes = await prisma.recipe.findMany({
    where: { slug: { in: expectedRecipes.map((recipe) => recipe.slug) } },
    include: {
      category: true,
      ingredients: true,
      steps: true,
      products: { include: { product: true } },
      relatedTo: { include: { relatedRecipe: true } },
    },
  })
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]))

  for (const expected of expectedRecipes) {
    const recipe = bySlug.get(expected.slug)
    if (!recipe) {
      fail(`receita ausente: ${expected.slug}`)
      continue
    }

    if (!recipe.active) fail(`receita inativa: ${expected.slug}`)
    if (!recipe.publishedAt) fail(`receita sem publishedAt: ${expected.slug}`)
    if (recipe.category?.slug !== expected.categorySlug) {
      fail(`categoria incorreta em ${expected.slug}: ${recipe.category?.slug || 'sem categoria'}`)
    }

    if (!recipe.imageUrl) {
      fail(`receita sem imageUrl: ${expected.slug}`)
    } else if (recipe.imageUrl !== expected.imageUrl) {
      fail(`imageUrl incorreta em ${expected.slug}: ${recipe.imageUrl} (esperado ${expected.imageUrl})`)
    } else if (!fs.existsSync(resolvePublicAsset(recipe.imageUrl))) {
      fail(`imageUrl nao existe em frontend/public para ${expected.slug}: ${recipe.imageUrl}`)
    }

    if (recipe.ingredients.length !== expected.ingredients) {
      fail(`ingredientes incorretos em ${expected.slug}: ${recipe.ingredients.length}/${expected.ingredients}`)
    }
    if (recipe.steps.length !== expected.steps) {
      fail(`passos incorretos em ${expected.slug}: ${recipe.steps.length}/${expected.steps}`)
    }
    if (recipe.products.length !== expected.products) {
      fail(`produtos vinculados incorretos em ${expected.slug}: ${recipe.products.length}/${expected.products}`)
    }
    if (recipe.relatedTo.length !== expected.related) {
      fail(`relacionadas incorretas em ${expected.slug}: ${recipe.relatedTo.length}/${expected.related}`)
    }

    for (const relation of recipe.relatedTo) {
      if (!relation.relatedRecipe?.active) {
        fail(`relacionada inativa/ausente em ${expected.slug}: ${relation.relatedRecipeId}`)
      }
      if (relation.relatedRecipeId === recipe.id) {
        fail(`receita relacionada para si mesma: ${expected.slug}`)
      }
    }

    for (const item of recipe.products) {
      if (!item.product?.active) {
        fail(`produto inativo/ausente em ${expected.slug}: ${item.productId}`)
      }
    }
  }
}

async function main() {
  await validateCategories()
  await validateRecipes()

  if (failures.length > 0) {
    console.error('Validacao do acervo editorial staging falhou:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`Validacao do acervo editorial staging OK: ${expectedRecipes.length} receitas, ${expectedCategories.length} categorias.`)
}

main()
  .catch((error) => {
    console.error('Erro ao validar acervo editorial staging:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
