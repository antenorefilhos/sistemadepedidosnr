const storeBanners = [
  {
    id: 'store-banner-ui-1',
    name: 'Full Banner UI',
    type: 'full',
    active: true,
    link: '/mercado/ofertas',
    linkTarget: '_self',
    title: 'Ofertas da semana',
    imageUrl: '/branding/antenor-admin-logo.svg',
    mobileImageUrl: '/branding/antenor-admin-logo.svg',
    pages: 'home',
    scheduledStart: '2026-06-01T09:00:00.000Z',
    scheduledEnd: '2026-06-02T09:00:00.000Z',
    order: 0,
  },
  {
    id: 'store-banner-ui-2',
    name: 'Mini Banner UI',
    type: 'mini',
    active: false,
    link: '/mercado/frescos',
    linkTarget: '_blank',
    title: 'Frescos do dia',
    imageUrl: '/branding/antenor-admin-logo.svg',
    mobileImageUrl: null,
    pages: 'category',
    scheduledStart: null,
    scheduledEnd: null,
    order: 1,
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/cms/store-banners/all*', storeBanners).as('getStoreBanners')
  cy.intercept('PATCH', '**/cms/store-banners/store-banner-ui-1', {
    ...storeBanners[0],
    active: false,
  }).as('updateStoreBannerOne')
  cy.intercept('PATCH', '**/cms/store-banners/store-banner-ui-2', {
    ...storeBanners[1],
    active: true,
  }).as('updateStoreBannerTwo')
  cy.intercept('DELETE', '**/cms/store-banners/store-banner-ui-2', {}).as('deleteStoreBannerTwo')

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

describe('Banners da Loja - UI kit operacional', () => {
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

    cy.get('button[aria-label="Banners da Loja"]').click()
    cy.get('h2').should('contain', 'Banners da Loja')
    cy.wait('@getStoreBanners')
    cy.contains('Full Banner UI').should('be.visible')
  })

  it('renderiza preview, lista e alterna status com controles do UI kit', () => {
    cy.contains('Pré-visualização').should('be.visible')
    cy.contains('Full Banner UI').should('be.visible')
    cy.contains('Mini Banner UI').scrollIntoView().should('be.visible')
    cy.contains('Full').should('be.visible')
    cy.contains('mobile').should('be.visible')

    cy.contains('Full Banner UI').parents('.bg-white.border').within(() => {
      cy.get('button[title="Desativar"]').click()
    })
    cy.wait('@updateStoreBannerOne')
  })

  it('edita banner com selects, link target e agendamento', () => {
    cy.contains('Full Banner UI').parents('.bg-white.border').within(() => {
      cy.get('button[title="Editar"]').click()
    })

    cy.contains('Editar banner').should('be.visible')
    cy.get('input[placeholder="Ex: Banner Summer Sale Desktop"]').clear().type('Full Banner Premium UI')
    cy.contains('label', 'Tipo de banner').parent().find('select').select('tarja')
    cy.contains('label', 'Página de publicação').parent().find('select').select('all')
    cy.get('input[placeholder="https:// ou /caminho-relativo"]').clear().type('/mercado/promocoes')
    cy.contains('button', 'Nova janela').click()
    cy.get('input[placeholder="Ex: Promoção de Verão"]').clear().type('Promoções premium')
    cy.contains('button', 'Salvar alterações').click()

    cy.wait('@updateStoreBannerOne')
    cy.contains('Banner atualizado').should('exist')
  })

  it('abre confirmacao e remove banner', () => {
    cy.contains('Mini Banner UI').parents('.bg-white.border').within(() => {
      cy.get('button[title="Remover"]').click()
    })

    cy.contains('Remover banner?').should('be.visible')
    cy.contains('Mini Banner UI').should('be.visible')
    cy.contains('button', 'Cancelar').should('be.visible')

    cy.contains('button', 'Remover').click()
    cy.wait('@deleteStoreBannerTwo')
    cy.contains('Banner removido').should('exist')
  })
})
