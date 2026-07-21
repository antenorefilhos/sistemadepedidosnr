type ViewportCase = {
  name: string
  width: number
  height: number
}

const viewports: ViewportCase[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]

const customer = {
  id: 'customer-ui-kit',
  name: 'Cliente UI Kit',
  email: 'cliente.uikit@antenor.test',
  cpf: '12345678901',
  whatsapp: '21999999999',
  addresses: [
    {
      id: 'address-ui-kit',
      street: 'Rua das Compras',
      number: '123',
      complement: 'Casa',
      neighborhood: 'Centro',
      city: 'Teresopolis',
      state: 'RJ',
      zipCode: '25900000',
      isDefault: true,
    },
  ],
}

const orders = [
  {
    id: 'order-ui-kit-0001',
    customerId: customer.id,
    status: 'CONFIRMED',
    paymentMethod: 'PIX',
    paymentStatus: 'PAID',
    total: 42.9,
    createdAt: '2026-06-05T10:00:00.000Z',
    items: [
      {
        id: 'order-item-ui-kit',
        productId: 'product-ui-kit',
        quantity: 2,
        unitPrice: 21.45,
        product: {
          id: 'product-ui-kit',
          ean: '7891000000999',
          name: 'Cafe Especial Antenor 500g',
        },
      },
    ],
  },
]

function assertNoHorizontalOverflow() {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1)
  })
}

function mockAccountApi() {
  cy.intercept('GET', '**/brand', {
    statusCode: 200,
    body: {
      storeName: 'Antenor & Filhos',
      logoDesktopUrl: '/branding/logo-horizontal-bordo.png',
      logoMobileUrl: '/branding/logo-branco.png',
      primaryColor: '#5D082A',
      secondaryColor: '#D2BB8A',
      contactWhatsapp: '21999999999',
      freeShippingThreshold: 150,
      businessHours: null,
      openMessage: null,
      closedMessage: null,
      countdownLabel: null,
    },
  }).as('brand')

  cy.intercept('GET', `**/customers/${customer.id}`, {
    statusCode: 200,
    body: customer,
  }).as('customer')

  cy.intercept('GET', '**/orders*', {
    statusCode: 200,
    body: orders,
  }).as('orders')
}

function seedAuth() {
  window.localStorage.setItem('token', 'test-customer-token')
  window.localStorage.setItem('user', JSON.stringify(customer))
}

describe('Conta e fallbacks UI kit storefront', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  viewports.forEach((viewportCase) => {
    it(`renderiza conta autenticada com tabs e filtros em ${viewportCase.name}`, () => {
      cy.viewport(viewportCase.width, viewportCase.height)
      mockAccountApi()
      cy.visit('/account', {
        onBeforeLoad: seedAuth,
      })

      cy.contains('h1', 'Cliente UI Kit').should('be.visible')
      cy.contains('Cliente').should('be.visible')
      cy.contains('Conta ativa').should('be.visible')
      cy.contains('button', 'Pedidos').click()
      cy.wait('@orders')
      cy.get('select').should('be.visible').select('PIX')
      cy.contains('#KIT-0001').should('be.visible')
      cy.contains('button', '1 item').click()
      cy.contains('Cafe Especial Antenor 500g').should('be.visible')
      cy.contains('button', 'Endereços').click()
      cy.contains('Rua das Compras, 123').should('be.visible')
      cy.contains('Padrão').should('be.visible')
      assertNoHorizontalOverflow()
    })

    it(`renderiza fallbacks 403 e 404 com UI kit em ${viewportCase.name}`, () => {
      cy.viewport(viewportCase.width, viewportCase.height)

      cy.visit('/forbidden')
      cy.contains('h1', '403 - Acesso negado').should('be.visible')
      cy.contains('a', 'Voltar para início').should('be.visible')
      assertNoHorizontalOverflow()

      cy.visit('/rota-inexistente-ui-kit')
      cy.contains('h1', '404 - Página não encontrada').should('be.visible')
      cy.contains('a', 'Ir para início').should('be.visible')
      assertNoHorizontalOverflow()
    })
  })
})
