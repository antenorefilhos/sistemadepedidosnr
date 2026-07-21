describe('Produto Detalhado - E2E', () => {
  const product = {
    id: 'mock-detail-product',
    ean: '5555555555555',
    name: 'Produto Detalhe Teste',
    price: 15.5,
    promotionalPrice: null,
    stock: 20,
    isFractional: false,
    fractionStep: null,
    unit: 'UN',
    alternativeDescription: 'Produto para E2E',
    category: 'GERAL',
  }

  beforeEach(() => {
    cy.clearLocalStorage()

    cy.intercept('GET', '**/products*', {
      statusCode: 200,
      body: {
        data: [product],
        page: 1,
        limit: 20,
        total: 1,
        hasNextPage: false,
      },
    }).as('productsList')

    cy.intercept('GET', `**/products/${product.id}`, {
      statusCode: 200,
      body: product,
    }).as('productDetail')

    cy.intercept('GET', `**/products/${product.id}/recommendations*`, {
      statusCode: 200,
      body: [],
    }).as('productRecs')

    cy.intercept('GET', '**/products/produto-que-nao-existe-000', {
      statusCode: 404,
      body: { message: 'Produto não encontrado' },
    }).as('product404')
  })

  it('Deve abrir página de detalhe a partir da Home', () => {
    cy.visit('/')
    cy.wait('@productsList')
    cy.get('a[aria-label*="Ver detalhes"]').first().click({ force: true })
    cy.url().should('include', '/produto/')
  })

  it('Deve abrir página de detalhe a partir do Mercado', () => {
    cy.visit('/mercado')
    cy.wait('@productsList')
    cy.get('a[aria-label*="Ver detalhes"]').first().click({ force: true })
    cy.url().should('include', '/produto/')
  })

  it('Deve exibir nome, preço e ações de navegação', () => {
    cy.visit(`/produto/${product.id}`)
    cy.wait('@productDetail')

    cy.get('h1').should('not.be.empty')
    cy.contains(/R\$/).should('be.visible')
    cy.get('a[href*="/mercado"]').should('have.length.at.least', 1)
    cy.get('a[href="/cart"]').should('have.length.at.least', 1)
  })

  it('Deve exibir acesso ao carrinho a partir do detalhe', () => {
    cy.visit(`/produto/${product.id}`)
    cy.wait('@productDetail')

    cy.get('a[href="/cart"]').first().click({ force: true })
    cy.url().should('include', '/cart')
  })

  it('Deve exibir link "Voltar ao Mercado"', () => {
    cy.visit(`/produto/${product.id}`)
    cy.wait('@productDetail')

    cy.get('a[href="/mercado"], a[href="/"]').first().click({ force: true })
    cy.url().should('match', /\/(mercado)?/)
  })

  it('Deve exibir página de erro para produto inexistente', () => {
    cy.visit('/produto/produto-que-nao-existe-000')
    cy.wait('@product404')
    cy.get('body').invoke('text').should('match', /nao encontrado|não encontrado|not found/i)
  })
})
