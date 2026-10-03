import { DELIVERY_OPERATION_CONFIG } from '../config/deliveryOperation'

// Horario de entrega (28/09/2026, refeito a pedido do Jonathan). Um so lugar
// decide: a faixa do topo, os horarios do checkout e a janela "o quanto
// antes". Espelho no backend: backend/src/common/delivery-hours.ts -- quem
// mudar a regra aqui muda la tambem.

export type HoursWindow = { start: string; end: string }
export type WeeklyHours = Record<number, { enabled: boolean; windows: HoursWindow[] }>
/** Data especial cadastrada no admin: fechado, horario reduzido e/ou recado. */
export type SpecialDate = { date: string; closed?: boolean; windows?: HoursWindow[]; note?: string }
export type HoursConfig = { weekly: WeeklyHours; specialDates?: SpecialDate[] }

export type DeliveryOperationStatus = {
  /** open: aceitando pedido | closing: ultima hora | pause: intervalo curto no dia | closed */
  state: 'open' | 'closing' | 'pause' | 'closed'
  isOpen: boolean
  message: string
  /** Recado da data especial de hoje (ex.: "Vespera de Natal: ate 16h"). */
  note: string | null
}

export type ScheduleOption = {
  /** ISO enviado ao backend (vira hrCombinada no ERP). */
  value: string
  /** Rotulo curto, ex.: "14:30". */
  label: string
  /** Agrupador do select, ex.: "Hoje", "Amanha", "Seg 29/09". */
  day: string
}

/** Antecedencia minima entre o pedido e a entrega/retirada. */
export const SCHEDULE_LEAD_MINUTES = 15
const SCHEDULE_STEP_MINUTES = 30
const TIMEZONE = 'America/Sao_Paulo'

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const WEEKDAY_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WEEKDAY_PT_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const pad2 = (value: number) => String(value).padStart(2, '0')
const parseHHMM = (value: string) => {
  const [h, m] = value.split(':').map((part) => Number.parseInt(part, 10))
  return h * 60 + m
}
/** 420 -> "7h", 1250 -> "20h50". */
const formatHour = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${pad2(m)}` : `${h}h`
}

const getZonedDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = Number(map.hour) % 24
  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: WEEKDAY_SHORT_TO_INDEX[String(map.weekday).slice(0, 3).toLowerCase()] ?? 0,
    minutesOfDay: hour * 60 + Number(map.minute),
  }
}

const addDaysIso = (isoDate: string, days: number) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
}

/** Janelas de um dia: data especial vence a semana. */
export const getDayHours = (config: HoursConfig, isoDate: string, weekday: number) => {
  const special = config.specialDates?.find((d) => d.date === isoDate)
  if (special?.closed) return { windows: [] as HoursWindow[], note: special.note || null }
  if (special?.windows?.length) return { windows: special.windows, note: special.note || null }
  const day = config.weekly[weekday]
  return { windows: day?.enabled ? day.windows : [], note: special?.note || null }
}

/**
 * Dia da semana da entrega/retirada de um pedido feito agora: hoje, se a loja
 * ainda atende hoje; senao o proximo dia aberto. Mesma regra do servidor
 * (fulfillmentDay em backend/src/common/delivery-hours.ts).
 */
export const getFulfillmentWeekday = (config: HoursConfig, now = new Date()): number => {
  const { isoDate, weekday, minutesOfDay } = getZonedDateParts(now)
  if (getDayHours(config, isoDate, weekday).windows.some((w) => minutesOfDay < parseHHMM(w.end))) return weekday
  for (let offset = 1; offset <= 14; offset += 1) {
    if (getDayHours(config, addDaysIso(isoDate, offset), (weekday + offset) % 7).windows.length) return (weekday + offset) % 7
  }
  return weekday
}

/** Proxima abertura a partir de agora (hoje mais tarde ou nos proximos 7 dias). */
const findNextOpening = (config: HoursConfig, isoDate: string, weekday: number, minutesOfDay: number) => {
  for (let offset = 0; offset <= 7; offset += 1) {
    const { windows } = getDayHours(config, addDaysIso(isoDate, offset), (weekday + offset) % 7)
    const next = windows
      .map((w) => parseHHMM(w.start))
      .sort((a, b) => a - b)
      .find((start) => offset > 0 || start > minutesOfDay)
    if (next !== undefined) return { offset, weekday: (weekday + offset) % 7, start: next }
  }
  return null
}

export const getDeliveryOperationStatusWithConfig = (config: HoursConfig, now = new Date()): DeliveryOperationStatus => {
  const { isoDate, weekday, minutesOfDay } = getZonedDateParts(now)
  const today = getDayHours(config, isoDate, weekday)
  const open = today.windows.find((w) => minutesOfDay >= parseHHMM(w.start) && minutesOfDay < parseHHMM(w.end))

  if (open) {
    // "Ate" e o fechamento do DIA, nao o fim da janela atual: a pausa de
    // almoco (14h-14h30) e curta e nao e o horario de fechamento (Jonathan, 28/09).
    const end = Math.max(...today.windows.map((w) => parseHHMM(w.end)))
    const left = end - minutesOfDay
    // Urgencia so quando e verdade: na ultima hora antes de fechar o dia.
    if (left <= 60) {
      return { state: 'closing', isOpen: true, message: left <= 1 ? 'Últimos instantes para pedir' : `Últimos ${left} min para pedir`, note: today.note }
    }
    return { state: 'open', isOpen: true, message: `Entregamos hoje até ${formatHour(end)}`, note: today.note }
  }

  const next = findNextOpening(config, isoDate, weekday, minutesOfDay)
  if (!next) return { state: 'closed', isOpen: false, message: 'Entregas indisponíveis no momento', note: today.note }

  const alreadyOpenedToday = today.windows.some((w) => parseHHMM(w.end) <= minutesOfDay)
  // Intervalo curto no meio do dia (ex.: 14h-14h30) nao e "fechado".
  if (next.offset === 0 && alreadyOpenedToday) {
    return { state: 'pause', isOpen: false, message: `Voltamos às ${formatHour(next.start)}`, note: today.note }
  }

  const when = next.offset === 0 ? 'hoje' : next.offset === 1 ? 'amanhã' : WEEKDAY_PT[next.weekday]
  return { state: 'closed', isOpen: false, message: `Fechado agora · abrimos ${when} às ${formatHour(next.start)}`, note: today.note }
}

/**
 * Horarios que o cliente pode escolher: o que resta de hoje (com antecedencia
 * minima) e o proximo dia aberto -- assim, com a loja fechada, ainda da pra
 * agendar para amanha em vez de perder a venda.
 */
export const getScheduleOptionsWithConfig = (config: HoursConfig, now = new Date()): ScheduleOption[] => {
  const { isoDate, weekday, minutesOfDay } = getZonedDateParts(now)
  const options: ScheduleOption[] = []
  let daysWithOptions = 0

  for (let offset = 0; offset <= 7 && daysWithOptions < 2; offset += 1) {
    const dayIso = addDaysIso(isoDate, offset)
    const dayWeekday = (weekday + offset) % 7
    const { windows } = getDayHours(config, dayIso, dayWeekday)
    const [, month, day] = dayIso.split('-')
    const dayLabel = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : `${WEEKDAY_PT_SHORT[dayWeekday]} ${day}/${month}`
    const earliest = offset === 0 ? minutesOfDay + SCHEDULE_LEAD_MINUTES : 0
    const before = options.length

    for (const window of windows) {
      const from = Math.max(parseHHMM(window.start), earliest)
      const firstStep = Math.ceil(from / SCHEDULE_STEP_MINUTES) * SCHEDULE_STEP_MINUTES
      for (let minute = firstStep; minute <= parseHHMM(window.end); minute += SCHEDULE_STEP_MINUTES) {
        // ISO pelo deslocamento em minutos a partir de `now` (sem lib de fuso).
        const target = new Date(now.getTime() + (offset * 1440 + minute - minutesOfDay) * 60 * 1000)
        target.setSeconds(0, 0)
        options.push({ value: target.toISOString(), label: `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`, day: dayLabel })
      }
    }
    if (options.length > before) daysWithOptions += 1
  }

  return options
}

/**
 * JON-177 (Auditoria 360): janela "o quanto antes" clampada ao horario de
 * funcionamento -- sem isso, createFallbackDeliverySlot() prometia entrega
 * em ate 3h mesmo com a loja fechada. Retorna null se a loja esta fechada
 * agora (o checkout entao exige escolher um horario).
 */
export const getAsapWindow = (config: HoursConfig, now = new Date()): { windowStart: Date; windowEnd: Date } | null => {
  const { isoDate, weekday, minutesOfDay } = getZonedDateParts(now)
  const { windows } = getDayHours(config, isoDate, weekday)
  const openWindow = windows.find((w) => minutesOfDay >= parseHHMM(w.start) && minutesOfDay < parseHHMM(w.end))
  if (!openWindow) return null

  const closesAt = new Date(now.getTime() + (parseHHMM(openWindow.end) - minutesOfDay) * 60 * 1000)
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000)
  const uncappedEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const windowEnd = uncappedEnd < closesAt ? uncappedEnd : closesAt
  if (windowEnd <= windowStart) return null
  return { windowStart, windowEnd }
}

/** Horario da marca (admin) ou, sem ele, o padrao embutido. */
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const hourLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`
}

/**
 * "Entregas: Seg a Sáb 7h–14h e 14h30–20h50 · Dom 7h–13h45", a partir do
 * horario configurado no admin (30/09/2026). O rodape mostrava um texto fixo
 * que ja divergia da configuracao (domingo "ate 13h50" com 13h45 cadastrado).
 */
export const formatWeeklyDelivery = (weekly: WeeklyHours): string | null => {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const sig = (d: number) => {
    const day = weekly[d]
    if (!day?.enabled || !day.windows?.length) return ''
    return day.windows.map((w) => `${hourLabel(w.start)}–${hourLabel(w.end)}`).join(' e ')
  }
  const groups: Array<{ from: number; to: number; text: string }> = []
  for (const d of order) {
    const text = sig(d)
    const last = groups[groups.length - 1]
    if (last && last.text === text && order.indexOf(d) === order.indexOf(last.to) + 1) last.to = d
    else groups.push({ from: d, to: d, text })
  }
  const parts = groups
    .filter((g) => g.text)
    .map((g) => {
      const days = g.from === g.to ? DAY_SHORT[g.from] : `${DAY_SHORT[g.from]} a ${DAY_SHORT[g.to]}`
      return `${days} ${g.text}`
    })
  return parts.length ? `Entregas: ${parts.join(' · ')}` : null
}

export const parseHoursConfig = (businessHours?: string | null, specialDates?: string | null): HoursConfig => {
  const parse = <T,>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  return {
    weekly: parse<WeeklyHours>(businessHours, DELIVERY_OPERATION_CONFIG.weekly),
    specialDates: parse<SpecialDate[]>(specialDates, []),
  }
}
