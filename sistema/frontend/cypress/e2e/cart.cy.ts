describe('Carrinho e Checkout - Fluxos Reais', () => {
  const productsMock = {
    data: [
      {
        id: 'mock-cart-product-1',
        ean: '4444444444444',
        name: 'Produto Carrinho Teste',
        price: 21.9,
        promotionalPrice: null,
        stock: 30,
        isFractional: false,
        fractionStep: null,
        unit: 'UN',
        alternativeDescription: 'Item de teste de carrinho',
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
    }).as('getProductsCart')

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
        id: 'cart-flow-1',
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
          id: 'cart-flow-1',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          status: 'ACTIVE',
          items: [
            {
              id: 'cart-item-flow-1',
              cartId: 'cart-flow-1',
              productId: req.body?.productId || 'mock-cart-product-1',
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
        session: { id: 'session-flow-1', status: 'OPEN', orderId: null },
      },
    }).as('createCheckoutSession')

    cy.intercept('POST', '**/checkout/sessions/*/quote', {
      statusCode: 201,
      body: {
        session: { id: 'session-flow-1', status: 'QUOTED', orderId: null },
        cart: {
          id: 'cart-flow-1',
          tenantId: 'tenant_default',
          storeId: 'store_default',
          status: 'ACTIVE',
          items: [{ id: 'cart-item-flow-1', cartId: 'cart-flow-1', productId: 'mock-cart-product-1', quantity: 1, allowSubstitution: true }],
        },
        price: { subtotal: 21.9, deliveryAmount: 8, discountAmount: 0, total: 29.9, appliedPromotions: [] },
        delivery: { mode: 'DELIVERY', fee: 8, rawFee: 8, zoneName: 'Central', outOfArea: false, validSlot: true, slot: { id: 'slot-1', windowStart: '2026-05-31T18:00:00.000Z', windowEnd: '2026-05-31T20:00:00.000Z' } },
        stock: { allAvailable: true, unavailableItems: [], items: [{ productId: 'mock-cart-product-1', requested: 1, available: 30, inStock: true, allowSubstitution: true, substitutionStatus: 'ACCEPTED' }] },
        canConfirm: true,
        blockers: [],
      },
    }).as('quoteCheckoutSession')

    cy.intercept('POST', '**/checkout/sessions/*/confirm', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          session: { id: 'session-flow-1', status: 'CONFIRMED', orderId: 'order-1' },
          order: {
            id: 'order-1',
            paymentMethod: req.body?.paymentMethod || 'PIX',
            notes: '',
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

    cy.intercept('GET', '**/coupons/validate*', {
      statusCode: 200,
      body: {
        valid: false,
        code: 'INVALIDO',
        message: 'Cupom inválido',
        discountAmount: 0,
      },
    }).as('couponValidate')

    cy.on('window:before:load', (win) => {
      cy.stub(win, 'open').as('windowOpen')
    })
  })

  function addFirstProductToCart() {
    cy.visit('/')
    cy.wait('@getProductsCart')
    cy.get('button[aria-label*="ao carrinho"]:visible', { timeout: 10000 }).should('have.length.at.least', 1)

    cy.get('article h3').first().invoke('text').as('firstProductName')
    cy.get('button[aria-label*="ao carrinho"]:visible').first().click()
    cy.get('a[href="/cart"]:visible').first().click({ force: true })
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
    cy.get('input[name="neighborhood"]').clear().type('Bela Vista')
    cy.get('input[name="city"]').clear().type('São Paulo')
    cy.get('input[name="state"]').clear().type('SP')
  }

  it('adiciona item e exibe no carrinho', () => {
    addFirstProductToCart()

    cy.get('@firstProductName').then((name) => {
      cy.contains(String(name).trim()).should('be.visible')
    })
    cy.get('body').should('contain.text', 'Resumo')
  })

  it('altera quantidade e mantém subtotal visível', () => {
    addFirstProductToCart()

    cy.get('button[aria-label="Aumentar quantidade"]').first().click()
    cy.contains('Subtotal').should('be.visible')
    cy.get('button[aria-label="Diminuir quantidade"]').first().click()
    cy.contains('Subtotal').should('be.visible')
  })

  it('remove item e mostra estado vazio', () => {
    addFirstProductToCart()

    cy.get('button[aria-label*="Remover"]').first().click()
    cy.get('body').should('contain.text', 'carrinho está vazio')
  })

  it('mantém item no carrinho após reload', () => {
    addFirstProductToCart()

    cy.get('@firstProductName').then((name) => {
      cy.contains(String(name).trim()).should('be.visible')
    })

    cy.reload()

    cy.get('@firstProductName').then((name) => {
      cy.contains(String(name).trim()).should('be.visible')
    })
  })

  it('aplica cupom e exibe feedback do resultado', () => {
    addFirstProductToCart()

    cy.get('input[placeholder="Digite seu cupom"]').type('INVALIDO')
    cy.contains('button', 'Aplicar').click()
    cy.wait('@couponValidate')
  })

  it('valida campos obrigatórios no checkout', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()
    cy.url().should('include', '/checkout')

    cy.contains('button', 'Continuar').click()
    cy.get('input[name="guestName"]:invalid').should('exist')
    cy.get('input[name="guestWhatsapp"]:invalid').should('exist')
    cy.get('input[name="zipCode"]:invalid').should('exist')
  })

  it('mostra troco para pagamento em dinheiro e oculta no PIX', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()

    fillGuestAddress()
    cy.contains('button', 'Continuar').click()
    cy.contains('Como você quer pagar?').should('be.visible')

    cy.get('input[type="radio"][value="CASH"]').check()
    cy.contains('Vai precisar de troco?').should('be.visible')

    cy.get('input[type="radio"][value="PIX"]').check()
    cy.contains('Vai precisar de troco?').should('not.exist')
  })

  it('finaliza pedido com PIX e mostra confirmação', () => {
    addFirstProductToCart()
    cy.contains('Fechar pedido').click()

    fillGuestAddress()
    cy.contains('button', 'Continuar').click()
    cy.get('input[type="radio"][value="PIX"]').check()

    cy.contains('button', 'Finalizar pedido').click()
    cy.wait('@confirmCheckoutSession')
    cy.contains('Pedido Confirmado!', { timeout: 10000 }).should('be.visible')
    cy.contains('PIX').should('be.visible')
  })
})
