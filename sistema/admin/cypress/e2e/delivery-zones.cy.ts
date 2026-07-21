const zones = [
  {
    id: 'zone-ui-1',
    name: 'Zona Centro UI',
    type: 'CEP_RANGE',
    cepStart: '25000-000',
    cepEnd: '25999-999',
    polygonGeoJSON: null,
    fee: 8.5,
    freeAbove: 150,
    active: true,
    priority: 10,
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'zone-ui-2',
    name: 'Zona Serra UI',
    type: 'GEO_POLYGON',
    cepStart: null,
    cepEnd: null,
    polygonGeoJSON: JSON.stringify({
      type: 'Polygon',
      coordinates: [[[-43.13, -22.31], [-43.12, -22.31], [-43.12, -22.32], [-43.13, -22.31]]],
    }),
    fee: 15,
    freeAbove: null,
    active: false,
    priority: 5,
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
]

const slots = [
  {
    id: 'slot-ui-1',
    type: 'DELIVERY',
    startsAt: '2026-06-01T10:00:00.000Z',
    endsAt: '2026-06-01T12:00:00.000Z',
    capacityOrders: 10,
    reservedOrders: 4,
    capacityItems: 80,
    reservedItems: 25,
    occupancyPercent: 40,
    isFull: false,
    cutoffExpired: false,
    status: 'ACTIVE',
  },
]

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?delivery\/zones$/, zones).as('getDeliveryZones')
  cy.intercept('POST', /\/(?:api\/)?delivery\/zones$/, {
    ...zones[0],
    id: 'zone-ui-created',
    name: 'Zona Nova UI',
  }).as('createDeliveryZone')
  cy.intercept('PATCH', /\/(?:api\/)?delivery\/zones\/zone-ui-1$/, {
    ...zones[0],
    active: false,
    name: 'Zona Centro Premium UI',
  }).as('updateDeliveryZoneOne')
  cy.intercept('DELETE', /\/(?:api\/)?delivery\/zones\/zone-ui-2$/, {}).as('deleteDeliveryZoneTwo')

  cy.intercept('GET', /\/(?:api\/)?admin\/fulfillment\/slots(?:\?.*)?$/, slots).as('getFulfillmentSlots')
  cy.intercept('POST', /\/(?:api\/)?admin\/fulfillment\/slots$/, {
    ...slots[0],
    id: 'slot-ui-created',
    capacityOrders: 12,
  }).as('createFulfillmentSlot')

  cy.intercept('GET', /\/(?:api\/)?brand$/, { freeShippingThreshold: 150 }).as('getBrandConfig')
  cy.intercept('PUT', /\/(?:api\/)?brand$/, { freeShippingThreshold: 180 }).as('updateBrandConfig')

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
  cy.intercept('GET', '**/integrations/solidcom/status*', {
    provider: 'solidcom',
    connected: true,
    lastSyncAt: '2026-06-01T09:00:00.000Z',
  })
}

function replaceInput(subject: Cypress.Chainable<JQuery<HTMLInputElement>>, value: string) {
  subject.then(($input) => {
    const input = $input[0]
    const win = input.ownerDocument.defaultView
    const setter = win && Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    if (win) {
      input.dispatchEvent(new win.Event('input', { bubbles: true }))
      input.dispatchEvent(new win.Event('change', { bubbles: true }))
    }
  })
}

function zoneCard(name: string) {
  return cy.contains('span', name).parents('[class*="bg-white"][class*="border"]').first()
}

describe('Taxas de Entrega - UI kit operacional', () => {
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
        win.localStorage.clear()
        win.sessionStorage.clear()
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.get('button[aria-label="Taxas de Entrega"]').click()
    cy.get('h1').should('contain', 'Zonas de Entrega')
    cy.wait('@getDeliveryZones')
    cy.wait('@getFulfillmentSlots')
    cy.wait('@getBrandConfig')
    cy.contains('Zona Centro UI').should('be.visible')
  })

  it('renderiza resumo, frete global e zonas existentes', () => {
    cy.contains('Ocupacao de janelas').should('be.visible')
    cy.contains('4/10 pedidos').should('be.visible')
    cy.contains('Frete grátis global').should('be.visible')
    cy.get('input[placeholder="Ex: 150,00"]').should('have.value', '150')
    cy.contains('Zona Centro UI').should('be.visible')
    cy.contains('CEP 25000-000 - 25999-999').should('be.visible')
    cy.contains('Zona Serra UI').should('be.visible')
    cy.contains('Inativa').should('be.visible')
  })

  it('salva frete global e cria janela de entrega', () => {
    cy.get('input[placeholder="Ex: 150,00"]').clear().type('180').should('have.value', '180')
    cy.contains('button', 'Salvar valor minimo').click()
    cy.wait('@updateBrandConfig').its('request.body').should('deep.eq', { freeShippingThreshold: 180 })

    cy.contains('button', 'Nova janela').click()
    cy.contains('h2', 'Nova janela').should('be.visible')
    cy.contains('label', 'Tipo').parent().find('select').select('PICKUP')
    replaceInput(cy.contains('label', 'Inicio').parent().find('input'), '2026-06-01T14:00')
    replaceInput(cy.contains('label', 'Fim').parent().find('input'), '2026-06-01T16:00')
    replaceInput(cy.contains('label', 'Capacidade de pedidos').parent().find('input'), '12')
    replaceInput(cy.contains('label', 'Capacidade de itens').parent().find('input'), '120')
    replaceInput(cy.contains('label', 'Cutoff em minutos').parent().find('input'), '45')
    cy.contains('button', 'Criar janela').click()
    cy.wait('@createFulfillmentSlot').its('request.body').should((body) => {
      expect(body.type).to.eq('PICKUP')
      expect(body.capacityOrders).to.eq(12)
      expect(body.capacityItems).to.eq(120)
      expect(body.cutoffMinutes).to.eq(45)
      expect(body.startsAt).to.include('2026-06-01T')
    })
  })

  it('cria zona por CEP com controles do UI kit', () => {
    cy.contains('button', 'Nova zona').click()
    cy.contains('Nova zona de entrega').should('be.visible')
    cy.contains('label', 'Nome *').parent().find('input').type('Zona Nova UI')
    cy.contains('label', 'Tipo de zona').parent().find('select').select('CEP_RANGE')
    replaceInput(cy.contains('label', 'Prioridade').parent().find('input'), '20')
    cy.contains('label', 'CEP inicial').parent().find('input').type('26000000')
    cy.contains('label', 'CEP final').parent().find('input').type('26999999')
    replaceInput(cy.contains('label', 'Taxa de entrega').parent().find('input'), '9.5')
    cy.contains('label', 'Frete gratis acima').parent().find('input').type('200')
    cy.contains('h2', 'Nova zona de entrega').parent().contains('button', 'Salvar').click()

    cy.wait('@createDeliveryZone').its('request.body').should((body) => {
      expect(body.name).to.eq('Zona Nova UI')
      expect(body.type).to.eq('CEP_RANGE')
      expect(body.cepStart).to.eq('26000-000')
      expect(body.cepEnd).to.eq('26999-999')
      expect(body.fee).to.eq(9.5)
      expect(body.freeAbove).to.eq(200)
      expect(body.priority).to.eq(20)
      expect(body.active).to.eq(true)
    })
  })

  it('alterna, edita e remove zona pelo modal', () => {
    zoneCard('Zona Centro UI').within(() => {
      cy.get('button[title="Desativar"]').click()
    })
    cy.wait('@updateDeliveryZoneOne').its('request.body').should('deep.eq', { active: false })

    zoneCard('Zona Centro UI').within(() => {
      cy.get('button[title="Editar"]').click()
    })
    cy.contains('Editar zona').should('be.visible')
    replaceInput(cy.contains('label', 'Nome *').parent().find('input'), 'Zona Centro Premium UI')
    cy.contains('h2', 'Editar zona').parent().contains('button', 'Salvar').click()
    cy.wait('@updateDeliveryZoneOne').its('request.body').should((body) => {
      expect(body.name).to.eq('Zona Centro Premium UI')
      expect(body.cepStart).to.eq('25000-000')
      expect(body.cepEnd).to.eq('25999-999')
    })

    zoneCard('Zona Serra UI').within(() => {
      cy.get('button[title="Remover"]').click()
    })
    cy.contains('Remover zona?').should('be.visible')
    cy.contains('Esta acao remove "Zona Serra UI"').should('be.visible')
    cy.contains('button', 'Remover').click()
    cy.wait('@deleteDeliveryZoneTwo')
  })
})
