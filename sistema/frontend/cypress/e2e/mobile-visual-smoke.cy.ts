type ViewportCase = {
  name: string
  width: number
  height: number
}

const mobileViewports: ViewportCase[] = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'large-mobile', width: 414, height: 896 },
]

const wideViewports: ViewportCase[] = [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
]

const productBase = {
  ean: '7891000000000',
  price: 18.9,
  promotionalPrice: null,
  stock: 20,
  isFractional: false,
  fractionStep: null,
  unit: 'UN',
  syncOption: 'SEMPRE',
  active: true,
}

const products = [
  {
    ...productBase,
    id: 'mobile-product-1',
    ean: '7891000000001',
    name: 'Cafe Especial Antenor 500g',
    alternativeDescription: 'Torra equilibrada para o cafe da manha',
    category: 'PADARIA',
  },
  {
    ...productBase,
    id: 'mobile-product-2',
    ean: '7891000000002',
    name: 'Pao Frances Assado na Loja',
    alternativeDescription: 'Padaria fresca todos os dias',
    price: 12.49,
    category: 'PADARIA',
  },
  {
    ...productBase,
    id: 'mobile-product-3',
    ean: '7891000000003',
    name: 'Contra File Para Churrasco',
    alternativeDescription: 'Corte selecionado para grelha',
    price: 54.9,
    category: 'CHURRASCO',
  },
  {
    ...productBase,
    id: 'mobile-product-4',
    ean: '7891000000004',
    name: 'Uva Verde Sem Semente',
    alternativeDescription: 'Hortifruti fresco',
    price: 16.99,
    category: 'HORTIFRUTI',
  },
]

const productsResponse = {
  data: products,
  page: 1,
  limit: 24,
  total: products.length,
  hasNextPage: false,
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
  }).as('brand')

  cy.intercept('GET', '**/cms/hero-slides', { statusCode: 200, body: [] }).as('heroSlides')
  cy.intercept('GET', '**/cms/store-banners', { statusCode: 200, body: [] }).as('storeBanners')
  cy.intercept('GET', '**/cms/promo-banners', { statusCode: 200, body: [] }).as('promoBanners')
  cy.intercept('GET', '**/cms/categories*', {
    statusCode: 200,
    body: [
      { id: 'cat-padaria', code: 'PADARIA', name: 'Padaria', label: 'Padaria', active: true, order: 1 },
      { id: 'cat-churrasco', code: 'CHURRASCO', name: 'Churrasco', label: 'Churrasco', active: true, order: 2 },
      { id: 'cat-hortifruti', code: 'HORTIFRUTI', name: 'Hortifruti', label: 'Hortifruti', active: true, order: 3 },
    ],
  }).as('categories')

  cy.intercept('GET', '**/products/suggest*', {
    statusCode: 200,
    body: { data: ['cafe especial', 'pao frances', 'contra file'] },
  }).as('suggestions')

  cy.intercept('GET', '**/products/mercadological-tree', {
    statusCode: 200,
    body: { data: [] },
  }).as('mercadologicalTree')

  cy.intercept('GET', '**/products/mobile-product-1', {
    statusCode: 200,
    body: products[0],
  }).as('productDetail')

  cy.intercept('GET', '**/products/mobile-product-1/recommendations*', {
    statusCode: 200,
    body: [products[1], products[2]],
  }).as('productRecommendations')

  cy.intercept('GET', '**/recommendations/substitutes/mobile-product-1*', {
    statusCode: 200,
    body: { items: [{ product: products[3] }] },
  }).as('productSubstitutes')

  cy.intercept('GET', '**/recommendations/showcase*', {
    statusCode: 200,
    body: { items: products.map((product) => ({ product })) },
  }).as('showcase')

  cy.intercept('GET', '**/recommendations/rebuy*', {
    statusCode: 200,
    body: { items: products.map((product) => ({ product })) },
  }).as('rebuy')

  cy.intercept('GET', '**/notifications', {
    statusCode: 200,
    body: [],
  }).as('notifications')

  cy.intercept('GET', '**/notifications/unread-count', {
    statusCode: 200,
    body: 0,
  }).as('notificationsUnread')

  cy.intercept('GET', '**/analytics/top-products*', {
    statusCode: 200,
    body: { data: products.map((product, index) => ({ product, soldQuantity: 20 - index })) },
  }).as('topProducts')

  cy.intercept('GET', '**/products?*', {
    statusCode: 200,
    body: productsResponse,
  }).as('productsQuery')
  cy.intercept('GET', '**/products', {
    statusCode: 200,
    body: productsResponse,
  }).as('products')

  cy.intercept('GET', '**/delivery/slots*', {
    statusCode: 200,
    body: [
      {
        id: 'mobile-slot-1',
        type: 'DELIVERY',
        startsAt: '2026-06-05T18:00:00.000Z',
        endsAt: '2026-06-05T20:00:00.000Z',
        capacityOrders: 20,
        capacityItems: null,
        reservedOrders: 0,
        reservedItems: 0,
        availableOrders: 20,
        availableItems: null,
        status: 'ACTIVE',
        isFull: false,
        cutoffExpired: false,
      },
    ],
  }).as('deliverySlots')

  cy.intercept('GET', '**/delivery/calculate*', {
    statusCode: 200,
    body: {
      fee: 8,
      freeAbove: 150,
      zoneName: 'Central',
      zoneId: 'zone-central',
      isFree: false,
      outOfArea: false,
    },
  }).as('deliveryCalculate')

  cy.intercept('GET', '**/addresses/search/*', {
    statusCode: 200,
    body: {
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
    },
  }).as('cepLookup')
}

function seedCart() {
  cy.window().then((win) => {
    win.localStorage.setItem(
      'cart',
      JSON.stringify([
        {
          productId: products[0].id,
          quantity: 2,
          product: products[0],
          allowSubstitution: true,
        },
      ]),
    )
  })
}

function seedAuth() {
  cy.window().then((win) => {
    win.localStorage.setItem('token', 'storefront-customer-token')
    win.localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'customer-mobile-smoke',
        name: 'Cliente Smoke',
        email: 'cliente.smoke@antenor.com.br',
        cpf: '12345678909',
        whatsapp: '21999990000',
      }),
    )
  })
}

function assertNoHorizontalOverflow() {
  cy.window().then((win) => {
    const doc = win.document.documentElement
    const body = win.document.body
    expect(doc.scrollWidth, 'document width').to.be.lte(win.innerWidth + 1)
    expect(body.scrollWidth, 'body width').to.be.lte(win.innerWidth + 1)
  })
}

function assertInViewport(selector: string) {
  cy.get(selector).first().should('be.visible').then(($el) => {
    const rect = $el[0].getBoundingClientRect()
    cy.window().then((win) => {
      expect(rect.left, `${selector} left`).to.be.gte(0)
      expect(rect.right, `${selector} right`).to.be.lte(win.innerWidth + 1)
      expect(rect.top, `${selector} top`).to.be.gte(0)
      expect(rect.bottom, `${selector} bottom`).to.be.lte(win.innerHeight + 1)
    })
  })
}

describe('Storefront mobile visual smoke', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    mockStorefrontApi()
  })

  mobileViewports.forEach((viewportCase) => {
    context(`${viewportCase.name} ${viewportCase.width}x${viewportCase.height}`, () => {
      beforeEach(() => {
        cy.viewport(viewportCase.width, viewportCase.height)
      })

      it('mantem Home navegavel sem overflow horizontal', () => {
        cy.visit('/')
        cy.contains('Buscar produto aqui', { timeout: 10000 }).should('be.visible')
        cy.get('h2:visible', { timeout: 10000 }).contains('Mais Pedidos').should('be.visible')
        cy.contains('nav a', 'Buscar').should('be.visible')
        cy.contains('nav a', 'Carrinho').should('be.visible')

        assertNoHorizontalOverflow()
        assertInViewport('nav')

        cy.contains('Buscar produto aqui').click()
        cy.url().should('include', '/mercado')
      })

      it('mantem modal de verificacao de entrega funcional e sem overflow', () => {
        cy.visit('/', {
          onBeforeLoad(win) {
            cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((
              _success: PositionCallback,
              error: PositionErrorCallback,
            ) => {
              error({ code: 1, message: 'permission-denied' } as GeolocationPositionError)
            })
          },
        })

        cy.contains('button', 'Enviar para: CLIQUE AQUI', { timeout: 10000 }).click()
        cy.get('[role="dialog"]').should('be.visible')
        cy.contains('Verificacao de entrega').should('be.visible')
        cy.contains('Digite seu CEP ou endereco abaixo.').should('be.visible')

        cy.get('[role="dialog"]').within(() => {
          cy.get('input[placeholder="00000-000"]').type('01311000').blur()
        })
        cy.wait('@cepLookup')

        cy.get('[role="dialog"]').within(() => {
          cy.get('input').eq(2).clear().type('1000')
          cy.contains('button', 'Verificar entrega').click()
        })
        cy.wait('@deliveryCalculate')

        cy.contains('Entrega disponivel para Central').should('be.visible')
        assertNoHorizontalOverflow()
      })

      it('mantem Mercado, filtros e CTA de carrinho dentro da viewport', () => {
        cy.visit('/mercado')
        cy.get('input[placeholder="Digite o que você quer levar hoje"]', { timeout: 10000 }).should('be.visible')
        cy.contains('Cafe Especial Antenor', { timeout: 10000 }).should('be.visible')
        assertNoHorizontalOverflow()

        cy.get('button[aria-label="Filtros"]').click()
        cy.get('#filter-panel').should('be.visible')
        cy.contains(/Pre[cç]o/).should('be.visible')
        assertNoHorizontalOverflow()

        cy.get('button[aria-label*="Adicionar Cafe Especial"]').first().click({ force: true })
        cy.contains('Ver carrinho').should('be.visible')
        assertInViewport('a[aria-label*="Ver carrinho"]')
        assertNoHorizontalOverflow()
      })

      it('mantem detalhe do produto legivel e sem deslocamento lateral', () => {
        cy.visit('/produto/mobile-product-1')
        cy.wait('@productDetail')

        cy.get('h1').contains('Cafe Especial Antenor').should('be.visible')
        cy.contains(/R\$/).should('be.visible')
        cy.contains('Produto detalhado').should('be.visible')
        cy.get('a[href="/cart"]').should('be.visible')
        assertNoHorizontalOverflow()
      })

      it('mantem carrinho e checkout com acoes fixas acessiveis', () => {
        cy.visit('/')
        seedCart()

        cy.visit('/cart')
        cy.contains('Seu Carrinho').should('be.visible')
        cy.contains('Cafe Especial Antenor').should('be.visible')
        cy.contains('Fechar pedido').should('be.visible')
        assertInViewport('a[aria-label="Fechar pedido"]')
        assertNoHorizontalOverflow()

        cy.get('a[aria-label="Fechar pedido"]').click()
        cy.url().should('include', '/checkout')
        cy.contains('Finalizar pedido', { timeout: 10000 }).should('be.visible')
        cy.get('input[name="guestName"]').should('be.visible')
        cy.contains('button', /Continuar/).should('be.visible')
        assertNoHorizontalOverflow()
      })
    })
  })
})

describe('Storefront tablet and desktop visual smoke', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
    mockStorefrontApi()
  })

  wideViewports.forEach((viewportCase) => {
    context(`${viewportCase.name} ${viewportCase.width}x${viewportCase.height}`, () => {
      beforeEach(() => {
        cy.viewport(viewportCase.width, viewportCase.height)
      })

      it('mantem Home desktop/tablet navegavel sem bottom nav mobile', () => {
        cy.visit('/')
        cy.get('header:visible', { timeout: 10000 }).contains('Buscar produto aqui').should('be.visible')
        cy.get('main:visible', { timeout: 10000 }).contains('Mais Vendidos').should('be.visible')
        cy.get('nav').should('not.be.visible')
        cy.get('a[aria-label*="Carrinho com"]').should('be.visible')

        assertNoHorizontalOverflow()

        cy.get('header:visible').contains('Buscar produto aqui').click()
        cy.url().should('include', '/mercado')
      })

      it('expoe ativacao de Web Push para cliente logado', () => {
        cy.visit('/')
        seedAuth()

        cy.visit('/')
        cy.get('button[aria-label="Notificações"]', { timeout: 10000 })
          .filter(':visible')
          .first()
          .click()
        cy.contains('Avisos no navegador').should('be.visible')
        cy.contains(/Ativar notificações|Notificações ativas neste navegador\.|Permissão bloqueada no navegador\./).should('be.visible')
        assertNoHorizontalOverflow()
      })

      it('mantem Mercado responsivo sem CTA mobile em md+', () => {
        cy.visit('/mercado')
        cy.get('input[placeholder="Digite o que você quer levar hoje"]', { timeout: 10000 }).should('be.visible')
        cy.contains('Cafe Especial Antenor', { timeout: 10000 }).should('be.visible')
        assertNoHorizontalOverflow()

        cy.get('button[aria-label="Filtros"]').click()
        cy.get('#filter-panel').should('be.visible')
        cy.contains(/Pre[cç]o/).should('be.visible')
        assertNoHorizontalOverflow()

        cy.get('button[aria-label*="Adicionar Cafe Especial"]').first().click({ force: true })
        cy.get('a[aria-label*="Ver carrinho"]').should('not.be.visible')
        cy.get('a[href="/cart"]').first().should('be.visible')
        assertNoHorizontalOverflow()
      })

      it('mantem detalhe do produto dentro da malha responsiva', () => {
        cy.visit('/produto/mobile-product-1')
        cy.wait('@productDetail')

        cy.get('h1').contains('Cafe Especial Antenor').should('be.visible')
        cy.contains('Produto detalhado').should('be.visible')
        cy.get('main:visible').should('have.class', 'grid')
        cy.get('a[href="/cart"]').should('be.visible')
        assertNoHorizontalOverflow()
      })

      it('mantem carrinho e checkout legiveis em tablet/desktop', () => {
        cy.visit('/')
        seedCart()

        cy.visit('/cart')
        cy.contains('Seu Carrinho').should('be.visible')
        cy.contains('Cafe Especial Antenor').should('be.visible')
        assertNoHorizontalOverflow()

        if (viewportCase.width < 1024) {
          assertInViewport('a[aria-label="Fechar pedido"]')
          cy.get('a[aria-label="Fechar pedido"]').click()
        } else {
          cy.get('aside').contains('a', 'Fechar pedido').should('be.visible').click()
        }

        cy.url().should('include', '/checkout')
        cy.contains('Finalizar pedido', { timeout: 10000 }).should('be.visible')
        cy.get('input[name="guestName"]').should('be.visible')
        cy.contains('button', /Continuar/).should('be.visible')
        assertNoHorizontalOverflow()
      })
    })
  })
})
