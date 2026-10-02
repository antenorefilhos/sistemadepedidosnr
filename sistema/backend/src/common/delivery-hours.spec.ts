import { isWithinDeliveryHours, normalizeBusinessHours, normalizeSpecialDates, parseHoursConfig } from './delivery-hours'

const config = parseHoursConfig(
  JSON.stringify({ 1: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] } }),
  JSON.stringify([{ date: '2026-12-21', closed: true }]),
)!
const at = (iso: string) => new Date(`${iso}-03:00`)

describe('isWithinDeliveryHours', () => {
  it('aberto dentro da janela, fechado no intervalo e depois do fim', () => {
    expect(isWithinDeliveryHours(config, at('2026-09-14T10:00:00'))).toBe(true)
    expect(isWithinDeliveryHours(config, at('2026-09-14T14:10:00'))).toBe(false)
    expect(isWithinDeliveryHours(config, at('2026-09-14T20:50:00'))).toBe(false)
  })

  it('agendamento pode cair exatamente no fim da janela', () => {
    expect(isWithinDeliveryHours(config, at('2026-09-14T20:50:00'), true)).toBe(true)
  })

  it('data especial fechada vence a semana', () => {
    // 21/12/2026 e segunda: pela semana estaria aberto
    expect(isWithinDeliveryHours(config, at('2026-12-21T10:00:00'))).toBe(false)
  })

  it('sem horario configurado nao ha o que validar', () => {
    expect(parseHoursConfig(null)).toBeNull()
  })
})

describe('normalizeBusinessHours', () => {
  const week = (seg: unknown) => JSON.stringify({ 1: seg })

  it('ordena as janelas e liga so quem tem horario', () => {
    const out = JSON.parse(normalizeBusinessHours(week({ enabled: true, windows: [{ start: '14:30', end: '20:50' }, { start: '07:00', end: '14:00' }] })))
    expect(out[1].windows.map((w: { start: string }) => w.start)).toEqual(['07:00', '14:30'])
    expect(out[0]).toEqual({ enabled: false, windows: [] })
    expect(JSON.parse(normalizeBusinessHours(week({ enabled: true, windows: [] })))[1].enabled).toBe(false)
  })

  it('recusa fim antes do inicio, sobreposicao e hora invalida', () => {
    expect(() => normalizeBusinessHours(week({ enabled: true, windows: [{ start: '14:00', end: '07:00' }] }))).toThrow('segunda')
    expect(() => normalizeBusinessHours(week({ enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '13:00', end: '20:00' }] }))).toThrow('sobrepõem')
    expect(() => normalizeBusinessHours(week({ enabled: true, windows: [{ start: '7h', end: '14:00' }] }))).toThrow('inválido')
  })
})

describe('normalizeSpecialDates', () => {
  const now = new Date('2026-10-01T12:00:00-03:00')

  it('tira o que ja passou, ordena e limpa o recado', () => {
    const out = JSON.parse(normalizeSpecialDates(JSON.stringify([
      { date: '2026-12-25', closed: true, note: ' Natal ' },
      { date: '2026-09-07', closed: true },
      { date: '2026-12-24', windows: [{ start: '07:00', end: '16:00' }] },
    ]), now))
    expect(out).toEqual([
      { date: '2026-12-24', windows: [{ start: '07:00', end: '16:00' }] },
      { date: '2026-12-25', closed: true, note: 'Natal' },
    ])
  })

  it('recusa data repetida, data invalida e horario especial sem horario', () => {
    expect(() => normalizeSpecialDates(JSON.stringify([{ date: '2026-12-25', closed: true }, { date: '2026-12-25', closed: true }]), now)).toThrow('duas vezes')
    expect(() => normalizeSpecialDates(JSON.stringify([{ date: '2026-02-30', closed: true }]), now)).toThrow('data válida')
    expect(() => normalizeSpecialDates(JSON.stringify([{ date: '2026-12-24', windows: [] }]), now)).toThrow('Fechado')
  })
})

describe('fulfillmentDay (02/10/2026: o preco segue o dia da entrega)', () => {
  const { fulfillmentDay } = require('./delivery-hours')
  // Segunda a sabado 07:00-20:50, domingo 07:00-13:45; 12/10 fechado (feriado).
  const loja = {
    weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: true, windows: [{ start: '07:00', end: d === 0 ? '13:45' : '20:50' }] }])),
    specialDates: [{ date: '2026-10-12', closed: true }],
  }
  const at = (iso: string) => new Date(iso)

  it('loja aberta: hoje', () => expect(fulfillmentDay(loja, at('2026-10-02T20:49:00-03:00'))).toBe('2026-10-02'))
  it('antes de abrir: hoje', () => expect(fulfillmentDay(loja, at('2026-10-02T05:00:00-03:00'))).toBe('2026-10-02'))
  it('no minuto do fechamento ja e amanha', () => expect(fulfillmentDay(loja, at('2026-10-02T20:50:00-03:00'))).toBe('2026-10-03'))
  it('depois das 23h ainda e amanha (nao vira o dia por meia-noite UTC)', () => expect(fulfillmentDay(loja, at('2026-10-02T23:30:00-03:00'))).toBe('2026-10-03'))
  it('domingo depois das 13h45: segunda', () => expect(fulfillmentDay(loja, at('2026-10-04T14:00:00-03:00'))).toBe('2026-10-05'))
  it('vespera de feriado depois do fechamento: pula o feriado', () => expect(fulfillmentDay(loja, at('2026-10-11T14:00:00-03:00'))).toBe('2026-10-13'))
  it('sem horario configurado: o proprio dia', () => expect(fulfillmentDay(null, at('2026-10-02T23:30:00-03:00'))).toBe('2026-10-02'))
})

describe('nextOpenAt / lastCloseOnOrBefore (fila de envios, 02/10/2026)', () => {
  const { nextOpenAt, lastCloseOnOrBefore } = require('./delivery-hours')
  const loja = {
    weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: true, windows: [{ start: '07:00', end: d === 0 ? '13:45' : '20:50' }] }])),
    specialDates: [{ date: '2026-10-12', closed: true }],
  }
  const iso = (d: Date) => d.toISOString()

  it('aberta agora: o proprio instante', () => expect(iso(nextOpenAt(loja, new Date('2026-10-02T10:00:00-03:00')))).toBe('2026-10-02T13:00:00.000Z'))
  it('de madrugada: a abertura do dia', () => expect(iso(nextOpenAt(loja, new Date('2026-10-02T02:00:00-03:00')))).toBe('2026-10-02T10:00:00.000Z'))
  it('depois do fechamento: a abertura de amanha', () => expect(iso(nextOpenAt(loja, new Date('2026-10-02T21:00:00-03:00')))).toBe('2026-10-03T10:00:00.000Z'))
  it('vespera de feriado a noite: pula o feriado', () => expect(iso(nextOpenAt(loja, new Date('2026-10-11T14:00:00-03:00')))).toBe('2026-10-13T10:00:00.000Z'))
  it('ultimo fechamento do dia', () => expect(iso(lastCloseOnOrBefore(loja, '2026-10-02'))).toBe('2026-10-02T23:50:00.000Z'))
  it('domingo fecha 13h45', () => expect(iso(lastCloseOnOrBefore(loja, '2026-10-04'))).toBe('2026-10-04T16:45:00.000Z'))
  it('feriado fechado: o fechamento do dia anterior', () => expect(iso(lastCloseOnOrBefore(loja, '2026-10-12'))).toBe('2026-10-11T16:45:00.000Z'))
})
