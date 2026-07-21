const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'tenant_default'

const categories = [
  {
    id: 'recipe-cat-staging-jantar-pratico',
    name: 'Jantar Prático',
    slug: 'jantar-pratico',
    description: 'Receitas simples para o dia a dia com ingredientes que já estão no mercado.',
    order: 10,
  },
  {
    id: 'recipe-cat-staging-churrasco',
    name: 'Churrasco Completo',
    slug: 'churrasco-completo',
    description: 'Cortes, acompanhamentos e bebidas para montar o churrasco sem improviso.',
    order: 20,
  },
  {
    id: 'recipe-cat-staging-lanches',
    name: 'Lanches e Práticos',
    slug: 'lanches-e-praticos',
    description: 'Ideias rápidas para forno, airfryer e mesa de fim de tarde.',
    order: 30,
  },
  {
    id: 'recipe-cat-staging-adega',
    name: 'Adega e Harmonização',
    slug: 'adega-e-harmonizacao',
    description: 'Sugestões de harmonização com vinhos, snacks e produtos premium.',
    order: 40,
  },
]

const recipes = [
  {
    id: 'recipe-staging-picadinho-acem',
    title: 'Picadinho de Acém da Casa',
    slug: 'picadinho-de-acem-da-casa',
    categorySlug: 'jantar-pratico',
    description: 'Picadinho macio para acompanhar arroz, purê ou pão francês, feito com acém em cubos da loja.',
    seoTitle: 'Picadinho de Acém da Casa | Receitas Antenor',
    seoDescription: 'Prepare um picadinho de acém simples, com ingredientes do Antenor e compra direta pelo carrinho.',
    imageUrl: '/recipes/picadinho-de-acem-da-casa.webp',
    prepTime: 45,
    servings: 4,
    difficulty: 'EASY',
    publishedAt: '2026-06-05T09:23:42.352Z',
    relatedSlugs: ['lanche-quente-da-padaria', 'churrasco-de-familia-antenor'],
    ingredients: [
      ['Acém em cubos', '1', 'kg'],
      ['Cebola picada', '1', 'unidade'],
      ['Alho amassado', '3', 'dentes'],
      ['Molho ou tomate maduro', '1', 'xícara'],
      ['Sal, pimenta e cheiro-verde', 'a gosto', null],
    ],
    steps: [
      'Sele o acém em panela quente até dourar bem todos os lados.',
      'Junte cebola, alho e temperos; refogue até perfumar.',
      'Adicione tomate ou molho, cubra com água quente e cozinhe até a carne ficar macia.',
      'Finalize com cheiro-verde e sirva com arroz branco ou pão francês.',
    ],
    products: [
      ['Acém em Cubos (kg)', 'Carne principal da receita'],
      ['Pão Francês Tradicional', 'Acompanhamento para servir com o molho'],
    ],
  },
  {
    id: 'recipe-staging-churrasco-familia',
    title: 'Churrasco de Família Antenor',
    slug: 'churrasco-de-familia-antenor',
    categorySlug: 'churrasco-completo',
    description: 'Seleção objetiva para churrasco de fim de semana com corte premium, linguiça e pão de alho.',
    seoTitle: 'Churrasco de Família | Receitas Antenor',
    seoDescription: 'Monte um churrasco completo com picanha, contra-filé, linguiça artesanal e pão de alho.',
    imageUrl: '/recipes/churrasco-de-familia-antenor.webp',
    prepTime: 60,
    servings: 6,
    difficulty: 'MEDIUM',
    publishedAt: '2026-06-05T10:10:00.000Z',
    relatedSlugs: ['picadinho-de-acem-da-casa', 'tabua-de-vinhos-e-snacks'],
    ingredients: [
      ['Picanha bovina', '1', 'kg'],
      ['Contra-filé grill', '1', 'kg'],
      ['Linguiça artesanal', '700', 'g'],
      ['Pão de alho recheado', '1', 'pacote'],
      ['Sal grosso e vinagrete', 'a gosto', null],
    ],
    steps: [
      'Tempere a picanha e o contra-filé apenas com sal grosso pouco antes da grelha.',
      'Comece pela linguiça em fogo médio para abrir o apetite sem queimar.',
      'Grelhe os cortes em calor forte, descansando a carne antes de fatiar.',
      'Finalize o pão de alho na lateral da churrasqueira e sirva tudo em tábua.',
    ],
    products: [
      ['Picanha Bovina Argentina (kg)', 'Corte premium para o centro da mesa'],
      ['Contra-Filé Grill (kg)', 'Opcao macia para complementar a grelha'],
      ['Linguiça Toscada Artesanal (kg)', 'Entrada do churrasco'],
      ['Pão de Alho Recheado Nobre', 'Acompanhamento pronto para grelha'],
      ['Cerveja Heineken Long Neck', 'Bebida sugerida para servir gelada'],
    ],
  },
  {
    id: 'recipe-staging-noite-pizza',
    title: 'Noite de Pizza Crocante',
    slug: 'noite-de-pizza-crocante',
    categorySlug: 'lanches-e-praticos',
    description: 'Combo rápido para noite de filme: pizza, batata crocante e refrigerante gelado.',
    seoTitle: 'Noite de Pizza Crocante | Receitas Antenor',
    seoDescription: 'Organize uma noite prática com pizza congelada, batata de airfryer e refrigerante gelado.',
    imageUrl: '/recipes/noite-de-pizza-crocante.webp',
    prepTime: 25,
    servings: 3,
    difficulty: 'EASY',
    publishedAt: '2026-06-05T10:20:00.000Z',
    relatedSlugs: ['lanche-quente-da-padaria', 'tabua-de-vinhos-e-snacks'],
    ingredients: [
      ['Pizza congelada', '1', 'unidade'],
      ['Batata frita para airfryer', '400', 'g'],
      ['Refrigerante gelado', '1', 'lata'],
      ['Snack crocante', '1', 'unidade'],
    ],
    steps: [
      'Preaqueça o forno enquanto separa os acompanhamentos.',
      'Leve a pizza ao forno até o queijo borbulhar e a massa firmar.',
      'Prepare a batata na airfryer para chegar crocante junto com a pizza.',
      'Sirva com refrigerante gelado e snacks na mesa.',
    ],
    products: [
      ['Pizza Congelada Sadia 4 Queijos', 'Base da noite pratica'],
      ['Batata Frita McCain 400g', 'Acompanhamento crocante'],
      ['Coca-Cola Lata 350ml', 'Bebida para servir gelada'],
      ['Batata Pringles Original 114g', 'Snack extra para a mesa'],
    ],
  },
  {
    id: 'recipe-staging-lanche-padaria',
    title: 'Lanche Quente da Padaria',
    slug: 'lanche-quente-da-padaria',
    categorySlug: 'lanches-e-praticos',
    description: 'Lanche de fim de tarde com empadão, pão francês e leite para acompanhar.',
    seoTitle: 'Lanche Quente da Padaria | Receitas Antenor',
    seoDescription: 'Prepare uma mesa simples com empadão de frango, pão francês e leite integral.',
    imageUrl: '/recipes/lanche-quente-da-padaria.webp',
    prepTime: 20,
    servings: 4,
    difficulty: 'EASY',
    publishedAt: '2026-06-05T10:30:00.000Z',
    relatedSlugs: ['noite-de-pizza-crocante', 'picadinho-de-acem-da-casa'],
    ingredients: [
      ['Empadão de frango', '1', 'unidade'],
      ['Pão francês', '6', 'unidades'],
      ['Leite integral', '1', 'litro'],
      ['Manteiga ou requeijão', 'a gosto', null],
    ],
    steps: [
      'Aqueça o empadão até o recheio ficar cremoso.',
      'Corte o pão francês e aqueça rapidamente para recuperar a crocância.',
      'Monte a mesa com leite frio ou quente e acompanhamentos simples.',
      'Sirva em porções pequenas para lanche da tarde ou jantar leve.',
    ],
    products: [
      ['Empadão de Frango com Requeijão', 'Produto principal da padaria'],
      ['Pão Francês Tradicional', 'Para acompanhar quente'],
      ['Leite Integral Parmalat 1L', 'Bebida simples para a mesa'],
    ],
  },
  {
    id: 'recipe-staging-tabua-vinhos-snacks',
    title: 'Tábua de Vinhos e Snacks',
    slug: 'tabua-de-vinhos-e-snacks',
    categorySlug: 'adega-e-harmonizacao',
    description: 'Uma tábua fácil para receber bem, combinando vinhos da adega com snacks e chocolate.',
    seoTitle: 'Tábua de Vinhos e Snacks | Receitas Antenor',
    seoDescription: 'Monte uma tábua de harmonização com vinhos, snacks salgados, chocolate e creme de avelã.',
    imageUrl: '/recipes/tabua-de-vinhos-e-snacks.webp',
    prepTime: 15,
    servings: 4,
    difficulty: 'EASY',
    publishedAt: '2026-06-05T10:40:00.000Z',
    relatedSlugs: ['churrasco-de-familia-antenor', 'noite-de-pizza-crocante'],
    ingredients: [
      ['Vinho tinto ou branco', '1', 'garrafa'],
      ['Snack salgado', '2', 'unidades'],
      ['Chocolate', '1', 'barra'],
      ['Creme de avelã', '1', 'pote'],
    ],
    steps: [
      'Escolha um vinho para o perfil da mesa: tinto encorpado, branco fresco ou rose.',
      'Disponha snacks em tigelas pequenas para manter textura e visual.',
      'Quebre o chocolate em pedaços e sirva com pequenas porções de creme de avelã.',
      'Deixe o vinho na temperatura correta e reponha os snacks ao longo do encontro.',
    ],
    products: [
      ['Vinho Argentino Malbec Angelica Zapata', 'Opcao premium para harmonizar'],
      ['Vinho Branco Sauvignon Blanc Errazuriz', 'Opcao fresca para alternar'],
      ['Batata Pringles Original 114g', 'Snack salgado para a tabua'],
      ['Biscoito Doritos Queijo Nacho 140g', 'Snack intenso para contraste'],
      ['Barra de Chocolate Milka Oreo 100g', 'Doce para fechar a mesa'],
      ['Nutella Cream 350g', 'Acompanhamento doce opcional'],
    ],
  },
]

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function findProductsByName(names) {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      name: { in: names },
    },
    select: { id: true, name: true },
  })

  const byExactName = new Map(products.map((product) => [product.name, product]))
  const missing = names.filter((name) => !byExactName.has(name))

  if (missing.length > 0) {
    const all = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })
    const byNormalized = new Map(all.map((product) => [normalize(product.name), product]))

    for (const name of missing.slice()) {
      const fallback = byNormalized.get(normalize(name))
      if (fallback) {
        byExactName.set(name, fallback)
      }
    }
  }

  const stillMissing = names.filter((name) => !byExactName.has(name))
  if (stillMissing.length > 0) {
    throw new Error(`Produtos obrigatorios nao encontrados no staging: ${stillMissing.join(', ')}`)
  }

  return byExactName
}

async function upsertCategories() {
  const result = new Map()

  for (const category of categories) {
    const saved = await prisma.recipeCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        active: true,
        order: category.order,
      },
      create: {
        id: category.id,
        tenantId: TENANT_ID,
        name: category.name,
        slug: category.slug,
        description: category.description,
        active: true,
        order: category.order,
      },
    })
    result.set(category.slug, saved)
  }

  return result
}

async function upsertRecipes(categoryBySlug) {
  const requiredNames = Array.from(new Set(recipes.flatMap((recipe) => recipe.products.map(([name]) => name))))
  const productByName = await findProductsByName(requiredNames)
  const savedRecipes = []

  for (const recipe of recipes) {
    const category = categoryBySlug.get(recipe.categorySlug)
    if (!category) throw new Error(`Categoria nao encontrada para receita ${recipe.slug}: ${recipe.categorySlug}`)

    const data = {
      tenantId: TENANT_ID,
      title: recipe.title,
      description: recipe.description,
      seoTitle: recipe.seoTitle,
      seoDescription: recipe.seoDescription,
      imageUrl: recipe.imageUrl,
      prepTime: recipe.prepTime,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      categoryId: category.id,
      active: true,
      publishedAt: new Date(recipe.publishedAt),
      ingredients: {
        create: recipe.ingredients.map(([name, quantity, unit], order) => ({
          name,
          quantity,
          unit,
          order,
        })),
      },
      steps: {
        create: recipe.steps.map((content, order) => ({
          content,
          order,
        })),
      },
      products: {
        create: recipe.products.map(([name, note], order) => ({
          productId: productByName.get(name).id,
          note,
          order,
        })),
      },
    }

    const saved = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: {
        ...data,
        ingredients: {
          deleteMany: {},
          create: data.ingredients.create,
        },
        steps: {
          deleteMany: {},
          create: data.steps.create,
        },
        products: {
          deleteMany: {},
          create: data.products.create,
        },
        relatedTo: {
          deleteMany: {},
        },
      },
      create: {
        id: recipe.id,
        slug: recipe.slug,
        ...data,
      },
      include: {
        category: true,
        ingredients: true,
        steps: true,
        products: true,
      },
    })

    savedRecipes.push(saved)
  }

  const recipeBySlug = new Map(savedRecipes.map((recipe) => [recipe.slug, recipe]))
  for (const recipe of recipes) {
    const saved = recipeBySlug.get(recipe.slug)
    if (!saved) continue

    const relatedIds = (recipe.relatedSlugs || []).map((slug) => {
      const related = recipeBySlug.get(slug)
      if (!related) throw new Error(`Receita relacionada nao encontrada para ${recipe.slug}: ${slug}`)
      return related.id
    })

    await prisma.recipeRelation.deleteMany({ where: { recipeId: saved.id } })
    if (relatedIds.length > 0) {
      await prisma.recipeRelation.createMany({
        data: relatedIds.map((relatedRecipeId) => ({
          recipeId: saved.id,
          relatedRecipeId,
        })),
        skipDuplicates: true,
      })
    }
  }

  return savedRecipes
}

async function main() {
  const categoryBySlug = await upsertCategories()
  const savedRecipes = await upsertRecipes(categoryBySlug)

  console.log(`Seed editorial de receitas concluido: ${savedRecipes.length} receitas publicadas.`)
  for (const recipe of savedRecipes) {
    console.log(`- ${recipe.slug}: ${recipe.ingredients.length} ingredientes, ${recipe.steps.length} passos, ${recipe.products.length} produtos`)
  }
}

main()
  .catch((error) => {
    console.error('Erro ao aplicar seed editorial de receitas:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
