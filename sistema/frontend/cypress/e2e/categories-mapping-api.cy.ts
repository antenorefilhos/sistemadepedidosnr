describe('Categories Mapping API', () => {
  const apiBase = 'http://localhost:3001'

  it('GET /api/categories/hierarchy returns N1/N2 structure', () => {
    cy.request(`${apiBase}/api/categories/hierarchy`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.success).to.eq(true)
      expect(res.body.data).to.be.an('array')
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).to.have.property('id')
        expect(res.body.data[0]).to.have.property('name')
        expect(res.body.data[0]).to.have.property('children')
      }
    })
  })

  it('GET /api/categories/stats/mapping returns mapping coverage', () => {
    cy.request(`${apiBase}/api/categories/stats/mapping`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.success).to.eq(true)
      expect(res.body.data).to.have.property('mapped')
      expect(res.body.data).to.have.property('pending')
      expect(res.body.data).to.have.property('total')
      expect(res.body.data).to.have.property('unmapped')
    })
  })

  it('GET /api/categories/pending/list returns paginated pending list', () => {
    cy.request(`${apiBase}/api/categories/pending/list?limit=10&offset=0`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body.success).to.eq(true)
      expect(res.body).to.have.property('pagination')
      expect(res.body.pagination).to.have.property('limit')
      expect(res.body.pagination).to.have.property('offset')
      expect(res.body.pagination).to.have.property('total')
    })
  })
})
