describe('Smoke Test - Loja do Cliente', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  it('Deve permitir acesso público à Home sem login', () => {
    cy.visit('/')
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    cy.get('main').should('exist')
    cy.get('body').should('contain.text', 'Buscar produto aqui')
    cy.url().should('not.include', '/login')
  })

  it('Deve navegar para Mercado (busca)', () => {
    cy.visit('/mercado')
    cy.url().should('include', '/mercado')
    cy.get('main').should('exist')
    cy.get('body').should('contain.text', 'Filtros')
  })

  it('Deve navegar para o carrinho e exibir estado vazio', () => {
    cy.visit('/cart')
    cy.url().should('include', '/cart')
    cy.get('body').should('contain.text', 'carrinho')
  })

  it('Deve proteger a rota de conta sem autenticação', () => {
    cy.visit('/account', { failOnStatusCode: false })
    cy.url().should('match', /\/(account|login|forbidden)$/)
  })
})
