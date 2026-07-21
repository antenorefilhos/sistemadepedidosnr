type Product = {
  id: string
  name: string
  price?: number | null
  promotionalPrice?: number | null
}

type Paginated<T> = {
  data: T[]
  total: number
}

type Recipe = {
  title: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  ingredients?: { name: string }[]
  steps?: { content: string }[]
  products?: {
    productId: string
    product: Product
  }[]
  relatedTo?: {
    relatedRecipe: {
      title: string
      slug: string
      imageUrl?: string | null
    }
  }[]
}

function apiBase() {
  return String(Cypress.env('apiUrl') || 'http://localhost:4001').replace(/\/$/, '')
}

function assertNoHorizontalOverflow() {
  cy.window().then((win) => {
    const doc = win.document.documentElement
    const body = win.document.body
    expect(doc.scrollWidth, 'document width').to.be.lte(win.innerWidth + 1)
    expect(body.scrollWidth, 'body width').to.be.lte(win.innerWidth + 1)
  })
}

function getSeoMeta(name: string) {
  return cy.get(`meta[name="${name}"], meta[property="${name}"]`).last()
}

function loadProducts(params = '') {
  const separator = params ? `&${params}` : ''
  return cy
    .request<Paginated<Product>>(`${apiBase()}/products?limit=100${separator}`)
    .then(({ body }) => body.data || [])
}

function loadRecipes() {
  return cy
    .request<Paginated<Recipe>>(`${apiBase()}/recipes?active=true&limit=100`)
    .then(({ body }) => body.data || [])
}

describe('Staging secondary routes - real API', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    cy.viewport(1280, 900)
  })

  it('renderiza Promocoes com dados reais ou empty state honesto', () => {
    loadProducts().then((products) => {
      const promos = products.filter((product) => {
        const price = Number(product.price || 0)
        const promo = Number(product.promotionalPrice || 0)
        return promo > 0 && promo < price
      })

      cy.intercept('GET', '**/products*').as('products')
      cy.visit('/promocoes')
      cy.wait('@products').its('response.statusCode').should('eq', 200)

      cy.get('h1').contains('Promoções').should('be.visible')
      cy.title().should('include', 'Promoções')
      getSeoMeta('description')
        .should('have.attr', 'content')
        .and('include', 'Ofertas')

      if (promos.length > 0) {
        cy.contains(promos[0].name, { timeout: 15000 }).should('be.visible')
        cy.contains(/oferta disponível|ofertas disponíveis/).should('be.visible')
      } else {
        cy.contains('Nenhuma promoção ativa no momento', { timeout: 15000 }).should('be.visible')
        cy.contains('Ver catálogo completo').should('have.attr', 'href', '/mercado')
      }

      assertNoHorizontalOverflow()
    })
  })

  it('renderiza Adega com produtos reais de staging', () => {
    loadProducts('category=Adega').then((wines) => {
      expect(wines.length, 'produtos reais da Adega no staging').to.be.greaterThan(0)

      cy.intercept('GET', '**/products*').as('products')
      cy.visit('/adega')
      cy.wait('@products').its('response.statusCode').should('eq', 200)

      cy.get('h1').contains('Adega Antenor', { timeout: 15000 }).should('be.visible')
      cy.title().should('include', 'Adega Antenor')
      cy.contains('Cada taça conta').should('be.visible')
      cy.contains(wines[0].name, { timeout: 15000 }).should('be.visible')
      cy.get('a[aria-label*="Carrinho com"]').should('be.visible')
      assertNoHorizontalOverflow()
    })
  })

  it('renderiza Receitas com API real e SEO/canonical mesmo sem conteudo publicado', () => {
    loadRecipes().then((recipes) => {
      cy.intercept('GET', '**/recipes?*').as('recipes')
      cy.intercept('GET', '**/recipes/categories').as('recipeCategories')
      cy.visit('/receitas')
      cy.wait('@recipeCategories').its('response.statusCode').should('eq', 200)
      cy.wait('@recipes').its('response.statusCode').should('eq', 200)

      cy.get('h1').contains('Receitas', { timeout: 15000 }).should('be.visible')
      cy.title().should('include', 'Receitas')
      cy.get('link[rel="canonical"]').should('have.attr', 'href').and('include', '/receitas')
      getSeoMeta('description')
        .should('have.attr', 'content')
        .and('include', 'Inspire-se')

      if (recipes.length > 0) {
        cy.contains(recipes[0].title, { timeout: 15000 }).should('be.visible')
        if (recipes[0].imageUrl) {
          cy.get(`img[src="${recipes[0].imageUrl}"]`).should('be.visible')
        }
        cy.contains('Ver receita').should('be.visible')
      } else {
        cy.contains('Nenhuma receita publicada ainda.', { timeout: 15000 }).should('be.visible')
        cy.contains('Em breve novidades quentinhas saindo do forno!').should('be.visible')
      }

      assertNoHorizontalOverflow()
    })
  })

  it('renderiza detalhe de receita real com ingredientes, preparo e carrinho', () => {
    loadRecipes().then((recipes) => {
      expect(recipes.length, 'receitas reais publicadas no staging').to.be.greaterThan(0)

      const recipe = recipes[0]
      cy.intercept('GET', `**/recipes/${recipe.slug}`).as('recipeDetail')
      cy.visit(`/receitas/${recipe.slug}`)
      cy.wait('@recipeDetail').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200)
        cy.wrap(interception.response?.body).as('recipe')
      })

      cy.get<Recipe>('@recipe').then((detail) => {
        expect(detail.ingredients?.length, 'ingredientes da receita real').to.be.greaterThan(0)
        expect(detail.steps?.length, 'modo de preparo da receita real').to.be.greaterThan(0)
        expect(detail.products?.length, 'produtos vinculados da receita real').to.be.greaterThan(0)

        cy.get('h1').contains(detail.title, { timeout: 15000 }).should('be.visible')
        cy.title().should('include', detail.title)
        cy.get('link[rel="canonical"]')
          .should('have.attr', 'href')
          .and('include', `/receitas/${detail.slug}`)
        getSeoMeta('description')
          .should('have.attr', 'content')
          .and('not.be.empty')
        cy.get('meta[property="og:image"]')
          .last()
          .should('have.attr', 'content')
          .and('include', detail.imageUrl || '/og-image.png')

        if (detail.imageUrl) {
          cy.get(`img[src="${detail.imageUrl}"]`).should('be.visible')
        }

        cy.contains('Ingredientes').should('be.visible')
        cy.contains(detail.ingredients![0].name, { timeout: 15000 }).should('be.visible')
        cy.contains('Modo de preparo').should('be.visible')
        cy.contains(detail.steps![0].content).should('be.visible')
        cy.contains('Ingredientes disponíveis').should('be.visible')
        cy.contains(detail.products![0].product.name).should('be.visible')

        if (detail.relatedTo?.length) {
          cy.contains('Receitas relacionadas').should('be.visible')
          cy.contains(detail.relatedTo[0].relatedRecipe.title).should('be.visible')
          if (detail.relatedTo[0].relatedRecipe.imageUrl) {
            cy.get(`img[src="${detail.relatedTo[0].relatedRecipe.imageUrl}"]`).should('be.visible')
          }
        }

        const expectedItems = detail.products!.length
        const expectedItemsLabel = `${expectedItems} ${expectedItems === 1 ? 'item' : 'itens'}`

        cy.contains('button', 'Adicionar todos ao carrinho').click()
        cy.contains(expectedItemsLabel).should('be.visible')
        cy.contains('Ver carrinho').should('be.visible')
      })

      assertNoHorizontalOverflow()
    })
  })
})
