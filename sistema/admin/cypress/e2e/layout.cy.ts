const heroSlides = [
  {
    id: 'slide-ui-1',
    title: 'Festival UI Kit',
    tag: 'Ofertas',
    description: 'Banner principal da auditoria visual.',
    ctaLabel: 'Comprar agora',
    imageUrl: '/branding/antenor-admin-logo.svg',
    link: '/categoria/ofertas',
    order: 0,
    active: true,
  },
  {
    id: 'slide-ui-2',
    title: 'Hortifruti UI',
    tag: 'Frescos',
    description: 'Slide secundario para validar reordenacao.',
    ctaLabel: 'Ver feira',
    imageUrl: '/branding/antenor-admin-logo.svg',
    link: '/categoria/hortifruti',
    order: 1,
    active: false,
  },
]

const categories = [
  {
    id: 'category-layout-1',
    name: 'Bebidas Layout',
    bannerUrl: null,
    active: true,
    priority: 0,
    limit: 8,
    curatedProductIds: [],
  },
  {
    id: 'category-layout-2',
    name: 'Hortifruti Layout',
    bannerUrl: '/branding/antenor-admin-logo.svg',
    active: false,
    priority: 1,
    limit: 6,
    curatedProductIds: ['7890000000011'],
  },
]

const promoBanners = [
  {
    id: 'promo-ui-1',
    title: 'Oferta Relampago UI',
    subtitle: 'Economia',
    description: 'Banner promocional com produto exaltado.',
    imageUrl: '/branding/antenor-admin-logo.svg',
    ctaLabel: 'Ver ofertas',
    link: '/ofertas',
    align: 'left',
    active: true,
    order: 0,
    highlightedProductId: 'product-ui-1',
    highlightedProduct: { id: 'product-ui-1', name: 'Cafe Especial UI' },
    highlightNote: 'Mais pedido da semana',
  },
  {
    id: 'promo-ui-2',
    title: 'Feira Fresca UI',
    subtitle: 'Hortifruti',
    description: 'Banner secundario para validacao visual.',
    imageUrl: '/branding/antenor-admin-logo.svg',
    ctaLabel: 'Ver feira',
    link: '/feira',
    align: 'right',
    active: false,
    order: 1,
  },
]

const promoProducts = [
  {
    id: 'product-ui-2',
    ean: '7890000000028',
    name: 'Suco Integral UI',
    price: 12.9,
    stock: 18,
    unit: 'UN',
    active: true,
  },
]

function mockDashboardReads() {
  cy.intercept('GET', '**/cms/hero-slides', heroSlides).as('getHeroSlides')
  cy.intercept('GET', '**/cms/categories', categories).as('getLayoutCategories')
  cy.intercept('GET', '**/cms/promo-banners/all', promoBanners).as('getPromoBanners')
  cy.intercept('PATCH', '**/cms/hero-slides/slide-ui-1', { ...heroSlides[0], active: false }).as('updateSlideOne')
  cy.intercept('PATCH', '**/cms/hero-slides/slide-ui-2', { ...heroSlides[1], order: 0 }).as('updateSlideTwo')
  cy.intercept('DELETE', '**/cms/hero-slides/slide-ui-1', {}).as('deleteSlideOne')
  cy.intercept('PATCH', '**/cms/categories/category-layout-1', categories[0]).as('updateCategoryOne')
  cy.intercept('PATCH', '**/cms/categories/category-layout-2', { ...categories[1], active: true }).as('updateCategory')
  cy.intercept('PATCH', '**/cms/promo-banners/promo-ui-1', { ...promoBanners[0], active: false }).as('updatePromoOne')
  cy.intercept('DELETE', '**/cms/promo-banners/promo-ui-2', {}).as('deletePromoTwo')

  cy.intercept('GET', '**/customers*', [])
  cy.intercept('GET', '**/admin/orders*', [])
  cy.intercept('GET', '**/products/admin/availability-metrics*', {
    lowStockProducts: 0,
    alwaysEnabledWithZeroStock: 0,
    inactiveWithStock: 0,
  })
  cy.intercept('GET', '**/products/admin*', { data: promoProducts, page: 1, totalPages: 1 })
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

describe('Layout do Site - UI kit operacional', () => {
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

    cy.contains('Layout do Site').click()
    cy.wait('@getHeroSlides')
    cy.wait('@getLayoutCategories')
    cy.wait('@getPromoBanners')
    cy.contains('Slider de Destaque').should('be.visible')
  })

  it('renderiza slider, badges e filtros principais com dados do CMS', () => {
    cy.contains('Festival UI Kit').should('be.visible')
    cy.contains('Comprar agora').should('exist')
    cy.contains('Hortifruti UI').should('be.visible')
    cy.contains('Banners das Seções').scrollIntoView().should('be.visible')
    cy.contains('Curadoria Manual').should('be.visible')
    cy.contains('Bebidas Layout').should('be.visible')
    cy.contains('Hortifruti Layout').should('be.visible')

    cy.get('input[aria-label="Buscar categoria"]').type('horti')
    cy.contains('Bebidas Layout').should('not.exist')
    cy.contains('Hortifruti Layout').should('be.visible')

    cy.contains('button', 'Ocultas').click()
    cy.contains('Hortifruti Layout').should('be.visible')

    cy.contains('button', 'Visíveis').click()
    cy.contains('Hortifruti Layout').should('not.exist')
  })

  it('alterna status do slide e abre o modal de novo slide', () => {
    cy.contains('Festival UI Kit')
      .parents('.group')
      .within(() => {
        cy.contains('button', 'Desativar').click()
      })
    cy.wait('@updateSlideOne')
    cy.contains('Slide desativado.').should('be.visible')

    cy.contains('button', 'Novo Slide').click()
    cy.contains('Novo Slide').should('be.visible')
    cy.get('input[placeholder="Ex: Carnes Nobres Selecionadas"]').should('be.visible')
  })

  it('alterna visibilidade de categoria pela tabela de banners', () => {
    cy.contains('tr', 'Hortifruti Layout').within(() => {
      cy.contains('button', 'Oculto').click()
    })
    cy.wait('@updateCategory')
    cy.contains('Categoria exibida na home.').should('be.visible')
  })

  it('atualiza prioridade, limite e curadoria manual da categoria', () => {
    cy.contains('tr', 'Bebidas Layout').within(() => {
      cy.get('input[aria-label="Prioridade da categoria Bebidas Layout"]').clear().type('3').blur()
    })
    cy.wait('@updateCategoryOne')
    cy.contains('Prioridade da categoria atualizada.').should('be.visible')

    cy.contains('tr', 'Bebidas Layout').within(() => {
      cy.get('input[aria-label="Limite de produtos da categoria Bebidas Layout"]').clear().type('12').blur()
    })
    cy.wait('@updateCategoryOne')
    cy.contains('Limite de produtos atualizado.').should('be.visible')

    cy.contains('tr', 'Bebidas Layout').within(() => {
      cy.get('textarea[aria-label="IDs curados da categoria Bebidas Layout"]').type('7890000000028').blur()
    })
    cy.wait('@updateCategoryOne')
    cy.contains('Curadoria manual da categoria atualizada.').should('be.visible')
  })

  it('abre confirmacao e exclui slide pelo modal migrado', () => {
    cy.get('button[aria-label="Excluir slide Festival UI Kit"]').click({ force: true })
    cy.contains('Excluir slide').should('be.visible')
    cy.contains('O slide').should('contain', 'Festival UI Kit')
    cy.contains('button', 'Cancelar').should('be.visible')

    cy.contains('button', 'Excluir slide').click()
    cy.wait('@deleteSlideOne')
    cy.contains('Slide removido.').should('be.visible')
  })

  it('renderiza e alterna banner promocional da home', () => {
    cy.contains('Banners Promocionais da Home').scrollIntoView().should('be.visible')
    cy.contains('Oferta Relampago UI').should('be.visible')
    cy.contains('Produto exaltado: Cafe Especial UI').should('exist')
    cy.contains('Feira Fresca UI').should('exist')

    cy.contains('Oferta Relampago UI')
      .parents('.overflow-hidden.rounded-lg')
      .within(() => {
        cy.contains('button', 'Desativar').click()
    })
    cy.wait('@updatePromoOne')
    cy.contains('Banner ocultado da home.').should('exist')
  })

  it('edita banner promocional com produto exaltado e alinhamento', () => {
    cy.contains('Oferta Relampago UI')
      .parents('.overflow-hidden.rounded-lg')
      .within(() => {
        cy.contains('button', 'Editar').click()
      })

    cy.contains('Editar Banner Promocional').should('be.visible')
    cy.contains('Sugestões de produto').should('be.visible')
    cy.get('input[placeholder="Nome, EAN ou termo"]').clear().type('suco')
    cy.contains('Suco Integral UI').click()
    cy.contains('Produto selecionado').parent().parent().should('contain', 'Suco Integral UI')
    cy.contains('label', 'Alinhamento').parent().find('select').select('right')
    cy.contains('button', 'Salvar Banner').click()
    cy.wait('@updatePromoOne')
    cy.contains('Banner promocional atualizado.').should('exist')
  })

  it('abre confirmacao e exclui banner promocional', () => {
    cy.get('button[aria-label="Excluir banner Feira Fresca UI"]').click()
    cy.contains('Excluir banner promocional').should('be.visible')
    cy.contains('O banner').should('contain', 'Feira Fresca UI')
    cy.contains('button', 'Cancelar').should('be.visible')

    cy.contains('button', 'Excluir banner').click()
    cy.wait('@deletePromoTwo')
    cy.contains('Banner promocional removido.').should('exist')
  })
})
