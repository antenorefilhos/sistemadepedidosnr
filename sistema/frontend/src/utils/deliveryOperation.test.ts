import { describe, it, expect } from 'vitest'
import { getAsapWindow } from './deliveryOperation'

/**
 * JON-177 (Auditoria 360): createFallbackDeliverySlot() prometia entrega em
 * ate 3h sem checar o horario da loja. getAsapWindow() e o que faz o clamp.
 */
const weekly = (weekday: number, start: string, end: string) => ({
  weekly: { [weekday]: { enabled: true, windows: [{ start, end }] } },
})

describe('getAsapWindow', () => {
  it('clampa o fim da janela ao horario de fechamento quando +3h estouraria', () => {
    // segunda 20h30 (America/Sao_Paulo), loja fecha 22h -- ha folga pro lead
    // de 45min mas nao pra janela cheia de 3h (estouraria 23h30)
    const now = new Date('2026-09-14T20:30:00-03:00')
    const result = getAsapWindow(weekly(1, '08:00', '22:00'), now)
    expect(result).not.toBeNull()
    expect(result!.windowEnd.getTime()).toBeLessThan(now.getTime() + 3 * 60 * 60 * 1000)
    expect(result!.windowEnd.toISOString()).toBe(new Date('2026-09-14T22:00:00-03:00').toISOString())
  })

  it('usa a janela cheia de 3h quando ha folga ate o fechamento', () => {
    const now = new Date('2026-09-14T10:00:00-03:00')
    const result = getAsapWindow(weekly(1, '08:00', '22:00'), now)
    expect(result!.windowEnd.toISOString()).toBe(new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString())
  })

  it('retorna null quando a loja esta fechada agora', () => {
    const now = new Date('2026-09-14T23:00:00-03:00')
    const result = getAsapWindow(weekly(1, '08:00', '22:00'), now)
    expect(result).toBeNull()
  })

  it('retorna null quando faltam menos de 45min pro fechamento (janela invertida)', () => {
    const now = new Date('2026-09-14T21:50:00-03:00')
    const result = getAsapWindow(weekly(1, '08:00', '22:00'), now)
    expect(result).toBeNull()
  })
})

import { getDeliveryOperationStatusWithConfig, getScheduleOptionsWithConfig } from './deliveryOperation'

// Segunda a sabado com pausa de almoco, domingo so manha (como em producao).
const loja = {
  weekly: {
    0: { enabled: true, windows: [{ start: '07:00', end: '13:45' }] },
    1: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    2: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  },
  specialDates: [{ date: '2026-09-15', closed: true, note: 'Fechado para balanço' }],
}
const at = (iso: string) => new Date(`${iso}-03:00`)
const msg = (iso: string) => getDeliveryOperationStatusWithConfig(loja, at(iso))

describe('getDeliveryOperationStatusWithConfig', () => {
  it('aberto: diz o fechamento do dia, nao o inicio da pausa de almoco', () => {
    expect(msg('2026-09-14T10:00:00')).toMatchObject({ state: 'open', message: 'Entregamos hoje até 20h50' })
  })
  it('antes da pausa de almoco nao ha urgencia falsa', () => {
    expect(msg('2026-09-14T13:30:00')).toMatchObject({ state: 'open', message: 'Entregamos hoje até 20h50' })
  })
  it('ultima hora: urgencia em minutos', () => {
    expect(msg('2026-09-14T20:15:00')).toMatchObject({ state: 'closing', message: 'Últimos 35 min para pedir' })
  })
  it('intervalo de almoco nao vira "fechado"', () => {
    expect(msg('2026-09-14T14:10:00')).toMatchObject({ state: 'pause', message: 'Voltamos às 14h30' })
  })
  it('antes de abrir: abre hoje', () => {
    expect(msg('2026-09-14T06:00:00').message).toBe('Fechado agora · abrimos hoje às 7h')
  })
  it('data especial fechada pula para o proximo dia aberto e mostra o recado', () => {
    const status = msg('2026-09-15T10:00:00')
    expect(status.state).toBe('closed')
    expect(status.note).toBe('Fechado para balanço')
    expect(status.message).toBe('Fechado agora · abrimos domingo às 7h')
  })
})

describe('getScheduleOptionsWithConfig', () => {
  it('com a loja fechada oferece o proximo dia aberto', () => {
    const options = getScheduleOptionsWithConfig(loja, at('2026-09-14T22:00:00'))
    // 15/09 fechado (data especial) -> proximo aberto e domingo 20/09
    expect(options[0]).toMatchObject({ day: 'Dom 20/09', label: '07:00' })
    expect(new Date(options[0].value).toISOString()).toBe(at('2026-09-20T07:00:00').toISOString())
  })
  it('hoje respeita a antecedencia minima e inclui o proximo dia', () => {
    const options = getScheduleOptionsWithConfig(loja, at('2026-09-14T20:10:00'))
    expect(options[0]).toMatchObject({ day: 'Hoje', label: '20:30' })
    expect(options.some((o) => o.day !== 'Hoje')).toBe(true)
  })
})
