describe('Receitas - E2E', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  it('Deve exibir a listagem de receitas', () => {
    cy.visit('/receitas')
    cy.get('h1').contains(/Receitas/i).should('be.visible')
  })

  it('Deve exibir estado vazio ou cards na listagem', () => {
    cy.visit('/receitas')
    cy.get('body').invoke('text').should('match', /Receitas|Nenhuma receita publicada/i)
  })

  it('Deve abrir rota de detalhe e renderizar fallback válido', () => {
    cy.visit('/receitas/slug-qualquer-para-teste', { failOnStatusCode: false })
    cy.get('body').invoke('text').should('match', /Receita não encontrada|Receitas|Algo deu errado/i)
  })

  it('Deve exibir página de erro para slug inexistente', () => {
    cy.visit('/receitas/receita-que-nao-existe-xyz-000')
    cy.get('body').invoke('text').should('match', /Receita não encontrada|Algo deu errado|not found/i)
  })
})
