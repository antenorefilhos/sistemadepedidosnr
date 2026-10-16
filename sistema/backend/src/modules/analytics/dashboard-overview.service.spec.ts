import { customRange, periodRange } from './dashboard-overview.service'

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

// Periodo livre do calendario (16/10/2026): alem dos presets fixos, pra ver
// mais do que 30 dias ou um intervalo especifico qualquer.
describe('customRange (periodo livre)', () => {
  it('periodo inteiramente no passado: "ate" vai ate o fim daquele dia, nao ate agora', () => {
    const now = new Date('2026-10-16T15:00:00-03:00')
    const r = customRange('2026-09-01', '2026-09-15', now)
    expect(r.from.toISOString()).toBe(new Date('2026-09-01T00:00:00-03:00').toISOString())
    expect(r.to.toISOString()).toBe(new Date('2026-09-15T23:59:59.999-03:00').toISOString())
    // anterior: os mesmos 15 dias, imediatamente antes
    expect(r.prevFrom.toISOString()).toBe(new Date('2026-08-17T00:00:00-03:00').toISOString())
    expect(r.prevTo.toISOString()).toBe(r.from.toISOString())
  })

  it('periodo que inclui hoje: "ate" para em agora, nao no fim do dia', () => {
    const now = new Date('2026-10-16T15:00:00-03:00')
    const r = customRange('2026-10-10', '2026-10-16', now)
    expect(r.to.toISOString()).toBe(now.toISOString())
  })

  it('um unico dia no passado: de e ate caem no mesmo dia (vira serie por hora)', () => {
    const now = new Date('2026-10-16T15:00:00-03:00')
    const r = customRange('2026-09-01', '2026-09-01', now)
    expect(r.from.toISOString()).toBe(new Date('2026-09-01T00:00:00-03:00').toISOString())
    expect(r.to.toISOString()).toBe(new Date('2026-09-01T23:59:59.999-03:00').toISOString())
  })
})
