const expectedSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/cypress-web-push-subscription',
  expirationTime: null,
  keys: {
    p256dh: 'cypress-p256dh-key',
    auth: 'cypress-auth-key',
  },
}

const product = {
  id: 'web-push-product-1',
  ean: '7891000000099',
  name: 'Cafe Especial Web Push',
  alternativeDescription: 'Produto para smoke de notificacoes',
  price: 18.9,
  promotionalPrice: null,
  stock: 20,
  isFractional: false,
  fractionStep: null,
  unit: 'UN',
  syncOption: 'SEMPRE',
  active: true,
  category: 'PADARIA',
}

function mockStorefrontApi() {
  cy.intercept('GET', '**/brand', {
    statusCode: 200,
    body: {
      storeName: 'Antenor & Filhos',
      logoDesktopUrl: '/branding/logo-horizontal-bordo.png',
      logoMobileUrl: '/branding/logo-branco.png',
      primaryColor: '#5D082A',
      secondaryColor: '#D2BB8A',
      contactWhatsapp: null,
      freeShippingThreshold: 150,
      businessHours: null,
      openMessage: null,
      closedMessage: null,
      countdownLabel: null,
    },
  })

  cy.intercept('GET', '**/cms/hero-slides', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/cms/store-banners', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/cms/promo-banners', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/cms/categories*', {
    statusCode: 200,
    body: [{ id: 'cat-padaria', code: 'PADARIA', name: 'Padaria', label: 'Padaria', active: true, order: 1 }],
  })
  cy.intercept('GET', '**/products/suggest*', { statusCode: 200, body: { data: ['cafe especial'] } })
  cy.intercept('GET', '**/products/mercadological-tree', { statusCode: 200, body: { data: [] } })
  cy.intercept('GET', '**/recommendations/showcase*', { statusCode: 200, body: { items: [{ product }] } })
  cy.intercept('GET', '**/recommendations/rebuy*', { statusCode: 200, body: { items: [{ product }] } })
  cy.intercept('GET', '**/analytics/top-products*', {
    statusCode: 200,
    body: { data: [{ product, soldQuantity: 10 }] },
  })
  cy.intercept('GET', '**/products?*', {
    statusCode: 200,
    body: { data: [product], page: 1, limit: 24, total: 1, hasNextPage: false },
  })
  cy.intercept('GET', '**/products', {
    statusCode: 200,
    body: { data: [product], page: 1, limit: 24, total: 1, hasNextPage: false },
  })
  cy.intercept('GET', '**/notifications', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/notifications/unread-count', { statusCode: 200, body: 0 })
}

function installPushMocks(win: Cypress.AUTWindow) {
  const subscribe = cy.stub().as('pushSubscribe').resolves({
    toJSON: () => expectedSubscription,
  })
  const getSubscription = cy.stub().as('getSubscription').resolves(null)
  const requestPermission = cy.stub().as('requestPermission').resolves('granted')

  Object.defineProperty(win, 'Notification', {
    configurable: true,
    value: {
      permission: 'default',
      requestPermission,
    },
  })

  Object.defineProperty(win, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  })

  Object.defineProperty(win.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: cy.stub().resolves({}),
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe,
        },
      }),
    },
  })
}

function seedAuth(win: Cypress.AUTWindow) {
  win.localStorage.setItem('token', 'storefront-customer-token')
  win.localStorage.setItem(
    'user',
    JSON.stringify({
      id: 'customer-web-push-smoke',
      name: 'Cliente Web Push',
      email: 'cliente.webpush@antenor.com.br',
      cpf: '12345678909',
      whatsapp: '21999990000',
    }),
  )
}

describe('Web Push subscription flow', () => {
  it('serializa a subscription real do navegador e envia para a API', () => {
    mockStorefrontApi()

    cy.intercept('POST', '**/notifications/push-subscribe', (req) => {
      expect(req.body).to.deep.equal(expectedSubscription)
      req.reply({
        statusCode: 201,
        body: {
          id: 'push-subscription-cypress',
          customerId: 'customer-web-push-smoke',
          endpoint: expectedSubscription.endpoint,
          auth: expectedSubscription.keys.auth,
          p256dh: expectedSubscription.keys.p256dh,
        },
      })
    }).as('pushSubscribeRequest')

    cy.visit('/', {
      onBeforeLoad(win) {
        seedAuth(win)
        installPushMocks(win)
      },
    })

    cy.contains('Antenor & Filhos', { timeout: 10000 }).should('be.visible')
    cy.get('button[aria-label="Notificações"]').filter(':visible').first().click()
    cy.contains('Avisos no navegador').should('be.visible')
    cy.contains('Receba avisos de pedido e campanhas.').should('be.visible')
    cy.contains('button', 'Ativar notificações').click()

    cy.wait('@pushSubscribeRequest')
    cy.get('@requestPermission').should('have.been.calledOnce')
    cy.get('@getSubscription').should('have.been.calledOnce')
    cy.get('@pushSubscribe').should('have.been.calledOnce')
    cy.get('@pushSubscribe').its('firstCall.args.0').should((options) => {
      expect(options).to.include({ userVisibleOnly: true })
      expect(options.applicationServerKey.length).to.equal(65)
      expect(options.applicationServerKey[0]).to.equal(4)
    })
    cy.contains('Notificações ativas neste navegador.').should('be.visible')
  })
})
