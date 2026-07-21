const modules = [
  {
    key: 'solidcom',
    name: 'Solidcom',
    enabled: true,
    removable: false,
    notes: 'ERP legado',
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    enabled: false,
    removable: true,
    notes: 'CRM',
  },
  {
    key: 'rdstation',
    name: 'RD Station',
    enabled: false,
    removable: true,
    notes: 'Marketing',
  },
  {
    key: 'meta-pixel',
    name: 'Meta Pixel',
    enabled: false,
    removable: true,
    notes: 'Conversao',
  },
  {
    key: 'nfe',
    name: 'NFe',
    enabled: false,
    removable: true,
    notes: 'Fiscal',
  },
]

const solidcomStatus = {
  enabled: true,
  productsCount: 238,
  note: 'Extensao Solidcom ativa em modo UI kit.',
  lastSync: {
    id: 'sync-ui-1',
    at: '2026-06-02T10:00:00.000Z',
    status: 'SUCCESS',
    synced: 220,
    errors: 1,
    durationMs: 2400,
  },
  history: [],
}

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?integrations\/modules$/, { items: modules }).as('getIntegrationModules')
  cy.intercept('PATCH', /\/(?:api\/)?integrations\/modules\/hubspot$/, (req) => {
    req.reply({ ...modules[1], enabled: req.body.enabled })
  }).as('toggleHubspot')
  cy.intercept('GET', /\/(?:api\/)?integrations\/solidcom\/status$/, solidcomStatus).as('getSolidcomStatus')

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

describe('Integracoes - UI kit operacional', () => {
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

    cy.contains('Integracoes').click()
    cy.get('h2').should('contain', 'Integrações do ecossistema')
    cy.wait('@getIntegrationModules')
    cy.wait('@getSolidcomStatus')
  })

  it('mostra resumo, abre modulos e seleciona conector CRM', () => {
    cy.contains('1 ativa(s)').should('be.visible')
    cy.contains('Módulos Plugáveis').should('be.visible')
    cy.contains('button', 'Mostrar Módulos').click()

    cy.contains('Solidcom').should('be.visible')
    cy.contains('HubSpot').should('be.visible')
    cy.contains('Inativa').should('be.visible')
    cy.contains('Relacionamento e automações').click()
    cy.contains('Contrato interno de cliente, segmento e eventos de jornada.').scrollIntoView().should('be.visible')
    cy.contains('Conector plugável com replay por snapshot.').should('be.visible')
  })

  it('ativa modulo plugavel usando Button do UI kit', () => {
    cy.contains('button', 'Mostrar Módulos').click()
    cy.contains('HubSpot').parents('[role="button"]').within(() => {
      cy.contains('button', 'Ativar extensão').click()
    })

    cy.wait('@toggleHubspot').its('request.body').should('deep.eq', { enabled: true })
    cy.wait('@getIntegrationModules')
  })

  it('renderiza e atualiza status Solidcom', () => {
    cy.contains('Status Solidcom').scrollIntoView().should('be.visible')
    cy.contains('Ativa').should('be.visible')
    cy.contains('220 sincronizados, 1 erros').should('be.visible')
    cy.contains('238').should('be.visible')
    cy.get('button[aria-label="Atualizar"]').click()
    cy.wait('@getSolidcomStatus')
  })
})
