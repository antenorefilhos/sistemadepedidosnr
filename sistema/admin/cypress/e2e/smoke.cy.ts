describe('Smoke Test - Painel Admin', () => {
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

  it('Deve carregar a página de login', () => {
    cy.visit('/login')
    cy.get('img[alt="Antenor & Filhos"]').should('be.visible')
    cy.get('input[type="email"]').should('be.visible')
  })

  it('Deve realizar login com sucesso', () => {
    cy.intercept('POST', '**/auth/login', (req) => {
      expect(req.body).to.deep.eq({
        email: 'admin@antenor.com.br',
        password: 'admin2026',
      })

      req.reply({
        statusCode: 200,
        body: {
          access_token: adminToken,
          admin: adminData,
        },
      })
    }).as('login')

    cy.visit('/login')
    cy.get('input[type="email"]').type('admin@antenor.com.br')
    cy.get('input[type="password"]').type('admin2026')
    cy.get('button').contains('Entrar').click()
    cy.wait('@login')
    
    // Deve redirecionar para o dashboard
    cy.url().should('not.include', '/login')
    cy.contains('Dashboard').should('be.visible')
    cy.contains('Receita Total').should('be.visible')
  })

  it('Deve navegar pelas seções do admin', () => {
    cy.intercept('GET', '**/api/admin/orders*', [])
    cy.intercept('GET', '**/api/customers*', [])
    cy.intercept('GET', '**/api/products/admin/availability-metrics*', {
      lowStockProducts: 0,
      alwaysEnabledWithZeroStock: 0,
      inactiveWithStock: 0,
    })
    cy.intercept('GET', '**/api/products/admin*', { data: [], page: 1, totalPages: 1 })
    cy.intercept('GET', '**/api/products/analytics/top*', [])
    cy.intercept('GET', '**/api/products*', [])
    cy.intercept('GET', '**/api/orders/analytics/sales*', { period: 'week', data: [] })
    cy.intercept('GET', '**/api/orders/analytics/status*', { total: 0, data: [] })
    cy.intercept('GET', '**/api/orders/analytics/revenue*', {
      today: 0,
      week: 0,
      month: 0,
      delta: {
        todayVsYesterday: 0,
        weekVsPreviousWeek: 0,
        monthVsPreviousMonth: 0,
      },
    })
    cy.intercept('GET', '**/api/admin/picking/tasks*', [])
    cy.intercept('GET', '**/api/admin/picking/performance*', [])
    cy.intercept('GET', '**/api/integrations/operations/panel*', {})

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    // Navega para Produtos
    cy.contains('Produtos').click()
    cy.get('h2').should('contain', 'Produtos')
    
    // Navega para Pedidos
    cy.contains('Pedidos').click()
    cy.get('h2').should('contain', 'Pedidos')
  })
})
