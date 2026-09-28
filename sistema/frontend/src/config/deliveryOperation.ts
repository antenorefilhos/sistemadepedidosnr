import type { WeeklyHours } from '../utils/deliveryOperation'

/** Horario padrao, usado so enquanto o admin nao salvou o seu (brand.businessHours). */
export const DELIVERY_OPERATION_CONFIG: { weekly: WeeklyHours } = {
  weekly: {
    0: { enabled: true, windows: [{ start: '07:00', end: '13:45' }] },
    1: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    2: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    3: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    4: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    5: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
    6: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  },
}
