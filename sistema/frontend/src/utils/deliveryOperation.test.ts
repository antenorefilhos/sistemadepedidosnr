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
