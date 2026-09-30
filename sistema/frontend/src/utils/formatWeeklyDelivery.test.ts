import { describe, expect, it } from 'vitest'
import { formatWeeklyDelivery, type WeeklyHours } from './deliveryOperation'

const semana = (dom: WeeklyHours[number], resto: WeeklyHours[number]): WeeklyHours => ({ 0: dom, 1: resto, 2: resto, 3: resto, 4: resto, 5: resto, 6: resto })

describe('formatWeeklyDelivery', () => {
  it('agrupa os dias iguais e mostra a pausa do almoco', () => {
    const w = semana(
      { enabled: true, windows: [{ start: '07:00', end: '13:45' }] },
      { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    )
    expect(formatWeeklyDelivery(w)).toBe('Entregas: Seg a Sáb 7h–14h e 14h30–20h50 · Dom 7h–13h45')
  })
  it('dia fechado some do texto', () => {
    const w = semana({ enabled: false, windows: [] }, { enabled: true, windows: [{ start: '08:00', end: '18:00' }] })
    expect(formatWeeklyDelivery(w)).toBe('Entregas: Seg a Sáb 8h–18h')
  })
  it('sem nenhum dia aberto devolve nulo', () => {
    expect(formatWeeklyDelivery(semana({ enabled: false, windows: [] }, { enabled: false, windows: [] }))).toBeNull()
  })
})
