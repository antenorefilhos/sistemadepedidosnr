describe('Product pricing presentation', () => {
  const PESAVEL_REGEX = /pes[áa]vel/i
  const homeProducts = {
    data: [
      {
        id: 'mock-home-fractional',
        ean: '1111111111111',
        name: 'Produto Pesavel Home',
        price: 12.5,
        promotionalPrice: null,
        stock: 8,
        isFractional: true,
        fractionStep: 0.25,
        unit: 'KG',
        alternativeDescription: 'Porcao minima de 250 g',
        category: 'GERAL',
      },
      {
        id: 'mock-home-unit',
        ean: '2222222222222',
        name: 'Produto Unitario Home',
        price: 9.9,
        promotionalPrice: null,
        stock: 10,
        isFractional: false,
        fractionStep: null,
        unit: 'UN',
        alternativeDescription: 'Unidade avulsa',
        category: 'GERAL',
      },
    ],
    page: 1,
    limit: 20,
    total: 2,
    hasNextPage: false,
  }

  beforeEach(() => {
    cy.intercept('GET', '**/products*', {
      statusCode: 200,
      body: homeProducts,
    }).as('getProductsHome')
  })

  it('mantém a formatação de pesáveis e unitários na home', () => {
    cy.visit('/')
    cy.wait('@getProductsHome')

    cy.get('article').then(($articles) => {
      const fractionalText = Array.from($articles)
        .map((article) => article.textContent?.replace(/\s+/g, ' ').trim() || '')
        .find((text) => PESAVEL_REGEX.test(text))

      expect(fractionalText, 'produto pesável visível na home').to.exist
      expect(fractionalText || '').to.match(/R\$\s?\d+,\d{2}\s*\/\s*\d+(?:,\d+)?\s?(g|kg|ml|l)/i)
      expect(fractionalText || '').to.match(/R\$\s?\d+,\d{2}\s*\/\s*(g|kg|ml|l)/i)
    })

    cy.get('article').then(($articles) => {
      const unitaryText = Array.from($articles)
        .map((article) => article.textContent?.replace(/\s+/g, ' ').trim() || '')
        .find((text) => text.includes('/un') && !PESAVEL_REGEX.test(text))

      expect(unitaryText, 'produto unitário com sufixo /un').to.exist
      expect(unitaryText || '').to.match(/R\$\s?\d+,\d{2}\s*\/un/)
    })
  })

  it('usa porção real de 250g para pesáveis em kg com step explícito', () => {
    cy.visit('/')
    cy.wait('@getProductsHome')

    cy.get('article').then(($articles) => {
      const fractionalText = Array.from($articles)
        .map((article) => article.textContent?.replace(/\s+/g, ' ').trim() || '')
        .find((text) => PESAVEL_REGEX.test(text))

      expect(fractionalText, 'produto pesável para validar porção').to.exist
      const normalized = String(fractionalText).toLowerCase()

      expect(normalized).to.include('250 g')
      expect(normalized).to.match(/r\$\s?\d+,\d{2}\s*\/250 g/)
      expect(normalized).to.not.include('100 g')
      expect(normalized).to.not.include('/1 kg')
    })
  })

  it('não inventa porção 100g para pesável sem fractionStep', () => {
    cy.intercept('GET', '**/products*', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 'mock-home-fractional-missing-step',
            ean: '3333333333333',
            name: 'Produto Pesavel Sem Passo',
            price: 14.5,
            promotionalPrice: null,
            stock: 8,
            isFractional: true,
            fractionStep: null,
            unit: 'KG',
            alternativeDescription: null,
            category: 'GERAL',
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        hasNextPage: false,
      },
    }).as('getProductsMissingStep')

    cy.visit('/mercado')
    cy.wait('@getProductsMissingStep')

    cy.contains('article', /Produto Pesavel.*Passo/i).within(() => {
      cy.contains('Indisponivel').should('be.visible')
      cy.contains('Fracionamento pendente no ERP').should('be.visible')
      cy.contains('/100 g').should('not.exist')
      cy.get('button[aria-label*="Adicionar"]').should('not.exist')
    })
  })

  it('respeita fracionamento do ERP para pesável em KG (step 0.25)', () => {
    const productId = 'mock-fracionado-kg'

    cy.intercept('GET', `**/products/${productId}`, {
      statusCode: 200,
      body: {
        id: productId,
        ean: '999001',
        name: 'Produto Pesavel Teste KG',
        price: 20,
        promotionalPrice: null,
        stock: 10,
        isFractional: true,
        fractionStep: 0.25,
        unit: 'KG',
        alternativeDescription: 'Fracionamento: Preços de produtos pesáveis podem sofrer variação',
        category: 'GERAL',
      },
    })
    cy.intercept('GET', `**/products/${productId}/recommendations*`, { statusCode: 200, body: [] })

    cy.visit(`/produto/${productId}`)

    cy.contains('/250 g').should('be.visible')
    cy.contains('R$').should('be.visible')
    cy.contains('5,00').should('be.visible')
  })

  it('não trata item como pesável quando fracionado=false mesmo com nome/unidade sugerindo kg', () => {
    const productId = 'mock-nao-fracionado-kg'

    cy.intercept('GET', `**/products/${productId}`, {
      statusCode: 200,
      body: {
        id: productId,
        ean: '999002',
        name: 'Produto Nao Fracionado kg',
        price: 15,
        promotionalPrice: null,
        stock: 10,
        isFractional: false,
        fractionStep: null,
        unit: 'KG',
        alternativeDescription: null,
        category: 'GERAL',
      },
    })
    cy.intercept('GET', `**/products/${productId}/recommendations*`, { statusCode: 200, body: [] })

    cy.visit(`/produto/${productId}`)

    cy.contains('/un').should('be.visible')
    cy.contains('/100 g').should('not.exist')
  })
})
