export type DeliveryWindow = {
  start: string
  end: string
}

export type DeliveryDayConfig = {
  enabled: boolean
  windows: DeliveryWindow[]
}

export type DeliveryDateException = {
  closed?: boolean
  windows?: DeliveryWindow[]
  note?: string
}

export type DeliveryOperationConfig = {
  timezone: string
  storeHoursLabel: string
  weekly: Record<number, DeliveryDayConfig>
  exceptions: Record<string, DeliveryDateException>
  holidays: string[]
}

export const DELIVERY_OPERATION_CONFIG: DeliveryOperationConfig = {
  timezone: 'America/Sao_Paulo',
  storeHoursLabel: 'Loja fisica: todos os dias, 08h as 20h',
  weekly: {
    0: { enabled: true, windows: [{ start: '09:00', end: '13:00' }] },
    1: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
    2: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
    3: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
    4: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
    5: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '21:00' }] },
    6: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  },
  exceptions: {
    '2026-12-24': {
      windows: [{ start: '08:00', end: '16:00' }],
      note: 'Vespera de Natal com janela reduzida',
    },
    '2026-12-31': {
      windows: [{ start: '08:00', end: '15:00' }],
      note: 'Vespera de Ano Novo com janela reduzida',
    },
  },
  holidays: ['2026-12-25', '2026-01-01'],
}