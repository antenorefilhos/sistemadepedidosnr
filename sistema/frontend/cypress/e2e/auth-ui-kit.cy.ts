type ViewportCase = {
  name: string
  width: number
  height: number
}

const viewports: ViewportCase[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]

function assertNoHorizontalOverflow() {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1)
  })
}

describe('Auth UI kit storefront', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  viewports.forEach((viewportCase) => {
    it(`renderiza login com controles do UI kit em ${viewportCase.name}`, () => {
      cy.viewport(viewportCase.width, viewportCase.height)
      cy.visit('/login')

      cy.contains('h2', 'Entre e continue sua compra').should('be.visible')
      cy.get('input[name="email"]').should('be.visible').and('have.attr', 'type', 'email')
      cy.get('input[name="password"]').should('be.visible').and('have.attr', 'type', 'password')
      cy.contains('button', 'Entrar agora').should('be.visible')
      cy.contains('button', 'Criar conta grátis').should('be.visible')
      cy.contains('a', 'Voltar à loja').should('be.visible')
      assertNoHorizontalOverflow()
    })

    it(`renderiza cadastro com controles do UI kit em ${viewportCase.name}`, () => {
      cy.viewport(viewportCase.width, viewportCase.height)
      cy.visit('/register')

      cy.contains('h2', 'Crie sua conta e compre melhor').should('be.visible')
      cy.get('input[name="name"]').should('be.visible')
      cy.get('input[name="email"]').should('be.visible').and('have.attr', 'type', 'email')
      cy.get('input[name="cpf"]').should('be.visible')
      cy.get('input[name="whatsapp"]').should('be.visible')
      cy.get('input[name="password"]').should('be.visible').and('have.attr', 'type', 'password')
      cy.get('input[name="confirmPassword"]').should('be.visible').and('have.attr', 'type', 'password')
      cy.get('select[name="origin"]').should('be.visible')
      cy.contains('button', 'Criar conta grátis').should('be.visible')
      cy.contains('button', 'Entrar agora').should('be.visible')
      cy.contains('a', 'Voltar à loja').should('be.visible')
      assertNoHorizontalOverflow()
    })
  })
})
