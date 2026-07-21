const orders = [
  {
    id: 'order_ui_12345678',
    customerId: 'customer-ui-1',
    customer: {
      id: 'customer-ui-1',
      name: 'Cliente UI Kit',
      whatsapp: '24999990000',
    },
    createdAt: new Date().toISOString(),
    status: 'CONFIRMED',
    paymentMethod: 'PIX',
    paymentStatus: 'PAID',
    subtotal: 48.9,
    discount: 0,
    delivery: 5,
    total: 53.9,
    notes: 'Troco para: 100,00',
    items: [
      {
        id: 'item-ui-1',
        productId: 'product-ui-1',
        quantity: 2,
        requestedQuantity: 2,
        fulfilledQuantity: 2,
        subtotal: 48.9,
        finalSubtotal: 48.9,
        status: 'PICKED',
        product: { name: 'Produto de Teste UI' },
      },
    ],
    events: [
      {
        id: 'event-ui-1',
        type: 'order.confirmed',
        actorType: 'admin',
        actorId: 'qa',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'order_ui_87654321',
    customerId: 'customer-ui-2',
    customer: {
      id: 'customer-ui-2',
      name: 'Cliente Kanban',
      whatsapp: '24999991111',
    },
    createdAt: new Date().toISOString(),
    status: 'PICKING',
    paymentMethod: 'CASH',
    paymentStatus: 'UNPAID',
    subtotal: 20,
    discount: 0,
    delivery: 0,
    total: 20,
    notes: '',
    items: [],
    events: [],
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/admin/orders*', orders)
  cy.intercept('GET', '**/admin/orders/order_ui_12345678', orders[0])
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
}

describe('Pedidos - UI kit operacional', () => {
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

    cy.contains('Pedidos').click()
    cy.get('h2').should('contain', 'Pedidos')
    cy.contains('Cliente UI Kit').should('be.visible')
  })

  it('filtra pedidos e alterna entre lista e kanban com controles do UI kit', () => {
    cy.get('input[placeholder="Buscar por cliente ou ID..."]').should('be.visible').type('Cliente UI')
    cy.contains('Cliente UI Kit').should('be.visible')
    cy.contains('Cliente Kanban').should('not.exist')

    cy.contains('button', 'Filtrar').click()
    cy.contains('label', 'Status').parent().find('select').select('CONFIRMED')
    cy.contains('label', 'Data do Pedido').parent().find('select').select('today')
    cy.contains('label', 'Forma de Pagamento').parent().find('select').select('PIX')
    cy.contains('label', 'Troco').parent().find('select').select('WITH_CHANGE')
    cy.contains('Status: Confirmado').should('be.visible')
    cy.contains('Data: Hoje').should('be.visible')
    cy.contains('Pagamento: PIX').should('be.visible')
    cy.contains('Troco: Com troco').should('be.visible')

    cy.get('button[aria-label="Limpar filtro de status"]').click()
    cy.contains('Status: Confirmado').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de data"]').click()
    cy.contains('Data: Hoje').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de pagamento"]').click()
    cy.contains('Pagamento: PIX').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de troco"]').click()
    cy.contains('Troco: Com troco').should('not.exist')

    cy.contains('button', 'Kanban').click()
    cy.contains('Confirmado').should('be.visible')
    cy.contains('#12345678').should('exist')

    cy.contains('button', 'Lista').click()
    cy.contains('th', 'Pagamento').should('be.visible')
    cy.contains('Troco: R$ 100,00').should('be.visible')
  })

  it('abre detalhes do pedido com badges, selects e resumo financeiro', () => {
    cy.contains('tr', 'Cliente UI Kit').within(() => {
      cy.get('button[title="Ver detalhes"]').click()
    })

    cy.contains('Detalhes do Pedido').should('be.visible')
    cy.contains('Progresso do Status').should('be.visible')
    cy.contains('Gerenciar Status').parent().find('select').should('have.value', 'CONFIRMED')
    cy.contains('Produto de Teste UI').should('be.visible')
    cy.contains('Dados de Pagamento').scrollIntoView()
    cy.contains('Troco para:').should('be.visible')
    cy.contains('R$ 53,90').should('be.visible')

    cy.contains('button', 'Fechar').scrollIntoView().click()
    cy.contains('Detalhes do Pedido').should('not.exist')
  })

  it('mostra erro controlado quando mudança de status falha', () => {
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('windowAlert')
    })
    cy.intercept('POST', '**/admin/orders/order_ui_12345678/events', {
      statusCode: 400,
      body: { message: 'Falha ao atualizar status no teste.' },
    }).as('updateOrderStatusError')

    cy.contains('tr', 'Cliente UI Kit').find('select').select('PICKING')

    cy.wait('@updateOrderStatusError')
    cy.contains('[role="alert"]', 'Falha ao atualizar status no teste.').should('be.visible')
    cy.get('@windowAlert').should('not.have.been.called')
  })

  it('mostra erro controlado quando atualização de pagamento falha', () => {
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('windowAlert')
    })
    cy.intercept('PUT', '**/orders/order_ui_12345678', {
      statusCode: 400,
      body: { message: 'Falha ao atualizar pagamento no teste.' },
    }).as('updateOrderError')

    cy.contains('tr', 'Cliente UI Kit').within(() => {
      cy.get('button[title="Ver detalhes"]').click()
    })
    cy.contains('Dados de Pagamento').scrollIntoView()
    cy.contains('label', 'Status do Pagamento').parent().find('select').select('FAILED')

    cy.wait('@updateOrderError')
    cy.contains('[role="alert"]', 'Falha ao atualizar pagamento no teste.').scrollIntoView().should('be.visible')
    cy.get('@windowAlert').should('not.have.been.called')
  })

  it('cancela pedido com motivo controlado sem window.prompt', () => {
    cy.window().then((win) => {
      cy.stub(win, 'prompt').as('windowPrompt')
    })
    cy.intercept('POST', '**/admin/orders/order_ui_12345678/cancel', (req) => {
      expect(req.body).to.deep.equal({ reason: 'Cliente pediu cancelamento' })
      req.reply({
        ...orders[0],
        status: 'CANCELLED',
        cancellationReason: 'Cliente pediu cancelamento',
      })
    }).as('cancelOrder')

    cy.contains('tr', 'Cliente UI Kit').within(() => {
      cy.get('button[title="Ver detalhes"]').click()
    })
    cy.contains('Gerenciar Status').parent().find('select').select('CANCELLED')
    cy.get('#order-cancellation-reason').should('be.visible').type('Cliente pediu cancelamento')
    cy.contains('button', 'Confirmar cancelamento').click()

    cy.wait('@cancelOrder')
    cy.get('@windowPrompt').should('not.have.been.called')
    cy.contains('Motivo do Cancelamento:').scrollIntoView().should('be.visible')
  })
})
