type Product = {
  id: string
  name: string
  active?: boolean
  stock?: number | null
  syncOption?: string | null
}

type DeliveryZone = {
  id: string
  name: string
}

type FulfillmentSlot = {
  id: string
  type: string
  status: string
  startsAt?: string
  endsAt?: string
  availableOrders?: number
  isFull?: boolean
  cutoffExpired?: boolean
}

const qaZone = {
  name: 'QA Staging Smoke CEP',
  type: 'CEP_RANGE',
  cepStart: '25650000',
  cepEnd: '25650999',
  fee: 8,
  freeAbove: 120,
  active: true,
  priority: 99,
}

const qaAddress = {
  zipCode: '25650-000',
  street: 'Rua QA Staging',
  number: '123',
  complement: 'Smoke Cypress',
  neighborhood: 'Centro',
  city: 'Petropolis',
  state: 'RJ',
}

function apiBase() {
  return String(Cypress.env('apiUrl') || 'http://localhost:4001').replace(/\/$/, '')
}

function ensureQaDeliveryZone() {
  cy.request('POST', `${apiBase()}/auth/login`, {
    email: 'admin@antenor.com.br',
    password: 'admin2026',
  }).then(({ body }) => {
    const headers = { Authorization: `Bearer ${body.access_token}` }

    cy.request<DeliveryZone[]>({
      method: 'GET',
      url: `${apiBase()}/delivery/zones`,
      headers,
    }).then(({ body: zones }) => {
      const existing = zones.find((zone) => zone.name === qaZone.name)
      const request = existing
        ? {
            method: 'PATCH',
            url: `${apiBase()}/delivery/zones/${existing.id}`,
            headers,
            body: qaZone,
          }
        : {
            method: 'POST',
            url: `${apiBase()}/delivery/zones`,
            headers,
            body: qaZone,
          }

      cy.request(request).its('status').should('be.oneOf', [200, 201])
    })
  })
}

function ensureQaDeliverySlot() {
  cy.request('POST', `${apiBase()}/auth/login`, {
    email: 'admin@antenor.com.br',
    password: 'admin2026',
  }).then(({ body }) => {
    const headers = { Authorization: `Bearer ${body.access_token}` }
    const from = new Date(Date.now() - 60_000).toISOString()
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    cy.request<FulfillmentSlot[]>({
      method: 'GET',
      url: `${apiBase()}/admin/fulfillment/slots`,
      headers,
      qs: { type: 'DELIVERY', status: 'ACTIVE', from, to },
    }).then(({ body: slots }) => {
      const minCutoffBufferMs = 30 * 60 * 1000
      const hasUsableSlot = slots.some((slot) => {
        const startsAtMs = slot.startsAt ? new Date(slot.startsAt).getTime() : 0

        return (
          slot.type === 'DELIVERY' &&
          slot.status === 'ACTIVE' &&
          !slot.isFull &&
          !slot.cutoffExpired &&
          Number(slot.availableOrders ?? 0) > 0 &&
          Number.isFinite(startsAtMs) &&
          startsAtMs > Date.now() + minCutoffBufferMs
        )
      })

      if (hasUsableSlot) return

      cy.request({
        method: 'POST',
        url: `${apiBase()}/admin/fulfillment/slots`,
        headers,
        body: {
          type: 'DELIVERY',
          startsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          capacityOrders: 50,
          capacityItems: 500,
          cutoffMinutes: 0,
          status: 'ACTIVE',
        },
      }).its('status').should('be.oneOf', [200, 201])
    })
  })
}

function loadRealProduct() {
  return cy
    .request<{ data: Product[] }>(`${apiBase()}/products?limit=20`)
    .then(({ body }) => {
      const product = body.data.find((item) => {
        const hasStock = typeof item.stock !== 'number' || item.stock > 0
        return item.active !== false && item.syncOption !== 'NUNCA' && hasStock
      })

      expect(product, 'produto ativo com estoque no staging').to.exist
      return product as Product
    })
}

describe('Staging smoke - storefront real', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()

    cy.on('window:before:load', (win) => {
      Object.defineProperty(win.navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: unknown, error?: (err: unknown) => void) => {
            error?.({ code: 1, message: 'Geolocation disabled in Cypress smoke' })
          },
        },
      })
      cy.stub(win, 'open').as('windowOpen')
    })
  })

  it('navega produto, carrinho e checkout com API de staging', () => {
    ensureQaDeliveryZone()
    ensureQaDeliverySlot()

    loadRealProduct().then((product) => {
      cy.intercept('GET', '**/products*').as('products')
      cy.intercept('POST', '**/cart').as('createCart')
      cy.intercept('POST', '**/cart/*/items').as('addCartItem')
      cy.intercept('POST', '**/checkout/sessions').as('createSession')
      cy.intercept('POST', '**/checkout/sessions/*/quote').as('quoteSession')
      cy.intercept('POST', '**/checkout/sessions/*/confirm').as('confirmSession')

      cy.visit(`/produto/${product.id}`)
      cy.contains('h1', product.name, { timeout: 15000 }).should('be.visible')
      cy.contains('Produto detalhado').should('be.visible')
      cy.get('a[href="/cart"]').should('exist')

      cy.visit(`/mercado?q=${encodeURIComponent(product.name)}`)
      cy.wait('@products')
      cy.contains('h3', product.name, { timeout: 15000 }).should('be.visible')
      cy.get('button[aria-label*="ao carrinho"]:visible').first().click()
      cy.get('a[href="/cart"]:visible').first().click({ force: true })

      cy.url().should('include', '/cart')
      cy.contains('h1', 'Seu Carrinho').should('be.visible')
      cy.contains(product.name).should('be.visible')
      cy.contains('Fechar pedido').click()

      cy.url().should('include', '/checkout')
      cy.contains('h1', 'Finalizar pedido').should('be.visible')
      cy.get('input[name="guestName"]').type('QA Staging Smoke')
      cy.get('input[name="guestWhatsapp"]').type('24999990000')
      cy.get('input[name="guestEmail"]').type(`qa.staging.${Date.now()}@checkout.local`)
      cy.get('input[name="zipCode"]').clear().type(qaAddress.zipCode).blur()
      cy.get('input[name="street"]').clear().type(qaAddress.street)
      cy.get('input[name="number"]').clear().type(qaAddress.number)
      cy.get('input[name="complement"]').clear().type(qaAddress.complement)
      cy.get('input[name="neighborhood"]').clear().type(qaAddress.neighborhood)
      cy.get('input[name="city"]').clear().type(qaAddress.city)
      cy.get('input[name="state"]').clear().type(qaAddress.state)

      cy.contains('button', 'Continuar').click()
      cy.wait('@createCart').its('response.statusCode').should('be.oneOf', [200, 201])
      cy.wait('@addCartItem').its('response.statusCode').should('be.oneOf', [200, 201])
      cy.wait('@createSession').its('response.statusCode').should('be.oneOf', [200, 201])
      cy.wait('@quoteSession').its('response.statusCode').should('be.oneOf', [200, 201])
      cy.contains('Como você quer pagar?', { timeout: 15000 }).should('be.visible')

      cy.get('input[type="radio"][value="PIX"]').check()
      cy.contains('button', 'Finalizar pedido').click()
      cy.wait('@confirmSession').its('response.statusCode').should('be.oneOf', [200, 201])
      cy.contains('Pedido Confirmado!', { timeout: 15000 }).should('be.visible')
      cy.contains('PIX').should('be.visible')
    })
  })
})
