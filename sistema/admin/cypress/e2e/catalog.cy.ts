const products = [
  {
    id: 'product-ui-1',
    ean: '7891000000011',
    name: 'Produto Alpha UI',
    price: 12.9,
    promotionalPrice: null,
    stock: 3,
    unit: 'UN',
    active: true,
    classification01: 'mercearia',
    classification02: 'massas',
    classification03: null,
    classification04: null,
    badges: 'Oferta',
    syncOption: 'ESTOQUE',
  },
  {
    id: 'product-ui-2',
    ean: '7891000000028',
    name: 'Produto Beta UI',
    price: 8.5,
    promotionalPrice: 7.9,
    stock: 0,
    unit: 'UN',
    active: false,
    classification01: null,
    classification02: null,
    classification03: null,
    classification04: null,
    badges: null,
    syncOption: 'NUNCA',
  },
]

function mockCatalogReads() {
  cy.intercept('GET', '**/admin/orders*', [])
  cy.intercept('GET', '**/customers*', [])
  cy.intercept('GET', '**/products*', products)
  cy.intercept('GET', '**/products/analytics/top*', [])
  cy.intercept('GET', '**/products/admin*', {
    data: products,
    page: 1,
    limit: 10,
    total: products.length,
    totalPages: 1,
  })
  cy.intercept('GET', '**/products/admin/mercadological-tree*', {
    data: [
      {
        value: 'mercearia',
        children: [
          {
            value: 'massas',
            children: [],
          },
        ],
      },
    ],
  })
  cy.intercept('GET', '**/products/admin/availability-metrics*', {
    lowStockProducts: 1,
    alwaysEnabledWithZeroStock: 0,
    inactiveWithStock: 1,
  })
  cy.intercept('GET', '**/cms/categories', {
    data: [
      {
        id: 'cms-category-ui-1',
        name: 'Mercearia',
        slug: 'mercearia',
        active: true,
        priority: 1,
        subcategories: [
          {
            id: 'cms-subcategory-ui-1',
            name: 'Massas',
            slug: 'massas',
            active: true,
            priority: 1,
          },
        ],
      },
    ],
  })
  cy.intercept('GET', '**/api/admin/categories/mappings/by-ean/*', {
    success: true,
    found: false,
    data: null,
  }).as('getCategoryMapping')
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
  cy.intercept('GET', '**/admin/picking/performance*', {
    totals: { tasks: 0, completed: 0, delayed: 0 },
  })
  cy.intercept('GET', '**/integrations/operations/panel*', {})
  cy.intercept('GET', '**/integrations/solidcom/status*', {
    enabled: true,
    productsCount: products.length,
    lastSync: null,
    history: [],
  })
  cy.intercept('GET', '**/health/detail*', {
    status: 'ok',
    timestamp: '2026-06-02T12:00:00.000Z',
    version: 'test',
    services: {
      database: { status: 'ok', latencyMs: 12 },
      redis: { status: 'ok', latencyMs: 8 },
      meilisearch: { status: 'ok', latencyMs: 10 },
      solidcom: { status: 'ok', latencyMs: 20 },
    },
  })
  cy.intercept('PATCH', '**/products/admin/bulk-status', { ok: true }).as('bulkStatus')
  cy.intercept('POST', '**/products/admin/bulk-delete', { ok: true }).as('bulkDelete')
  cy.intercept('DELETE', '**/products/product-ui-1', { ok: true }).as('deleteProduct')
  cy.intercept('POST', '**/uploads/product/7891000000011', {
    success: true,
    url: '/uploads/products/7891000000011.webp',
  }).as('uploadProductImageOne')
  cy.intercept('POST', '**/uploads/product/7891000000011/2', {
    success: true,
    url: '/uploads/products/7891000000011_2.webp',
  }).as('uploadProductImageTwo')
}

describe('Catálogo de Produtos - Hardening Operacional (M39)', () => {
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
    mockCatalogReads()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.contains('Produtos').click()
    cy.get('h2').should('contain', 'Produtos')
    cy.contains('Produto Alpha UI').should('exist')
  })

  it('exibe e interage com os cards KPI de atalho para filtros', () => {
    // Verifica a presença dos 4 atalhos operacionais
    cy.contains('Todos os Produtos').should('be.visible')
    cy.contains('Sem Estoque').should('be.visible')
    cy.contains('Sem Categoria').should('be.visible')
    cy.contains('Inativos').should('be.visible')

    // Clica no card "Sem Estoque" e valida comportamento de atalho
    cy.contains('Sem Estoque').click()
    cy.contains('Sem Estoque').closest('.cursor-pointer').should('have.class', 'from-amber-500') // Verifica se ficou ativo

    // Reseta filtros clicando em "Todos os Produtos"
    cy.contains('Todos os Produtos').click()
    cy.contains('Todos os Produtos').closest('.cursor-pointer').should('have.class', 'from-[#5d082a]')
  })

  it('permite selecionar produtos e exibir a barra flutuante de ações em lote', () => {
    // Certifica-se de que não há barra antes da seleção
    cy.contains('selecionado(s)').should('not.exist')

    // Clica no primeiro checkbox da tabela
    cy.get('table tbody tr').first().find('td').first().find('button').click()

    // A barra flutuante deve surgir
    cy.contains('1 selecionado(s)').should('be.visible')
    cy.contains('Ativar').should('be.visible')
    cy.contains('Desativar').should('be.visible')
    cy.contains('Excluir').should('be.visible')

    // Desmarca o item e a barra deve desaparecer
    cy.contains('Limpar').click()
    cy.contains('selecionado(s)').should('not.exist')
  })

  it('confirma ações de produto pela UI controlada', () => {
    cy.get('table tbody tr').first().find('td').first().find('button').click()
    cy.contains('1 selecionado(s)').should('be.visible')

    cy.contains('button', 'Ativar').click()
    cy.contains('Ativar produtos selecionados?').should('be.visible')
    cy.contains('[role="dialog"]', 'Ativar produtos selecionados?').within(() => {
      cy.contains('button', 'Cancelar').click()
    })
    cy.contains('Ativar produtos selecionados?').should('not.exist')
    cy.contains('1 selecionado(s)').should('be.visible')

    cy.contains('button', 'Desativar').click()
    cy.contains('Inativar produtos selecionados?').should('be.visible')
    cy.contains('[role="dialog"]', 'Inativar produtos selecionados?').within(() => {
      cy.contains('button', 'Inativar produtos').click()
    })
    cy.wait('@bulkStatus').its('request.body').should('deep.include', { active: false })
    cy.contains('selecionado(s)').should('not.exist')

    cy.get('table tbody tr').first().find('button[title="Excluir"]').click({ force: true })
    cy.contains('Inativar produto?').should('be.visible')
    cy.contains('[role="dialog"]', 'Produto Alpha UI').should('be.visible')
    cy.contains('[role="dialog"]', 'Inativar produto?').within(() => {
      cy.contains('button', 'Inativar produto').click()
    })
    cy.wait('@deleteProduct')
    cy.contains('Inativar produto?').should('not.exist')
  })

  it('permite iniciar a edição inline de preço e estoque', () => {
    // Clica no elemento de preço para abrir o input
    cy.get('table tbody tr').first().find('td').eq(3).find('div').first().find('div').first().click()

    // O input de preço deve estar visível
    cy.get('table tbody tr').first().find('td').eq(3).find('input').should('be.visible')

    // Cancela a edição com a tecla Escape
    cy.get('table tbody tr').first().find('td').eq(3).find('input').type('{esc}')
    cy.get('table tbody tr').first().find('td').eq(3).find('input').should('not.exist')
  })

  it('mostra erro controlado quando edição inline recebe preço inválido', () => {
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('windowAlert')
    })

    cy.get('table tbody tr').first().find('td').eq(3).find('div').first().find('div').first().click()
    cy.get('table tbody tr').first().find('td').eq(3).find('input').clear().type('-1{enter}')

    cy.contains('[role="alert"]', 'Preço inválido').should('be.visible')
    cy.get('@windowAlert').should('not.have.been.called')
  })

  it('mostra erro controlado quando exclusão de produto falha', () => {
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('windowAlert')
    })
    cy.intercept('DELETE', '**/products/product-ui-1', {
      statusCode: 400,
      body: { message: 'Falha ao remover produto no teste.' },
    }).as('deleteProductError')

    cy.get('table tbody tr').first().find('button[title="Excluir"]').click({ force: true })
    cy.contains('[role="dialog"]', 'Inativar produto?').within(() => {
      cy.contains('button', 'Inativar produto').click()
    })

    cy.wait('@deleteProductError')
    cy.contains('[role="alert"]', 'Falha ao remover produto no teste.').should('be.visible')
    cy.contains('[role="dialog"]', 'Inativar produto?').should('be.visible')
    cy.get('@windowAlert').should('not.have.been.called')
  })

  it('abre o formulário lateral de produto com os controles do UI kit', () => {
    cy.contains('button', 'Novo Produto').click()

    cy.get('#product-slide-form').should('be.visible')
    cy.contains('Vitrine & Exposição').should('be.visible')
    cy.contains('Dados do ERP').should('be.visible')
    cy.contains('Título de vitrine (principal)').should('exist')
    cy.contains('EAN *').should('exist')
    cy.get('#product-slide-form input').first().should('be.visible')
    cy.contains('Salvar Produto').should('be.visible')

    cy.contains('Cancelar').click()
    cy.get('#product-slide-form').should('not.be.visible')
  })

  it('envia fotos do produto pelos inputs especiais do UI kit', () => {
    cy.contains('tr', 'Produto Alpha UI').find('button[title="Editar"]').click({ force: true })
    cy.get('#product-slide-form').should('be.visible')
    cy.contains('Mídia do Produto').should('be.visible')
    cy.wait('@getCategoryMapping')

    cy.get('input[aria-label="Carregar foto principal do produto"]').selectFile({
      contents: Cypress.Buffer.from('fake-webp-slot-1'),
      fileName: 'produto-principal.webp',
      mimeType: 'image/webp',
    }, { force: true })
    cy.wait('@uploadProductImageOne')
      .its('request.headers.content-type')
      .should('include', 'multipart/form-data')

    cy.get('input[aria-label="Carregar foto auxiliar do produto"]').selectFile({
      contents: Cypress.Buffer.from('fake-webp-slot-2'),
      fileName: 'produto-auxiliar.webp',
      mimeType: 'image/webp',
    }, { force: true })
    cy.wait('@uploadProductImageTwo')
      .its('request.headers.content-type')
      .should('include', 'multipart/form-data')
  })
})
