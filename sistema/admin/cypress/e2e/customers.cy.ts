const customers = [
  {
    id: 'customer-ui-1',
    name: 'Cliente UI Kit',
    cpf: '12345678901',
    whatsapp: '24999990000',
    email: 'cliente.ui@antenor.com.br',
    createdAt: new Date().toISOString(),
    addresses: [
      {
        id: 'address-ui-1',
        street: 'Rua do UI Kit',
        number: '123',
        complement: 'Casa',
        neighborhood: 'Centro',
        city: 'Valenca',
        state: 'RJ',
        zipCode: '27600000',
      },
    ],
  },
  {
    id: 'customer-ui-2',
    name: 'Cliente Sem Pedido',
    cpf: '98765432100',
    whatsapp: '24999991111',
    email: null,
    createdAt: '2026-01-01T12:00:00.000Z',
    addresses: [],
  },
]

const orders = [
  {
    id: 'order-customer-ui-1',
    customerId: 'customer-ui-1',
    customer: { id: 'customer-ui-1', name: 'Cliente UI Kit' },
    createdAt: new Date().toISOString(),
    status: 'CONFIRMED',
    paymentMethod: 'PIX',
    paymentStatus: 'PAID',
    subtotal: 10,
    discount: 0,
    delivery: 0,
    total: 10,
    items: [],
    events: [],
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/customers/customer-ui-1', customers[0])
  cy.intercept('GET', '**/customers*', customers)
  cy.intercept('GET', '**/admin/orders*', orders)
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

describe('Clientes - UI kit operacional', () => {
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

    cy.contains('Clientes').click()
    cy.get('h2').should('contain', 'Clientes')
    cy.contains('Cliente UI Kit').should('be.visible')
  })

  it('filtra clientes e alterna entre lista e colunas com controles do UI kit', () => {
    cy.get('input[placeholder="Buscar por nome, CPF, WhatsApp ou email..."]').should('be.visible').type('Cliente UI')
    cy.contains('Cliente UI Kit').should('be.visible')
    cy.contains('Cliente Sem Pedido').should('not.exist')

    cy.contains('button', 'Filtrar').click()
    cy.contains('label', 'Filtro de Email').parent().find('select').select('with')
    cy.contains('label', 'Filtro de Endereço').parent().find('select').select('with')
    cy.contains('label', 'Filtro de Pedidos').parent().find('select').select('with-orders')
    cy.contains('label', 'Data de Cadastro').parent().find('select').select('30d')
    cy.contains('Email: Com email').should('be.visible')
    cy.contains('Endereço: Com endereço').should('be.visible')
    cy.contains('Pedidos: Com pedidos').should('be.visible')
    cy.contains('Cadastro: 30 dias').should('be.visible')

    cy.get('button[aria-label="Limpar filtro de email"]').click()
    cy.contains('Email: Com email').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de endereço"]').click()
    cy.contains('Endereço: Com endereço').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de pedidos"]').click()
    cy.contains('Pedidos: Com pedidos').should('not.exist')
    cy.get('button[aria-label="Limpar filtro de cadastro"]').click()
    cy.contains('Cadastro: 30 dias').should('not.exist')

    cy.contains('button', 'Colunas').click()
    cy.contains('Novos (30 dias)').should('be.visible')
    cy.contains('Com Pedidos').should('be.visible')
    cy.contains('Cliente UI Kit').should('be.visible')

    cy.contains('button', 'Lista').click()
    cy.contains('th', 'Pedidos').should('be.visible')
    cy.contains('123.456.789-01').should('be.visible')
  })

  it('abre o perfil do cliente com dados, pedidos e endereco', () => {
    cy.contains('tr', 'Cliente UI Kit').within(() => {
      cy.get('button[title="Ver detalhes"]').click()
    })

    cy.contains('Perfil do Cliente').should('be.visible')
    cy.contains('Dados do Perfil').should('be.visible')
    cy.contains('123.456.789-01').should('be.visible')
    cy.contains('cliente.ui@antenor.com.br').should('be.visible')
    cy.contains('Rua do UI Kit, 123').should('be.visible')

    cy.contains('button', 'Fechar').scrollIntoView().click()
    cy.contains('Perfil do Cliente').should('not.exist')
  })
})
