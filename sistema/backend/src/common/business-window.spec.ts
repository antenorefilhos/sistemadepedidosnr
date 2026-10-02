import { parseErpBusinessDate, parseErpBusinessDateEnd, isWithinBusinessWindow } from './business-window'

describe('parseErpBusinessDate', () => {
  it('trata data sem horario como meia-noite em America/Sao_Paulo, nao UTC', () => {
    const parsed = parseErpBusinessDate('2026-09-17')
    expect(parsed.toISOString()).toBe('2026-09-17T03:00:00.000Z')
  })

  it('respeita ISO com horario e offset explicitos', () => {
    const parsed = parseErpBusinessDate('2026-09-17T14:30:00-03:00')
    expect(parsed.toISOString()).toBe('2026-09-17T17:30:00.000Z')
  })

  it('meia-noite com Z e o DIA do encarte em Sao Paulo (formato da AntenorApi)', () => {
    // 01/10/2026: VALIDADE NR veio 2026-09-30T00:00:00.000Z e comecava 29/09 21h.
    expect(parseErpBusinessDate('2026-09-30T00:00:00.000Z').toISOString()).toBe('2026-09-30T03:00:00.000Z')
    expect(parseErpBusinessDate('2026-09-30T00:00:00Z').toISOString()).toBe('2026-09-30T03:00:00.000Z')
  })

  it('respeita ISO em UTC (Z) com horario de verdade', () => {
    const parsed = parseErpBusinessDate('2026-09-17T14:30:00.000Z')
    expect(parsed.toISOString()).toBe('2026-09-17T14:30:00.000Z')
  })

  it('regressao do bug real: as 22h de hoje, um encarte de amanha (so data) nao pode parecer ja comecado', () => {
    // JON-171: new Date("2026-09-17") == meia-noite UTC == 21h de HOJE em
    // America/Sao_Paulo. Habilitar um encarte de amanha as 22h de hoje
    // (depois das 21h) fazia esse encarte parecer "ja vigente".
    const hojeAs22h = new Date('2026-09-16T22:00:00-03:00')
    const amanha = parseErpBusinessDate('2026-09-17')
    expect(amanha.getTime()).toBeGreaterThan(hojeAs22h.getTime())
  })
})

describe('parseErpBusinessDateEnd', () => {
  it('trata data sem horario como FIM do dia (23:59:59.999) em America/Sao_Paulo, nao inicio', () => {
    const parsed = parseErpBusinessDateEnd('2026-09-17')
    expect(parsed.toISOString()).toBe('2026-09-18T02:59:59.999Z')
  })

  it('respeita ISO com horario e offset explicitos, sem reinterpretar', () => {
    const parsed = parseErpBusinessDateEnd('2026-09-17T23:59:59.999-03:00')
    expect(parsed.toISOString()).toBe('2026-09-18T02:59:59.999Z')
  })

  it('23:59:59.999Z da AntenorApi e o fim do dia em Sao Paulo, nao 20h59', () => {
    // 01/10/2026: o encarte saia do site as 21h do ultimo dia, 3h antes do caixa.
    expect(parseErpBusinessDateEnd('2026-10-02T23:59:59.999Z').toISOString()).toBe('2026-10-03T02:59:59.999Z')
    expect(parseErpBusinessDateEnd('2026-10-02T00:00:00.000Z').toISOString()).toBe('2026-10-03T02:59:59.999Z')
    expect(parseErpBusinessDateEnd('2026-10-02T18:00:00.000Z').toISOString()).toBe('2026-10-02T18:00:00.000Z')
  })

  it('regressao do bug real: uma campanha que termina "hoje" (so data) nao pode expirar as 00h', () => {
    // Bug espelhado do JON-171 na ponta oposta: usar parseErpBusinessDate
    // (inicio do dia) pra endDate expirava a campanha as 00h do ultimo dia
    // em vez de as 23h59 -- ela sumia da vitrine 24h antes da hora.
    const hojeAs22h = new Date('2026-09-17T22:00:00-03:00')
    const fimDoDia = parseErpBusinessDateEnd('2026-09-17')
    expect(fimDoDia.getTime()).toBeGreaterThan(hojeAs22h.getTime())
  })
})

describe('isWithinBusinessWindow', () => {
  const start = new Date('2026-09-16T00:00:00-03:00')
  const end = new Date('2026-09-18T00:00:00-03:00')

  it('true quando now esta entre start e end (inclusive nas pontas)', () => {
    expect(isWithinBusinessWindow(start, end, new Date('2026-09-17T12:00:00-03:00'))).toBe(true)
    expect(isWithinBusinessWindow(start, end, start)).toBe(true)
    expect(isWithinBusinessWindow(start, end, end)).toBe(true)
  })

  it('false antes do inicio', () => {
    expect(isWithinBusinessWindow(start, end, new Date('2026-09-15T23:59:59-03:00'))).toBe(false)
  })

  it('false depois do fim', () => {
    expect(isWithinBusinessWindow(start, end, new Date('2026-09-18T00:00:01-03:00'))).toBe(false)
  })
})
