const degradedHealth = {
  status: 'degraded',
  version: '1.24.46-alpha',
  services: {
    database: { status: 'ok', latencyMs: 12 },
    redis: { status: 'degraded', latencyMs: 140 },
    meilisearch: { status: 'ok', latencyMs: 22 },
    solidcom: { status: 'down', latencyMs: 0 },
  },
}

const okHealth = {
  status: 'ok',
  version: '1.24.46-alpha',
  services: {
    database: { status: 'ok', latencyMs: 10 },
    redis: { status: 'ok', latencyMs: 18 },
    meilisearch: { status: 'ok', latencyMs: 20 },
    solidcom: { status: 'ok', latencyMs: 35 },
  },
}

function mockDashboardReads() {
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
  cy.intercept('GET', '**/orders/analytics/sales*', {
    period: 'week',
    data: [{ date: '2026-06-01', total: 100, orders: 2 }],
  })
  cy.intercept('GET', '**/orders/analytics/status*', { total: 2, data: [{ status: 'CONFIRMED', count: 2 }] })
  cy.intercept('GET', '**/orders/analytics/revenue*', {
    today: 100,
    week: 500,
    month: 2000,
    delta: {
      todayVsYesterday: 10,
      weekVsPreviousWeek: 8,
      monthVsPreviousMonth: 12,
    },
  })
  cy.intercept('GET', '**/admin/picking/tasks*', [])
  cy.intercept('GET', '**/admin/picking/eligible-orders*', [])
  cy.intercept('GET', '**/admin/picking/performance*', {
    totals: { tasks: 0, completed: 0, delayed: 0 },
    pickers: [],
  })
  cy.intercept('GET', '**/integrations/operations/panel*', {
    deadLetters: 0,
    outbox: {},
    jobs: {},
  })
  cy.intercept('GET', '**/integrations/solidcom/status*', {
    enabled: false,
    productsCount: 0,
    lastSync: null,
    history: [],
  })
}

describe('Status dos Servicos - UI kit operacional', () => {
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

  function visitDashboard() {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.clear()
        win.sessionStorage.clear()
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.url().should('not.include', '/login')
    cy.contains('Dashboard').should('be.visible')
    cy.contains('Status dos Serviços').scrollIntoView().should('be.visible')
  }

  beforeEach(() => {
    mockDashboardReads()
  })

  it('renderiza badge geral e servicos com latencia', () => {
    cy.intercept('GET', '**/health/detail*', degradedHealth).as('getSystemHealth')
    visitDashboard()

    cy.wait('@getSystemHealth')
    cy.contains('Degradado').should('be.visible')
    cy.contains('Banco de dados').should('be.visible')
    cy.contains('Cache (Redis)').should('be.visible')
    cy.contains('Busca (Meili)').should('be.visible')
    cy.contains('ERP (Solidcom)').should('be.visible')
    cy.contains('140ms').should('be.visible')
    cy.contains('v1.24.46-alpha').should('be.visible')
  })

  it('atualiza manualmente o status via botao do UI kit', () => {
    let calls = 0
    cy.intercept('GET', '**/health/detail*', (req) => {
      calls += 1
      req.reply(calls === 1 ? degradedHealth : okHealth)
    }).as('getSystemHealth')
    visitDashboard()

    cy.wait('@getSystemHealth')
    cy.contains('Degradado').should('be.visible')
    cy.get('button[aria-label="Atualizar status"]').click()
    cy.wait('@getSystemHealth')
    cy.contains('Sistema operacional').should('be.visible')
    cy.contains('35ms').should('be.visible')
  })

  it('exibe erro quando a consulta de saude falha', () => {
    cy.intercept('GET', '**/health/detail*', {
      statusCode: 503,
      body: { message: 'Indisponivel' },
    }).as('getSystemHealth')
    visitDashboard()

    cy.wait('@getSystemHealth')
    cy.contains('Não foi possível consultar o status do sistema').should('be.visible')
  })
})
