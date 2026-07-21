const categories = [
  {
    id: 'category-ui-1',
    name: 'Bebidas UI',
    parentId: null,
    bannerUrl: null,
    active: true,
    priority: 0,
    limit: 8,
    curatedProductIds: [],
  },
  {
    id: 'category-ui-2',
    name: 'Hortifruti UI',
    parentId: null,
    bannerUrl: '/uploads/hortifruti-ui.jpg',
    active: false,
    priority: 1,
    limit: 6,
    curatedProductIds: [],
  },
  {
    id: 'category-ui-3',
    name: 'Sucos UI',
    parentId: 'category-ui-1',
    bannerUrl: null,
    active: true,
    priority: 0,
    limit: 4,
    curatedProductIds: [],
  },
]

const mappingStats = {
  success: true,
  data: {
    mapped: 7,
    pending: 2,
    total: 12,
    unmapped: 3,
  },
}

const mappingSuggestions = {
  success: true,
  data: [
    {
      ean: '7890000000028',
      productName: 'Suco de Uva UI',
      categoryId: 'category-ui-3',
      categoryName: 'Sucos UI',
      source: 'mercadological_inference',
      reason: 'Inferido pela classificacao mercadologica de bebidas.',
    },
  ],
}

const pendingMappings = {
  success: true,
  data: [
    {
      id: 'pending-category-ui-1',
      ean: '7890000000035',
      productName: 'Agua Mineral UI',
      suggestedCategoryN1: 'Bebidas',
      suggestedCategoryN2: 'Aguas',
      suggestedCategory: { id: 'category-ui-1', name: 'Bebidas UI' },
      reason: 'Produto importado sem categoria CMS.',
      notes: 'Validar na fila UI kit.',
      createdAt: new Date().toISOString(),
    },
  ],
  pagination: { limit: 25, offset: 0, total: 1 },
}

function mockDashboardReads() {
  cy.intercept('GET', '**/cms/categories', categories).as('getCategories')
  cy.intercept('GET', '**/categories/stats/mapping', mappingStats).as('getMappingStats')
  cy.intercept('GET', '**/admin/categories/mappings/suggestions*', mappingSuggestions).as('getMappingSuggestions')
  cy.intercept('GET', '**/categories/pending/list*', pendingMappings).as('getPendingMappings')
  cy.intercept('POST', '**/admin/categories/mappings/apply-suggestions', {
    success: true,
    dryRun: true,
    applied: 1,
    validation: {
      valid: true,
      total: 1,
      errors: [],
      warnings: [],
    },
  }).as('applySuggestions')
  cy.intercept('POST', '**/admin/categories/pending/pending-category-ui-1/approve', {
    success: true,
  }).as('approvePendingMapping')
  cy.intercept('POST', '**/admin/categories/pending/pending-category-ui-1/reject', {
    success: true,
  }).as('rejectPendingMapping')
  cy.intercept('POST', '**/cms/categories', {
    id: 'category-ui-created',
    name: 'Congelados UI',
    parentId: null,
    bannerUrl: null,
    active: true,
    priority: 2,
    limit: 5,
    curatedProductIds: [],
  }).as('createCategory')
  cy.intercept('PATCH', '**/cms/categories/category-ui-1', (req) => {
    if (req.body?.bannerUrl) {
      req.alias = 'updateCategoryBanner'
      req.reply({ ...categories[0], bannerUrl: req.body.bannerUrl })
      return
    }

    req.alias = 'updateCategory'
    req.reply({ ...categories[0], name: 'Bebidas Premium UI' })
  })
  cy.intercept('PATCH', '**/cms/categories/category-ui-2', { ...categories[1], active: true }).as('toggleCategory')
  cy.intercept('POST', '**/uploads', {
    url: '/uploads/categories/banner-bebidas-ui.webp',
  }).as('uploadCategoryBanner')
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
}

describe('Categorias - UI kit operacional', () => {
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

    cy.contains('Categorias').click()
    cy.get('h2').should('contain', 'Categorias')
    cy.contains('Bebidas UI').should('be.visible')
  })

  it('cria categoria e usa a tabela da estrutura da loja', () => {
    cy.contains('Total').should('be.visible')
    cy.contains('Visíveis').should('be.visible')
    cy.contains('th', 'Banner').should('be.visible')
    cy.contains('td', 'Bebidas UI').should('be.visible')
    cy.contains('td', 'Hortifruti UI').should('be.visible')

    cy.contains('button', 'Nova Categoria').click()
    cy.get('input[placeholder="Ex: Bebidas Geladas"]').type('Congelados UI')
    cy.contains('label', 'Prioridade').parent().find('input').clear().type('2')
    cy.contains('label', 'Limite produtos').parent().find('input').clear().type('5')
    cy.contains('button', 'Criar').click()
    cy.wait('@createCategory')
  })

  it('renomeia, alterna visibilidade e abre confirmacao de exclusao', () => {
    cy.contains('tr', 'Bebidas UI').within(() => {
      cy.get('button[title="Renomear"]').click({ force: true })
    })
    cy.get('input[value="Bebidas UI"]').clear().type('Bebidas Premium UI{enter}')
    cy.wait('@updateCategory')

    cy.contains('tr', 'Hortifruti UI').within(() => {
      cy.contains('button', 'Não').click()
    })
    cy.wait('@toggleCategory')

    cy.contains('tr', 'Hortifruti UI').within(() => {
      cy.get('button[title="Excluir categoria"]').click()
    })
    cy.contains('Excluir categoria').should('be.visible')
    cy.contains('button', 'Cancelar').click()
    cy.contains('Excluir categoria').should('not.exist')
  })

  it('mostra erro controlado quando exclusao falha', () => {
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('windowAlert')
    })
    cy.intercept('DELETE', '**/cms/categories/category-ui-2', {
      statusCode: 500,
      body: { message: 'Falha simulada ao excluir categoria.' },
    }).as('deleteCategoryError')

    cy.contains('tr', 'Hortifruti UI').within(() => {
      cy.get('button[title="Excluir categoria"]').click()
    })
    cy.contains('[role="dialog"]', 'Excluir categoria').should('be.visible')
    cy.contains('[role="dialog"]', 'Hortifruti UI').should('be.visible')
    cy.contains('[role="dialog"] button', 'Excluir').click()

    cy.wait('@deleteCategoryError')
    cy.contains('[role="alert"]', 'Erro interno do servidor. Tente novamente.').should('be.visible')
    cy.get('@windowAlert').should('not.have.been.called')

    cy.contains('[role="dialog"] button', 'Cancelar').click()
    cy.contains('Erro interno do servidor. Tente novamente.').should('not.exist')
  })

  it('envia banner de categoria pelo input especial do UI kit', () => {
    cy.contains('tr', 'Bebidas UI')
      .find('input[aria-label="Enviar banner da categoria Bebidas UI"]')
      .selectFile({
        contents: Cypress.Buffer.from('fake-category-banner'),
        fileName: 'banner-bebidas.webp',
        mimeType: 'image/webp',
      }, { force: true })

    cy.wait('@uploadCategoryBanner')
      .its('request.headers.content-type')
      .should('include', 'multipart/form-data')
    cy.wait('@updateCategoryBanner')
      .its('request.body')
      .should('deep.include', { bannerUrl: '/uploads/categories/banner-bebidas-ui.webp' })
  })

  it('executa dry-run das sugestoes automaticas com controles do UI kit', () => {
    cy.contains('button', '2. Sugestões automáticas').click()
    cy.wait('@getMappingStats')
    cy.wait('@getMappingSuggestions')
    cy.wait('@getPendingMappings')

    cy.contains('Aplicar mapeamento EAN').should('be.visible')
    cy.contains('Mapeados').should('be.visible')
    cy.contains('7').should('be.visible')
    cy.contains('Suco de Uva UI').should('be.visible')
    cy.contains('Sucos UI').should('be.visible')

    cy.contains('button', 'Dry-run').click()
    cy.wait('@applySuggestions')
    cy.contains('Dry-run concluído').should('be.visible')
    cy.contains('Aplicados: 1').should('be.visible')
  })

  it('aprova e rejeita pendencias de categorizacao na revisao final', () => {
    cy.contains('button', '3. Revisão final').click()
    cy.wait('@getMappingStats')
    cy.wait('@getMappingSuggestions')
    cy.wait('@getPendingMappings')

    cy.contains('Pendências de categorização').should('be.visible')
    cy.contains('Agua Mineral UI').scrollIntoView().should('be.visible')
    cy.contains('Produto importado sem categoria CMS.').should('exist')

    cy.contains('button', 'Aprovar').click()
    cy.wait('@approvePendingMapping')

    cy.contains('button', 'Rejeitar').click()
    cy.wait('@rejectPendingMapping')
  })
})
