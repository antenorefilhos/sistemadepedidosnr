import { isWithinDeliveryHours, parseHoursConfig } from './delivery-hours'

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
