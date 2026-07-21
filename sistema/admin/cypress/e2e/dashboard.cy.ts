describe('Admin Dashboard - KPI e Analytics', () => {
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
    cy.intercept('GET', '**/admin/orders*', [])
    cy.intercept('GET', '**/customers*', [])
    cy.intercept('GET', '**/products*', [])
    cy.intercept('GET', '**/products/analytics/top*', [])
    cy.intercept('GET', '**/products/admin*', { data: [], page: 1, totalPages: 1 })
    cy.intercept('GET', '**/products/admin/mercadological-tree*', { data: [] })
    cy.intercept('GET', '**/products/admin/availability-metrics*', {
      lowStockProducts: 0,
      alwaysEnabledWithZeroStock: 0,
      inactiveWithStock: 0,
    })
    cy.intercept('GET', '**/orders/analytics/sales*', (req) => {
      const period = new URL(req.url).searchParams.get('period') || 'week'
      if (period === 'month') {
        req.alias = 'salesAnalyticsMonth'
      }
      req.reply({
        period,
        data: [
          { date: '2026-06-01', total: 100, orders: 2 },
        ],
      })
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
    cy.intercept('GET', '**/admin/picking/performance*', {
      totals: { tasks: 0, completed: 0, delayed: 0 },
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

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.url().should('not.include', '/login')
    cy.contains('Dashboard').should('be.visible')
  })

  it('exibe os 4 KPIs principais com valores', () => {
    cy.contains('Receita Total').should('be.visible')
    cy.contains('Pedidos').should('be.visible')
    cy.contains('Clientes').should('be.visible')
    cy.contains('Produtos').should('be.visible')
    cy.contains('R$').should('be.visible')
  })

  it('mostra contexto de tendência com período de comparação', () => {
    cy.contains(/vs\.\s*últimos 30 dias/i).should('be.visible')
    cy.contains(/vs\.\s*últimos 7 dias/i).should('be.visible')
    cy.contains(/\d+%/).should('be.visible')
  })

  it('permite trocar período da performance de vendas com Select do UI kit', () => {
    cy.get('select[aria-label="Período de vendas"]').scrollIntoView().should('be.visible').select('week')
    cy.contains('Performance de Vendas').should('be.visible')
    cy.get('select[aria-label="Período de vendas"]').should('have.value', 'week')

    cy.get('select[aria-label="Período de vendas"]').select('month')
    cy.wait('@salesAnalyticsMonth')
      .its('request.url')
      .should('include', 'period=month')
    cy.get('select[aria-label="Período de vendas"]').should('have.value', 'month')
  })

  it('renderiza blocos de analytics e infraestrutura', () => {
    cy.contains('Top 5 Produtos (Volume)').scrollIntoView().should('exist')
    cy.contains('Resumo de Crescimento').scrollIntoView().should('exist')
    cy.contains('Status dos Serviços').scrollIntoView().should('exist')
    cy.contains('Banco de dados', { timeout: 10000 }).should('be.visible')
  })

  it('navega entre seções operacionais do admin', () => {
    cy.contains('Produtos').click()
    cy.get('h2').should('contain', 'Produtos')
    cy.get('button[aria-label="Produtos"]').should('have.attr', 'aria-current', 'page')

    cy.contains('Pedidos').click()
    cy.get('h2').should('contain', 'Pedidos')
    cy.get('button[aria-label="Pedidos"]').should('have.attr', 'aria-current', 'page')

    cy.contains('Clientes').click()
    cy.get('h2').should('contain', 'Clientes')
    cy.get('button[aria-label="Clientes"]').should('have.attr', 'aria-current', 'page')
  })

  it('abre a sidebar mobile com Button do UI kit', () => {
    cy.viewport(390, 844)
    cy.get('button[aria-label="Abrir menu principal"]').should('be.visible').click()
    cy.get('#sidebar').should('be.visible')
    cy.get('button[aria-label="Produtos"]').click()
    cy.get('h2').should('contain', 'Produtos')
    cy.get('#sidebar').should('not.be.visible')
  })

  it('encerra sessão pelo botão de logout do shell', () => {
    cy.get('button[aria-label="Sair da conta"]').should('be.visible').click()
    cy.url().should('include', '/login')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('adminToken')).to.equal(null)
      expect(win.localStorage.getItem('adminData')).to.equal(null)
    })
  })
})
