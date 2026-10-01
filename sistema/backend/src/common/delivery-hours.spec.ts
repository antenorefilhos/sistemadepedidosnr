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
