import { periodRange } from './dashboard-overview.service'

describe('periodRange (fuso de Brasilia)', () => {
  it('"hoje" as 01:30 BRT comeca a meia-noite de Brasilia, nao a meia-noite UTC', () => {
    const now = new Date('2026-09-29T01:30:00-03:00')
    const r = periodRange('day', now)
    expect(r.from.toISOString()).toBe(new Date('2026-09-29T00:00:00-03:00').toISOString())
    // compara com ontem ate a mesma hora
    expect(r.prevTo.toISOString()).toBe(new Date('2026-09-28T01:30:00-03:00').toISOString())
  })

  it('7 dias = hoje + 6 anteriores, e o anterior sao os 7 antes disso, sem sobrepor', () => {
    const now = new Date('2026-09-29T15:00:00-03:00')
    const r = periodRange('week', now)
    expect(r.from.toISOString()).toBe(new Date('2026-09-23T00:00:00-03:00').toISOString())
    expect(r.prevFrom.toISOString()).toBe(new Date('2026-09-16T00:00:00-03:00').toISOString())
    expect(r.prevTo.toISOString()).toBe(r.from.toISOString())
  })
})
