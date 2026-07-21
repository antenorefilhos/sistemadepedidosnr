const now = new Date().toISOString()

const eligibleOrders = [
  {
    id: 'order-picking-ui-12345678',
    customerId: 'customer-picking-ui-1',
    customer: {
      id: 'customer-picking-ui-1',
      name: 'Cliente Picking UI',
      whatsapp: '24999990000',
    },
    createdAt: now,
    status: 'CONFIRMED',
    paymentMethod: 'PIX',
    paymentStatus: 'PAID',
    subtotal: 42,
    discount: 0,
    delivery: 0,
    total: 42,
    items: [
      {
        id: 'order-item-picking-ui-1',
        productId: 'product-picking-ui-1',
        quantity: 2,
        requestedQuantity: 2,
        fulfilledQuantity: 0,
        subtotal: 42,
        finalSubtotal: 42,
        status: 'PENDING',
        product: {
          id: 'product-picking-ui-1',
          name: 'Banana Prata UI',
          ean: '7890000000011',
        },
      },
    ],
    events: [],
  },
]

const tasks = [
  {
    id: 'task-picking-ui-1',
    tenantId: 'tenant-ui',
    storeId: 'store-ui',
    orderId: 'order-picking-ui-12345678',
    status: 'IN_PROGRESS',
    priority: 1,
    slaDueAt: now,
    assignedToId: 'separador-ui',
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'task-item-picking-ui-1',
        taskId: 'task-picking-ui-1',
        orderItemId: 'order-item-picking-ui-1',
        productId: 'product-picking-ui-1',
        requestedQuantity: 2,
        pickedQuantity: 0,
        finalWeight: null,
        status: 'PENDING',
        barcode: null,
        notes: null,
      },
    ],
    order: eligibleOrders[0],
    checklist: null,
  },
  {
    id: 'task-picking-ui-conference',
    tenantId: 'tenant-ui',
    storeId: 'store-ui',
    orderId: 'order-picking-ui-12345678',
    status: 'CONFERENCE_PENDING',
    priority: 1,
    slaDueAt: now,
    assignedToId: 'conferente-ui',
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'task-item-picking-ui-conference',
        taskId: 'task-picking-ui-conference',
        orderItemId: 'order-item-picking-ui-1',
        productId: 'product-picking-ui-1',
        requestedQuantity: 2,
        pickedQuantity: 2,
        finalWeight: null,
        status: 'PICKED',
        barcode: '7890000000011',
        notes: null,
      },
    ],
    order: eligibleOrders[0],
    checklist: null,
  },
  {
    id: 'task-picking-ui-packing',
    tenantId: 'tenant-ui',
    storeId: 'store-ui',
    orderId: 'order-picking-ui-12345678',
    status: 'PACKING',
    priority: 1,
    slaDueAt: now,
    assignedToId: 'embalador-ui',
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'task-item-picking-ui-packing',
        taskId: 'task-picking-ui-packing',
        orderItemId: 'order-item-picking-ui-1',
        productId: 'product-picking-ui-1',
        requestedQuantity: 2,
        pickedQuantity: 2,
        finalWeight: null,
        status: 'PICKED',
        barcode: '7890000000011',
        notes: null,
      },
    ],
    order: eligibleOrders[0],
    checklist: null,
  },
]

const performance = {
  period: { from: now, to: now },
  totals: { tasks: 3, completed: 2, delayed: 1 },
  delayedByStage: { IN_PROGRESS: 1 },
  pickers: [
    {
      pickerId: 'separador-ui',
      tasksCompleted: 2,
      itemsPicked: 12,
      itemsMissing: 1,
      substitutions: 1,
      pickingSeconds: 360,
      avgStartDelaySeconds: 30,
      itemsPerMinute: 2,
    },
  ],
  snapshots: [],
}

function mockDashboardReads() {
  cy.intercept('GET', '**/admin/picking/tasks*', tasks).as('getPickingTasks')
  cy.intercept('GET', '**/admin/picking/eligible-orders*', eligibleOrders)
  cy.intercept('GET', '**/admin/picking/performance*', performance)
  cy.intercept('POST', '**/admin/picking/tasks/from-order/order-picking-ui-12345678', tasks[0]).as('createPickingTask')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-1/assign', (req) => {
    expect(req.body).to.deep.equal({ pickerId: 'separador-novo' })
    req.reply(tasks[0])
  }).as('assignPickingTask')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-1/finish', (req) => {
    expect(req.body).to.deep.equal({ notes: 'Separacao finalizada' })
    req.reply({ ...tasks[0], status: 'CONFERENCE_PENDING' })
  }).as('finishPickingTask')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-conference/conference', (req) => {
    expect(req.body).to.deep.equal({ justification: 'Sem divergencia' })
    req.reply({ ...tasks[1], status: 'PACKING' })
  }).as('conferencePickingTask')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-packing/packing-checklist', (req) => {
    expect(req.body).to.deep.equal({ notes: 'Embalagem conferida' })
    req.reply({ ...tasks[2], status: 'COMPLETED' })
  }).as('packingPickingTask')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-1/items/task-item-picking-ui-1/pick', tasks[0]).as('pickItem')
  cy.intercept('POST', '**/admin/picking/tasks/task-picking-ui-1/items/task-item-picking-ui-1/missing', {
    task: tasks[0],
    suggestions: [],
  }).as('markMissing')
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
  cy.intercept('GET', '**/integrations/operations/panel*', {})
}

describe('Separacao - UI kit operacional', () => {
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

    cy.contains('Separacao').click()
    cy.get('h2').should('contain', 'Separacao')
    cy.wait('@getPickingTasks')
    cy.get('h3').contains('Cliente Picking UI').should('be.visible')
  })

  it('exibe fila, metricas e cria tarefa com controles do UI kit', () => {
    cy.contains('Fila ativa').should('be.visible')
    cy.contains('Melhor ritmo').should('be.visible')
    cy.contains('2/min').should('be.visible')
    cy.contains('Hortifruti: 0/1').should('be.visible')

    cy.get('input[placeholder="ID do pedido"]').type('order-picking-ui-12345678')
    cy.contains('button', 'Criar').click()
    cy.wait('@createPickingTask')

    cy.contains('label', 'Status').parent().find('select').select('IN_PROGRESS')
    cy.contains('Em separacao').should('be.visible')
  })

  it('abre acoes de item e envia separacao ou ruptura', () => {
    cy.contains('button', 'Separar').click()
    cy.contains('Concluir item').should('be.visible')
    cy.get('input[inputmode="decimal"]').first().clear().type('2')
    cy.get('input[placeholder="EAN ou etiqueta"]').type('7890000000011')
    cy.get('input[placeholder="Opcional"]').last().type('Separado no UI kit')
    cy.contains('button', 'Confirmar').click()
    cy.wait('@pickItem')

    cy.contains('button', 'Falta').click()
    cy.contains('Registrar falta').should('be.visible')
    cy.get('input[placeholder="Ex: sem estoque na gondola"]').type('Sem estoque na gondola')
    cy.contains('Solicitar substituto ao operador').find('input[type="checkbox"]').check().should('be.checked')
    cy.contains('button', 'Confirmar').click()
    cy.wait('@markMissing')
  })

  it('executa acoes de tarefa com modal controlado sem window.prompt', () => {
    cy.window().then((win) => {
      cy.stub(win, 'prompt').as('windowPrompt')
    })

    cy.contains('button', 'Atribuir').click()
    cy.contains('[role="dialog"]', 'Atribuir separador').should('be.visible')
    cy.get('#picking-task-action-value').clear().type('separador-novo')
    cy.contains('[role="dialog"]', 'Atribuir separador').contains('button', 'Confirmar').click()
    cy.wait('@assignPickingTask')

    cy.contains('button:not(:disabled)', 'Conferencia').click()
    cy.contains('[role="dialog"]', 'Enviar para conferencia').should('be.visible')
    cy.get('#picking-task-action-value').type('Separacao finalizada')
    cy.contains('[role="dialog"]', 'Enviar para conferencia').contains('button', 'Confirmar').click()
    cy.wait('@finishPickingTask')

    cy.contains('button:not(:disabled)', 'Conferir').click()
    cy.contains('[role="dialog"]', 'Registrar conferencia').should('be.visible')
    cy.get('#picking-task-action-value').type('Sem divergencia')
    cy.contains('[role="dialog"]', 'Registrar conferencia').contains('button', 'Confirmar').click()
    cy.wait('@conferencePickingTask')

    cy.contains('button:not(:disabled)', 'Embalar').click()
    cy.contains('[role="dialog"]', 'Finalizar embalagem').should('be.visible')
    cy.get('#picking-task-action-value').type('Embalagem conferida')
    cy.contains('[role="dialog"]', 'Finalizar embalagem').contains('button', 'Confirmar').click()
    cy.wait('@packingPickingTask')

    cy.get('@windowPrompt').should('not.have.been.called')
  })
})
