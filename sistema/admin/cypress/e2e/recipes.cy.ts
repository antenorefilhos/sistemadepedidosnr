const categories = [
  { id: 'recipe-cat-ui-1', name: 'Churrasco UI', slug: 'churrasco-ui' },
  { id: 'recipe-cat-ui-2', name: 'Sobremesas UI', slug: 'sobremesas-ui' },
]

const recipes = [
  {
    id: 'recipe-ui-1',
    title: 'Picanha UI Kit',
    slug: 'picanha-ui-kit',
    description: 'Receita operacional de picanha',
    prepTime: 45,
    servings: 4,
    difficulty: 'EASY',
    active: true,
    publishedAt: '2026-06-01T09:00:00.000Z',
    category: { name: 'Churrasco UI', slug: 'churrasco-ui' },
  },
  {
    id: 'recipe-ui-2',
    title: 'Pudim UI Kit',
    slug: 'pudim-ui-kit',
    description: 'Receita operacional de pudim',
    prepTime: 80,
    servings: 8,
    difficulty: 'MEDIUM',
    active: false,
    publishedAt: null,
    category: { name: 'Sobremesas UI', slug: 'sobremesas-ui' },
  },
]

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?recipes\/categories$/, categories).as('getRecipeCategories')
  cy.intercept('GET', /\/(?:api\/)?recipes\?.*/, {
    data: recipes,
    total: recipes.length,
    page: 1,
    limit: 20,
    hasNextPage: false,
  }).as('getRecipes')
  cy.intercept('POST', /\/(?:api\/)?recipes$/, {
    ...recipes[0],
    id: 'recipe-ui-created',
    title: 'Bolo de Cenoura UI',
    slug: 'bolo-de-cenoura-ui',
  }).as('createRecipe')
  cy.intercept('PUT', /\/(?:api\/)?recipes\/recipe-ui-1$/, {
    ...recipes[0],
    title: 'Picanha Premium UI',
    active: false,
  }).as('updateRecipeOne')
  cy.intercept('DELETE', /\/(?:api\/)?recipes\/recipe-ui-2$/, {}).as('deleteRecipeTwo')

  cy.intercept('GET', '**/customers*', [])
  cy.intercept('GET', '**/admin/orders*', [])
  cy.intercept('GET', '**/products/admin/availability-metrics*', {
    lowStockProducts: 0,
    alwaysEnabledWithZeroStock: 0,
    inactiveWithStock: 0,
  })
  cy.intercept('GET', '**/products/admin*', { data: [], page: 1, totalPages: 1 })
  cy.intercept('GET', '**/products/mercadological-tree*', { data: [] })
  cy.intercept('GET', '**/products/analytics/top*', [])
  cy.intercept('GET', '**/products*', [])
  cy.intercept('GET', '**/orders/analytics/sales*', { period: 'week', data: [] })
  cy.intercept('GET', '**/orders/analytics/status*', { total: 0, data: [] })
  cy.intercept('GET', '**/orders/analytics/revenue*', {
    today: 0,
    week: 0,
    month: 0,
    delta: {
      todayVsYesterday: 0,
      weekVsPreviousWeek: 0,
      monthVsPreviousMonth: 0,
    },
  })
  cy.intercept('GET', '**/admin/picking/tasks*', [])
  cy.intercept('GET', '**/admin/picking/eligible-orders*', [])
  cy.intercept('GET', '**/admin/picking/performance*', {
    totals: { tasks: 0, completed: 0, delayed: 0 },
    pickers: [],
  })
  cy.intercept('GET', '**/integrations/operations/panel*', {})
  cy.intercept('GET', '**/integrations/solidcom/status*', {
    provider: 'solidcom',
    connected: true,
    lastSyncAt: '2026-06-01T09:00:00.000Z',
  })
}

describe('Receitas - UI kit operacional', () => {
  let adminToken = ''
  let adminData = {
    id: 'admin',
    email: 'admin@antenor.com.br',
    name: 'Admin Antenor',
    role: 'admin',
  }

  before(() => {
    cy.task<{ access_token: string; admin?: typeof adminData }>('adminAuth').then((auth) => {
      adminToken = auth.access_token
      adminData = auth.admin || adminData
    })
  })

  beforeEach(() => {
    mockDashboardReads()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.contains('Receitas').click()
    cy.get('h1').should('contain', 'Receitas')
    cy.wait('@getRecipes')
  })

  it('renderiza tabela, badges e acoes com dados de receitas', () => {
    cy.contains('Picanha UI Kit').should('be.visible')
    cy.contains('picanha-ui-kit').should('be.visible')
    cy.contains('Churrasco UI').should('be.visible')
    cy.contains('Facil').should('be.visible')
    cy.contains('Ativa').should('be.visible')
    cy.contains('Pudim UI Kit').should('be.visible')
    cy.contains('Inativa').should('be.visible')
  })

  it('cria receita com slug automatico e selects do UI kit', () => {
    cy.contains('button', 'Nova receita').click()
    cy.contains('Nova receita').should('be.visible')

    cy.contains('label', 'Titulo *').parent().find('input').type('Bolo de Cenoura UI')
    cy.contains('label', 'Slug *').parent().find('input').should('have.value', 'bolo-de-cenoura-ui')
    cy.contains('label', 'Descricao').parent().find('textarea').type('Receita simples para vitrine')
    cy.contains('label', 'Tempo de preparo').parent().find('input').type('35')
    cy.contains('label', 'Porcoes').parent().find('input').type('6')
    cy.contains('label', 'Dificuldade').parent().find('select').select('MEDIUM')
    cy.contains('label', 'Categoria').parent().find('select').select('recipe-cat-ui-2')
    cy.contains('button', 'Criar receita').click()

    cy.wait('@createRecipe').its('request.body').should((body) => {
      expect(body.title).to.eq('Bolo de Cenoura UI')
      expect(body.slug).to.eq('bolo-de-cenoura-ui')
      expect(body.difficulty).to.eq('MEDIUM')
      expect(body.categoryId).to.eq('recipe-cat-ui-2')
      expect(body.prepTime).to.eq(35)
      expect(body.servings).to.eq(6)
    })
  })

  it('edita, alterna status e remove receita pelo modal', () => {
    cy.contains('Picanha UI Kit').parents('tr').within(() => {
      cy.get('button[title="Desativar"]').click()
    })
    cy.wait('@updateRecipeOne').its('request.body').should('deep.eq', { active: false })

    cy.contains('Picanha UI Kit').parents('tr').within(() => {
      cy.get('button[title="Editar"]').click()
    })
    cy.contains('Editar receita').should('be.visible')
    cy.contains('label', 'Titulo *').parent().find('input').clear().type('Picanha Premium UI')
    cy.contains('button', 'Salvar alteracoes').click()
    cy.wait('@updateRecipeOne').its('request.body').should((body) => {
      expect(body.title).to.eq('Picanha Premium UI')
      expect(body.slug).to.eq('picanha-ui-kit')
    })

    cy.contains('Pudim UI Kit').parents('tr').within(() => {
      cy.get('button[title="Excluir"]').click()
    })
    cy.contains('Excluir receita?').should('be.visible')
    cy.contains('Esta acao remove "Pudim UI Kit"').should('be.visible')
    cy.contains('button', 'Excluir').click()
    cy.wait('@deleteRecipeTwo')
  })
})
