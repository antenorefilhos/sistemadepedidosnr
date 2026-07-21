const accounts = [
  {
    id: 'business-account-ui-1',
    name: 'Empresa UI Kit Atacado',
    document: '12345678000190',
    status: 'ACTIVE',
    creditLimit: 5000,
    minimumOrder: 250,
    paymentTerms: 'FATURADO_15_DIAS',
    _count: {
      users: 2,
      orders: 4,
      priceLists: 1,
      shoppingLists: 1,
    },
  },
  {
    id: 'business-account-ui-2',
    name: 'Empresa Secundaria',
    document: '98765432000110',
    status: 'ACTIVE',
    creditLimit: 1200,
    minimumOrder: 100,
    paymentTerms: 'PIX',
    _count: {
      users: 1,
      orders: 0,
      priceLists: 0,
      shoppingLists: 0,
    },
  },
]

const financial = {
  id: 'business-account-ui-1',
  name: 'Empresa UI Kit Atacado',
  document: '12345678000190',
  creditLimit: 5000,
  usedCredit: 1500,
  availableCredit: 3500,
  minimumOrder: 250,
  paymentTerms: 'FATURADO_15_DIAS',
  activeUsers: 2,
  orderCount: 4,
}

const shoppingLists = [
  {
    id: 'shopping-list-ui-1',
    name: 'Reposicao Semanal UI',
    businessAccountId: 'business-account-ui-1',
    customerId: 'customer-ui-1',
    customer: {
      id: 'customer-ui-1',
      name: 'Cliente UI Kit',
    },
    items: [
      {
        id: 'shopping-list-item-ui-1',
        productId: 'product-ui-1',
        quantity: 12,
      },
    ],
  },
]

const pendingOrders = [
  {
    id: 'order_b2b_ui_12345678',
    businessAccountId: 'business-account-ui-1',
    businessAccount: {
      id: 'business-account-ui-1',
      name: 'Empresa UI Kit Atacado',
    },
    customerId: 'customer-ui-1',
    customer: {
      id: 'customer-ui-1',
      name: 'Cliente UI Kit',
    },
    createdAt: new Date().toISOString(),
    businessApprovalStatus: 'PENDING',
    status: 'CONFIRMED',
    paymentMethod: 'BILLING',
    paymentStatus: 'PENDING',
    subtotal: 380,
    discount: 0,
    delivery: 0,
    total: 380,
    items: [],
    events: [],
  },
]

const customers = [
  {
    id: 'customer-ui-1',
    name: 'Cliente UI Kit',
    whatsapp: '24999990000',
    email: 'cliente.ui@antenor.com.br',
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/admin/business-accounts/approvals/pending', pendingOrders)
  cy.intercept('GET', '**/admin/business-accounts/business-account-ui-1/financial', financial)
  cy.intercept('GET', '**/admin/business-accounts/business-account-ui-1/shopping-lists', shoppingLists)
  cy.intercept('GET', '**/admin/business-accounts/business-account-ui-2/financial', {
    ...financial,
    id: 'business-account-ui-2',
    name: 'Empresa Secundaria',
    document: '98765432000110',
    creditLimit: 1200,
    usedCredit: 0,
    availableCredit: 1200,
    minimumOrder: 100,
    paymentTerms: 'PIX',
    activeUsers: 1,
    orderCount: 0,
  })
  cy.intercept('GET', '**/admin/business-accounts/business-account-ui-2/shopping-lists', [])
  cy.intercept('GET', '**/admin/business-accounts', accounts)
  cy.intercept('GET', '**/customers*', customers)
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
  cy.intercept('GET', '**/admin/picking/performance*', {
    totals: { tasks: 0, completed: 0, delayed: 0 },
  })
  cy.intercept('GET', '**/integrations/operations/panel*', {})
}

describe('Contas B2B - UI kit operacional', () => {
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

    cy.contains('Contas B2B').click()
    cy.get('h3').should('contain', 'Contas B2B')
    cy.contains('Empresa UI Kit Atacado').should('be.visible')
  })

  it('filtra empresas e exibe resumo financeiro com badges do UI kit', () => {
    cy.get('input[placeholder="Buscar empresa ou CNPJ"]').should('be.visible').type('UI Kit')
    cy.contains('Empresa UI Kit Atacado').should('be.visible')
    cy.contains('Empresa Secundaria').should('not.exist')

    cy.contains('Limite').should('be.visible')
    cy.contains('R$ 5.000,00').should('be.visible')
    cy.contains('Disponivel').should('be.visible')
    cy.contains('R$ 3.500,00').should('be.visible')
    cy.contains('Reposicao Semanal UI').scrollIntoView().should('be.visible')
    cy.contains('1 itens').should('be.visible')
  })

  it('busca cliente, preenche formularios B2B e mostra fila de aprovacao', () => {
    cy.get('input[placeholder="Buscar cliente por nome"]').type('Cliente UI')
    cy.contains('button', 'Buscar').click()
    cy.contains('button', 'Cliente UI Kit').click()
    cy.get('input[placeholder="ID do cliente"]').should('have.value', 'customer-ui-1')
    cy.get('select').select('APPROVER')

    cy.get('input[placeholder="ID do produto"]').first().type('product-ui-1')
    cy.get('input[placeholder="Preco B2B"]').type('18.90')
    cy.get('input[placeholder="Custo opcional"]').type('12.50')

    cy.get('input[placeholder="Nome da lista"]').type('Compra Mensal UI')
    cy.get('input[placeholder="Cliente opcional"]').type('customer-ui-1')
    cy.get('input[placeholder="ID do produto"]').last().type('product-ui-2')
    cy.get('input[placeholder="Qtd."]').clear().type('6')

    cy.contains('Aprovacoes de compra').scrollIntoView()
    cy.contains('tr', '12345678').within(() => {
      cy.contains('Empresa UI Kit Atacado').should('be.visible')
      cy.contains('Cliente UI Kit').should('be.visible')
      cy.contains('Aguardando aprovacao').should('be.visible')
      cy.contains('button', 'Aprovar').should('be.visible')
    })
  })
})
