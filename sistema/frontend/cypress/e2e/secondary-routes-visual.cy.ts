type ViewportCase = {
  name: string
  width: number
  height: number
}

const viewports: ViewportCase[] = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'large-mobile', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
]

const products = [
  {
    id: 'secondary-promo-1',
    ean: '7892000000001',
    name: 'Azeite Extra Virgem Oferta',
    alternativeDescription: 'Oferta especial da semana',
    price: 49.9,
    promotionalPrice: 39.9,
    stock: 20,
    isFractional: false,
    fractionStep: null,
    unit: 'UN',
    syncOption: 'SEMPRE',
    active: true,
    category: 'MERCEARIA',
  },
  {
    id: 'secondary-wine-1',
    ean: '7892000000002',
    name: 'Vinho Tinto Reserva Antenor',
    alternativeDescription: 'Rótulo elegante para jantar',
    price: 89.9,
    promotionalPrice: null,
    stock: 10,
    isFractional: false,
    fractionStep: null,
    unit: 'UN',
    badges: 'Reserva',
    syncOption: 'SEMPRE',
    active: true,
    category: 'ADEGA',
  },
  {
    id: 'secondary-recipe-product-1',
    ean: '7892000000003',
    name: 'Massa Grano Duro',
    alternativeDescription: 'Ingrediente de receita',
    price: 14.9,
    promotionalPrice: null,
    stock: 30,
    isFractional: false,
    fractionStep: null,
    unit: 'UN',
    syncOption: 'SEMPRE',
    active: true,
    category: 'MERCEARIA',
  },
]

const recipeCategory = {
  id: 'recipe-category-1',
  name: 'Massas',
  slug: 'massas',
  description: 'Receitas de massas',
  active: true,
  order: 1,
}

const recipe = {
  id: 'recipe-1',
  title: 'Macarrão Cremoso da Casa',
  slug: 'macarrao-cremoso-da-casa',
  description: 'Receita prática para um jantar completo.',
  seoTitle: 'Macarrão Cremoso da Casa',
  seoDescription: 'Receita prática com ingredientes do Antenor.',
  imageUrl: null,
  prepTime: 35,
  servings: 4,
  difficulty: 'EASY',
  categoryId: recipeCategory.id,
  category: recipeCategory,
  ingredients: [
    { id: 'ing-1', name: 'Massa grano duro', quantity: '500', unit: 'g', order: 1 },
    { id: 'ing-2', name: 'Molho de tomate', quantity: '1', unit: 'un', order: 2 },
  ],
  steps: [
    { id: 'step-1', content: 'Cozinhe a massa ate ficar al dente.', order: 1, imageUrl: null },
    { id: 'step-2', content: 'Misture o molho e finalize com queijo.', order: 2, imageUrl: null },
  ],
  products: [
    {
      id: 'recipe-product-1',
      productId: products[2].id,
      product: products[2],
      note: 'Use uma unidade',
      order: 1,
    },
  ],
  relatedTo: [],
  active: true,
  publishedAt: '2026-06-05T12:00:00.000Z',
  createdAt: '2026-06-05T12:00:00.000Z',
}

function mockSecondaryRoutesApi() {
  cy.intercept('GET', '**/brand', {
    statusCode: 200,
    body: {
      storeName: 'Antenor & Filhos',
      logoDesktopUrl: '/branding/logo-horizontal-bordo.png',
      logoMobileUrl: '/branding/logo-branco.png',
      primaryColor: '#5D082A',
      secondaryColor: '#D2BB8A',
      contactWhatsapp: null,
      freeShippingThreshold: 150,
      businessHours: null,
      openMessage: null,
      closedMessage: null,
      countdownLabel: null,
    },
  })

  cy.intercept('GET', '**/products?*', (req) => {
    const category = String(req.query?.category || '').toLowerCase()
    const data = category.includes('adega') ? [products[1]] : products

    req.reply({
      statusCode: 200,
      body: {
        data,
        page: 1,
        limit: 24,
        total: data.length,
        hasNextPage: false,
      },
    })
  }).as('productsQuery')

  cy.intercept('GET', '**/products', {
    statusCode: 200,
    body: {
      data: products,
      page: 1,
      limit: 24,
      total: products.length,
      hasNextPage: false,
    },
  }).as('products')

  cy.intercept('GET', '**/recipes/categories', {
    statusCode: 200,
    body: [recipeCategory],
  }).as('recipeCategories')

  cy.intercept('GET', '**/recipes/macarrao-cremoso-da-casa', {
    statusCode: 200,
    body: recipe,
  }).as('recipeDetail')

  cy.intercept('GET', '**/recipes?active=*', {
    statusCode: 200,
    body: {
      data: [recipe],
      page: 1,
      limit: 12,
      total: 1,
      hasNextPage: false,
    },
  }).as('recipes')
}

function assertNoHorizontalOverflow() {
  cy.window().then((win) => {
    const doc = win.document.documentElement
    const body = win.document.body
    expect(doc.scrollWidth, 'document width').to.be.lte(win.innerWidth + 1)
    expect(body.scrollWidth, 'body width').to.be.lte(win.innerWidth + 1)
  })
}

function assertVisibleWithinWidth(selector: string) {
  cy.get(selector).first().should('be.visible').then(($el) => {
    const rect = $el[0].getBoundingClientRect()
    cy.window().then((win) => {
      expect(rect.left, `${selector} left`).to.be.gte(0)
      expect(rect.right, `${selector} right`).to.be.lte(win.innerWidth + 1)
    })
  })
}

describe('Storefront secondary routes visual smoke', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    mockSecondaryRoutesApi()
  })

  viewports.forEach((viewportCase) => {
    context(`${viewportCase.name} ${viewportCase.width}x${viewportCase.height}`, () => {
      beforeEach(() => {
        cy.viewport(viewportCase.width, viewportCase.height)
      })

      it('mantem Promocoes legivel e sem overflow', () => {
        cy.visit('/promocoes')
        cy.get('h1').contains('Promoções').should('be.visible')
        cy.contains('Azeite Extra Virgem Oferta', { timeout: 10000 }).should('be.visible')
        cy.contains('oferta').should('be.visible')

        assertVisibleWithinWidth('header')
        assertNoHorizontalOverflow()
      })

      it('mantem Adega legivel e sem overflow', () => {
        cy.visit('/adega')
        cy.get('h1').contains('Adega Antenor', { timeout: 10000 }).should('be.visible')
        cy.contains('Cada taça conta').should('be.visible')
        cy.contains('Vinho Tinto Reserva Antenor').should('be.visible')
        cy.get('a[aria-label*="Carrinho com"]').should('be.visible')

        assertVisibleWithinWidth('header')
        assertNoHorizontalOverflow()
      })

      it('mantem Receitas listagem legivel e sem overflow', () => {
        cy.visit('/receitas')
        cy.get('h1').contains('Receitas', { timeout: 10000 }).should('be.visible')
        cy.contains('Macarrão Cremoso da Casa').should('be.visible')
        cy.contains('Massas').should('be.visible')
        cy.contains('Ver receita').should('be.visible')

        assertVisibleWithinWidth('header')
        assertNoHorizontalOverflow()
      })

      it('mantem detalhe de Receita e ingredientes compraveis legiveis', () => {
        cy.visit('/receitas/macarrao-cremoso-da-casa')
        cy.wait('@recipeDetail')

        cy.get('h1').contains('Macarrão Cremoso da Casa').should('be.visible')
        cy.contains('Ingredientes').should('be.visible')
        cy.contains('Modo de preparo').should('be.visible')
        cy.contains('Ingredientes disponíveis').should('be.visible')
        cy.contains('Massa Grano Duro').should('be.visible')

        cy.contains('button', 'Adicionar todos ao carrinho').click()
        cy.contains(/1 item|1 itens/).should('be.visible')
        assertNoHorizontalOverflow()
      })
    })
  })
})
