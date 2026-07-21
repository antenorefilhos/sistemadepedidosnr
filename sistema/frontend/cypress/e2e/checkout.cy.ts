describe('Checkout E2E - Fluxo Completo', () => {
  const productsMock = {
    data: [
      {
        id: 'mock-checkout-product-1',
        ean: '3333333333333',
        name: 'Produto Checkout Teste',
        price: 19.9,
        promotionalPrice: null,
        stock: 25,
        isFractional: false,
        fractionStep: null,
        unit: 'UN',
        alternativeDescription: 'Item para testes de checkout',
        category: 'GERAL',
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
    hasNextPage: false,
  }

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()

    cy.intercept('GET', '**/products*', {
      statusCode: 200,
      body: productsMock,
    }).as('getProductsCheckout')

    cy.intercept('GET', '**/addresses/search/*', {
      statusCode: 200,
      body: {
        street: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
    }).as('cepLookup')

    cy.intercept('GET', '**/delivery/calculate*', {
      statusCode: 200,
      body: { fee: 8, freeAbove: 150, zoneName: 'Central', zoneId: 'z1', isFree: false },
    }).as('deliveryCalc')

    cy.intercept('POST', '**/auth/customer/guest-checkout', {
      statusCode: 201,
      body: {
        access_token: 'mock-token',
        user: {
          id: 'customer-1',
          name: 'Maria Teste',
          email: 'maria@teste.com',
          whatsapp: '11999999999',
        },
      },
    }).as('guestCheckout')

    cy.intercept('POST', '**/addresses/*', {
      statusCode: 201,
      body: { id: 'address-1' },
    }).as('createAddress')

    cy.intercept('POST', '**/cart', {
      statusCode: 201,
      body: {
        id: 'cart-checkout-1',
        tenantId: 'tenant_default',
        storeId: 'store_default',
        status: 'ACTIVE',
        items: [],
      },
    }).as('createCart')

    cy.intercept('POST', '**/cart/*/items', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          id: 'cart-checkout-1',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          status: 'ACTIVE',
          items: [
            {
              id: 'cart-item-checkout-1',
              cartId: 'cart-checkout-1',
              productId: req.body?.productId || 'mock-checkout-product-1',
              quantity: req.body?.quantity || 1,
              allowSubstitution: true,
            },
          ],
        },
      })
    }).as('addCartItem')

    cy.intercept('POST', '**/checkout/sessions', {
      statusCode: 201,
      body: {
        reused: false,
        session: { id: 'session-checkout-1', status: 'OPEN', orderId: null },
      },
    }).as('createCheckoutSession')

    cy.intercept('POST', '**/checkout/sessions/*/quote', {
      statusCode: 201,
      body: {
        session: { id: 'session-checkout-1', status: 'QUOTED', orderId: null },
        cart: {
          id: 'cart-checkout-1',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          status: 'ACTIVE',
          items: [{ id: 'cart-item-checkout-1', cartId: 'cart-checkout-1', productId: 'mock-checkout-product-1', quantity: 1, allowSubstitution: true }],
        },
        price: { subtotal: 19.9, deliveryAmount: 8, discountAmount: 0, total: 27.9, appliedPromotions: [] },
        delivery: { mode: 'DELIVERY', fee: 8, rawFee: 8, zoneName: 'Central', outOfArea: false, validSlot: true, slot: { id: 'slot-1', windowStart: '2026-05-31T18:00:00.000Z', windowEnd: '2026-05-31T20:00:00.000Z' } },
        stock: { allAvailable: true, unavailableItems: [], items: [{ productId: 'mock-checkout-product-1', requested: 1, available: 25, inStock: true, allowSubstitution: true, substitutionStatus: 'ACCEPTED' }] },
        canConfirm: true,
        blockers: [],
      },
    }).as('quoteCheckoutSession')

    cy.intercept('POST', '**/checkout/sessions/*/confirm', (req) => {
      const paymentMethod = req.body?.paymentMethod || 'PIX'
      req.reply({
        statusCode: 201,
        body: {
          session: { id: 'session-checkout-1', status: 'CONFIRMED', orderId: 'order-1' },
          order: {
            id: 'order-1',
            paymentMethod,
            notes: req.body?.notes || '',
            total: 29.9,
          },
          whatsapp: {
            channel: 'whatsapp_web',
            to: '5511999999999',
            body: 'Pedido teste',
            url: 'https://wa.me/5511999999999',
          },
        },
      })
    }).as('confirmCheckoutSession')

    cy.on('window:before:load', (win) => {
      cy.stub(win, 'open').as('windowOpen')
    })
  })

  function addFirstProductToCart() {
    cy.visit('/')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    cy.wait('@getProductsCheckout')
    cy.get('main').should('exist')
    cy.get('article h3').first().invoke('text').as('firstProductName')
    cy.get('button[aria-label*="ao carrinho"]:visible').first().click()
    cy.get('a[href="/cart"]:visible').first().click()
    cy.url().should('include', '/cart')
    cy.get('body').should('contain.text', 'Carrinho')
  }

  function fillGuestAddress() {
    cy.get('input[name="guestName"]').type('Maria Teste')
    cy.get('input[name="guestWhatsapp"]').type('11999999999')
    cy.get('input[name="guestEmail"]').type('maria@teste.com')
    cy.get('input[name="zipCode"]').type('01310100').blur()
    cy.get('input[name="street"]').clear().type('Avenida Paulista')
    cy.get('input[name="number"]').type('123')
    cy.get('input[name="complement"]').type('Apto 45')
    cy.get('input[name="neighborhood"]').clear().type('Bela Vista')
    cy.get('input[name="city"]').clear().type('São Paulo')
    cy.get('input[name="state"]').clear().type('SP')
  }

  it('Deve permitir checkout como convidado com pagamento PIX', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()
    cy.url().should('include', '/checkout')

    fillGuestAddress()
    cy.contains('button', 'Continuar').click()
    cy.contains('Como você quer pagar?').should('be.visible')
    cy.get('input[type="radio"][value="PIX"]').check()

    cy.contains('button', 'Finalizar pedido').click()
    cy.wait('@confirmCheckoutSession')
    cy.contains('Pedido Confirmado!', { timeout: 10000 }).should('be.visible')
    cy.contains('PIX').should('be.visible')
  })

  it('Deve permitir checkout como convidado com Dinheiro e troco', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()

    cy.get('input[name="guestName"]').type('João Teste')
    cy.get('input[name="guestWhatsapp"]').type('11988888888')
    cy.get('input[name="guestEmail"]').type('joao@teste.com')
    cy.get('input[name="zipCode"]').type('01310100').blur()
    cy.get('input[name="street"]').clear().type('Avenida Paulista')
    cy.get('input[name="number"]').type('456')
    cy.get('input[name="neighborhood"]').clear().type('Bela Vista')
    cy.get('input[name="city"]').clear().type('São Paulo')
    cy.get('input[name="state"]').clear().type('SP')
    cy.contains('button', 'Continuar').click()

    cy.get('input[type="radio"][value="CASH"]').check()

    cy.get('input[type="radio"][value="YES"]').check()
    cy.get('button').contains('Troco para').first().click()

    cy.contains('button', 'Finalizar pedido').click()
    cy.wait('@confirmCheckoutSession')
    cy.contains('Pedido Confirmado!', { timeout: 10000 }).should('be.visible')
    cy.contains('Dinheiro').should('be.visible')
  })

  it('Deve permitir checkout como convidado com Cartão na entrega', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()

    cy.get('input[name="guestName"]').type('Carlos Teste')
    cy.get('input[name="guestWhatsapp"]').type('11977777777')
    cy.get('input[name="guestEmail"]').type('carlos@teste.com')
    cy.get('input[name="zipCode"]').type('01310100').blur()
    cy.get('input[name="street"]').clear().type('Avenida Paulista')
    cy.get('input[name="number"]').type('789')
    cy.get('input[name="neighborhood"]').clear().type('Bela Vista')
    cy.get('input[name="city"]').clear().type('São Paulo')
    cy.get('input[name="state"]').clear().type('SP')
    cy.contains('button', 'Continuar').click()

    cy.get('input[type="radio"][value="CARD"]').check()

    cy.contains('button', 'Finalizar pedido').click()
    cy.wait('@confirmCheckoutSession')
    cy.contains('Pedido Confirmado!', { timeout: 10000 }).should('be.visible')
    cy.contains('Cartão na entrega').should('be.visible')
  })

  it('Deve validar campos obrigatórios no checkout', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()

    cy.contains('button', 'Continuar').click()

    cy.get('input[name="guestName"]:invalid').should('exist')
    cy.get('input[name="guestWhatsapp"]:invalid').should('exist')
    cy.get('input[name="zipCode"]:invalid').should('exist')
  })

  it('Deve manter itens no carrinho após refresh', () => {
    addFirstProductToCart()
    cy.visit('/cart')
    cy.get('@firstProductName').then((firstProductName) => {
      cy.contains(String(firstProductName).trim()).should('be.visible')
    })
    
    cy.reload()
    cy.get('@firstProductName').then((firstProductName) => {
      cy.contains(String(firstProductName).trim()).should('be.visible')
    })
  })
})
