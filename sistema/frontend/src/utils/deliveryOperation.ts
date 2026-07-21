import { DELIVERY_OPERATION_CONFIG, type DeliveryDateException, type DeliveryDayConfig } from '../config/deliveryOperation'

type ZonedDateParts = {
  isoDate: string
  weekday: number
  minutesOfDay: number
}

export type DeliveryOperationStatus = {
  isOpen: boolean
  headline: string
  detail: string
  countdownLabel: string | null
  storeHoursLabel: string
  exceptionNote: string | null
}

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const WEEKDAY_LABEL_PT: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
}

const toInt = (value?: string) => Number.parseInt(String(value || '0'), 10)

const pad2 = (value: number) => String(value).padStart(2, '0')

const parseHHMM = (value: string) => {
  const [h, m] = value.split(':').map((part) => Number.parseInt(part, 10))
  return h * 60 + m
}

const formatHHMM = (minutesOfDay: number) => {
  const hours = Math.floor(minutesOfDay / 60)
  const minutes = minutesOfDay % 60
  return `${pad2(hours)}h${pad2(minutes)}`
}

const formatCountdown = (seconds: number) => {
  if (seconds <= 0) return 'encerrando agora'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(s)}s`
  return `${m}m ${pad2(s)}s`
}

const getZonedDateParts = (date: Date): ZonedDateParts => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DELIVERY_OPERATION_CONFIG.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekday = WEEKDAY_SHORT_TO_INDEX[String(map.weekday || '').slice(0, 3).toLowerCase()] ?? 0
  const month = toInt(map.month)
  const day = toInt(map.day)
  const year = toInt(map.year)
  const hour = toInt(map.hour)
  const minute = toInt(map.minute)

  return {
    isoDate: `${year}-${pad2(month)}-${pad2(day)}`,
    weekday,
    minutesOfDay: hour * 60 + minute,
  }
}

const addDaysIso = (isoDate: string, dayOffset: number) => {
  const [y, m, d] = isoDate.split('-').map((value) => Number.parseInt(value, 10))
  const utc = new Date(Date.UTC(y, m - 1, d + dayOffset))
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
}

const getScheduleForDate = (isoDate: string, weekday: number): { schedule: DeliveryDayConfig; exception: DeliveryDateException | null } => {
  const exception = DELIVERY_OPERATION_CONFIG.exceptions[isoDate] || null
  if (DELIVERY_OPERATION_CONFIG.holidays.includes(isoDate)) {
    return { schedule: { enabled: false, windows: [] }, exception }
  }
  if (exception?.closed) {
    return { schedule: { enabled: false, windows: [] }, exception }
  }
  if (exception?.windows) {
    return { schedule: { enabled: exception.windows.length > 0, windows: exception.windows }, exception }
  }
  const weekly = DELIVERY_OPERATION_CONFIG.weekly[weekday] || { enabled: false, windows: [] }
  return { schedule: weekly, exception }
}

const findOpenWindow = (minutesOfDay: number, windows: { start: string; end: string }[]) => {
  return windows.find((window) => {
    const start = parseHHMM(window.start)
    const end = parseHHMM(window.end)
    return minutesOfDay >= start && minutesOfDay < end
  })
}

const findNextWindow = (currentIsoDate: string, currentWeekday: number, currentMinutes: number) => {
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const isoDate = addDaysIso(currentIsoDate, dayOffset)
    const weekday = (currentWeekday + dayOffset) % 7
    const { schedule } = getScheduleForDate(isoDate, weekday)

    if (!schedule.enabled || schedule.windows.length === 0) continue

    const candidate = schedule.windows.find((window) => {
      if (dayOffset > 0) return true
      return parseHHMM(window.start) > currentMinutes
    })

    if (candidate) {
      return {
        dayOffset,
        weekday,
        isoDate,
        start: candidate.start,
      }
    }
  }

  return null
}

export const getDeliveryOperationStatus = (now = new Date()): DeliveryOperationStatus => {
  const { isoDate, weekday, minutesOfDay } = getZonedDateParts(now)
  const { schedule, exception } = getScheduleForDate(isoDate, weekday)

  if (schedule.enabled && schedule.windows.length > 0) {
    const openWindow = findOpenWindow(minutesOfDay, schedule.windows)
    if (openWindow) {
      const closesAtMinutes = parseHHMM(openWindow.end)
      const secondsRemaining = Math.max(0, (closesAtMinutes - minutesOfDay) * 60 - now.getSeconds())
      return {
        isOpen: true,
        headline: 'Entrega aberta agora',
        detail: `Pedidos ate ${formatHHMM(closesAtMinutes)}`,
        countdownLabel: formatCountdown(secondsRemaining),
        storeHoursLabel: DELIVERY_OPERATION_CONFIG.storeHoursLabel,
        exceptionNote: exception?.note || null,
      }
    }
  }

  const nextWindow = findNextWindow(isoDate, weekday, minutesOfDay)
  const nextLabel = nextWindow
    ? nextWindow.dayOffset === 0
      ? `Abre hoje as ${nextWindow.start.replace(':', 'h')}`
      : `Abre ${WEEKDAY_LABEL_PT[nextWindow.weekday]} as ${nextWindow.start.replace(':', 'h')}`
    : 'Sem janela de entrega configurada'

  return {
    isOpen: false,
    headline: 'Entrega fechada no momento',
    detail: nextLabel,
    countdownLabel: null,
    storeHoursLabel: DELIVERY_OPERATION_CONFIG.storeHoursLabel,
    exceptionNote: exception?.note || null,
  }
}

// Variante que aceita configuração dinâmica do backend (businessHours JSON)
export const getDeliveryOperationStatusWithConfig = (
  config: {
    weekly: Record<number, { enabled: boolean; windows: { start: string; end: string }[] }>
    openMessage?: string
    closedMessage?: string
    countdownLabel?: string
  },
  now = new Date(),
): DeliveryOperationStatus => {
  const { weekday, minutesOfDay } = getZonedDateParts(now)

  const dayConfig = config.weekly[weekday] ?? { enabled: false, windows: [] }

  if (dayConfig.enabled && dayConfig.windows.length > 0) {
    const openWindow = findOpenWindow(minutesOfDay, dayConfig.windows)
    if (openWindow) {
      const closesAtMinutes = parseHHMM(openWindow.end)
      const secondsRemaining = Math.max(0, (closesAtMinutes - minutesOfDay) * 60 - now.getSeconds())
      return {
        isOpen: true,
        headline: config.openMessage ?? 'Entrega aberta agora',
        detail: `Pedidos até ${formatHHMM(closesAtMinutes)}`,
        countdownLabel: formatCountdown(secondsRemaining),
        storeHoursLabel: '',
        exceptionNote: null,
      }
    }
  }

  // Próxima abertura com base na configuração dinâmica
  let nextLabel = config.closedMessage ?? 'Entrega fechada no momento'
  for (let offset = 0; offset <= 7; offset++) {
    const futureWeekday = (weekday + offset) % 7
    const futureDayConfig = config.weekly[futureWeekday] ?? { enabled: false, windows: [] }
    if (!futureDayConfig.enabled || futureDayConfig.windows.length === 0) continue
    const candidate = futureDayConfig.windows.find((w) => {
      if (offset > 0) return true
      return parseHHMM(w.start) > minutesOfDay
    })
    if (candidate) {
      const label = offset === 0
        ? `${config.countdownLabel ?? 'Abrimos em'} ${candidate.start.replace(':', 'h')}`
        : `${config.countdownLabel ?? 'Abrimos'} ${WEEKDAY_LABEL_PT[futureWeekday]} às ${candidate.start.replace(':', 'h')}`
      nextLabel = label
      break
    }
  }

  return {
    isOpen: false,
    headline: config.closedMessage ?? 'Entrega fechada no momento',
    detail: nextLabel,
    countdownLabel: null,
    storeHoursLabel: '',
    exceptionNote: null,
  }
}