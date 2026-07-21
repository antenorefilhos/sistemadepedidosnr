const paymentTransactions = [
  {
    id: 'payment-transaction-ui-0001',
    orderId: 'order-payment-ui-0001',
    provider: 'MERCADO_PAGO',
    method: 'PIX',
    status: 'PAID',
    amount: 129.9,
    currency: 'BRL',
    providerRef: 'mp-ui-0001',
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-02T10:05:00.000Z',
    events: [
      {
        id: 'payment-event-ui-0001',
        transactionId: 'payment-transaction-ui-0001',
        type: 'payment.paid',
        signatureOk: true,
        providerEventId: 'evt-ui-0001',
        receivedAt: '2026-06-02T10:05:00.000Z',
      },
    ],
    refunds: [
      {
        id: 'payment-refund-ui-0001',
        orderId: 'order-payment-ui-0001',
        transactionId: 'payment-transaction-ui-0001',
        status: 'APPROVED',
        amount: 29.9,
        reason: 'Ajuste operacional',
        providerRef: 'refund-ui-0001',
        createdAt: '2026-06-02T10:10:00.000Z',
      },
    ],
  },
]

const webhookEvents = [
  {
    id: 'webhook-event-ui-0001',
    chargeId: 'charge-ui-0001',
    event: 'payment.paid',
    orderId: 'order-payment-ui-0001',
    status: 'PAID',
    mappedStatus: 'PAID',
    amount: 129.9,
    paidAt: '2026-06-02T10:05:00.000Z',
    createdAt: '2026-06-02T10:05:30.000Z',
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/customers*', [])
  cy.intercept('GET', '**/admin/orders*', [])
  cy.intercept('GET', '**/products/admin/availability-metrics*', {
    lowStockProducts: 0,
    alwaysEnabledWithZeroStock: 0,
    inactiveWithStock: 0,
  })
  cy.intercept('GET', '**/products/admin*', { data: [], page: 1, totalPages: 1 })
  cy.intercept('GET', '**/products/admin/mercadological-tree*', { data: [] })
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

function mockPaymentReads() {
  cy.intercept('GET', '**/integrations/payments/health*', {
    status: 'ready',
    checks: {
      providerName: true,
      providerUrl: true,
      webhookSecret: true,
      pixKey: true,
      manualPixFallback: true,
    },
    notes: 'Gateway pronto para auditoria UI.',
  }).as('getPaymentsHealth')

  cy.intercept('GET', '**/integrations/payments/transactions*', (req) => {
    const status = new URL(req.url).searchParams.get('status')
    req.alias = status === 'PAID' ? 'getPaymentTransactionsPaid' : 'getPaymentTransactions'
    req.reply({
      total: paymentTransactions.length,
      items: paymentTransactions,
    })
  })

  cy.intercept('GET', '**/integrations/payments/webhook/events*', {
    total: webhookEvents.length,
    items: webhookEvents,
  }).as('getPaymentWebhooks')
}

describe('Pagamentos - eventos e webhooks', () => {
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
    mockPaymentReads()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.get('button[aria-label="Pagamentos"]').click()
    cy.get('h2').should('contain', 'Pagamentos')
    cy.wait('@getPaymentsHealth')
    cy.wait('@getPaymentTransactions')
    cy.wait('@getPaymentWebhooks')
  })

  it('renderiza a trilha de transacoes e expande eventos/reembolsos', () => {
    cy.contains('Saude da Integracao').should('be.visible')
    cy.contains('Pronto').should('be.visible')
    cy.contains('Mercado Pago').should('exist')
    cy.contains('R$ 129,90').should('exist')
    cy.contains('button', 'Transacoes').should('have.attr', 'aria-pressed', 'true')

    cy.contains('Mercado Pago').parents('tr').click({ force: true })
    cy.contains('Eventos da transacao (1)').should('exist')
    cy.contains('payment.paid').should('exist')
    cy.contains('Reembolsos (1)').should('exist')
    cy.contains('Ajuste operacional').should('exist')
  })

  it('filtra por status e alterna para webhooks com Button do ui-kit', () => {
    cy.get('select[aria-label="Filtrar por status"]').select('PAID')
    cy.wait('@getPaymentTransactionsPaid').its('request.url').should('include', 'status=PAID')

    cy.contains('button', 'Webhooks').click()
    cy.contains('button', 'Webhooks').should('have.attr', 'aria-pressed', 'true')
    cy.contains('button', 'Transacoes').should('have.attr', 'aria-pressed', 'false')
    cy.contains('Pagamento confirmado').should('be.visible')
    cy.contains('R$ 129,90').should('exist')
  })
})
