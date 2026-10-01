import { BadRequestException } from '@nestjs/common'

// Horario de entrega no servidor (28/09/2026). Espelho da regra do site
// (frontend/src/utils/deliveryOperation.ts): semana + datas especiais, data
// especial vence a semana. Existe para o checkout nao aceitar pedido "o quanto
// antes" com a loja fechada -- antes so a tela barrava.

type HoursWindow = { start: string; end: string }
type SpecialDate = { date: string; closed?: boolean; windows?: HoursWindow[] }
export type HoursConfig = {
  weekly: Record<number, { enabled: boolean; windows: HoursWindow[] }>
  specialDates?: SpecialDate[]
}

const WEEKDAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const zoned = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: WEEKDAY[String(map.weekday).slice(0, 3).toLowerCase()] ?? 0,
    minutes: (Number(map.hour) % 24) * 60 + Number(map.minute),
  }
}

const windowsFor = (config: HoursConfig, isoDate: string, weekday: number): HoursWindow[] => {
  const special = config.specialDates?.find((d) => d.date === isoDate)
  if (special?.closed) return []
  if (special?.windows?.length) return special.windows
  const day = config.weekly[weekday]
  return day?.enabled ? day.windows : []
}

/**
 * `date` cai dentro de uma janela de entrega?
 * `inclusiveEnd`: horario agendado pode ser exatamente o fim da janela (o site
 * oferece ate ele); "agora" nao -- no minuto do fechamento ja esta fechado.
 */
export const isWithinDeliveryHours = (config: HoursConfig, date: Date, inclusiveEnd = false) => {
  const { isoDate, weekday, minutes } = zoned(date)
  return windowsFor(config, isoDate, weekday).some((w) => {
    const end = toMinutes(w.end)
    return minutes >= toMinutes(w.start) && (inclusiveEnd ? minutes <= end : minutes < end)
  })
}

/** Le a config salva no admin; sem horario configurado devolve null (nada a validar). */
export const parseHoursConfig = (businessHours?: string | null, specialDates?: string | null): HoursConfig | null => {
  if (!businessHours) return null
  try {
    return {
      weekly: JSON.parse(businessHours),
      specialDates: specialDates ? JSON.parse(specialDates) : [],
    }
  } catch {
    return null
  }
}

// Validacao do que o admin salva (01/10/2026). Antes o PUT /brand gravava o
// JSON cru: janela com fim antes do inicio ou sobreposta passava, e o site e o
// checkout liam o que viesse.
const DAY_NAME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const cleanWindows = (raw: unknown, where: string): HoursWindow[] => {
  const list = Array.isArray(raw) ? raw : []
  const windows = list.map((w) => ({ start: String(w?.start ?? ''), end: String(w?.end ?? '') }))
  for (const w of windows) {
    if (!HHMM.test(w.start) || !HHMM.test(w.end)) throw new BadRequestException(`Horário inválido em ${where}.`)
    if (toMinutes(w.end) <= toMinutes(w.start)) throw new BadRequestException(`Em ${where}, o fim (${w.end}) precisa ser depois do início (${w.start}).`)
  }
  windows.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  windows.forEach((w, i) => {
    if (i && toMinutes(w.start) < toMinutes(windows[i - 1].end)) throw new BadRequestException(`Em ${where}, os horários ${windows[i - 1].start}–${windows[i - 1].end} e ${w.start}–${w.end} se sobrepõem.`)
  })
  return windows
}

const parseJson = (raw: string, what: string) => {
  try {
    return JSON.parse(raw)
  } catch {
    throw new BadRequestException(`${what} inválido.`)
  }
}

/** Semana: os 7 dias, janelas validas, ordenadas e sem sobreposicao. Dia ligado sem janela vira fechado. */
export const normalizeBusinessHours = (raw: string): string => {
  const parsed = parseJson(raw, 'Horário da semana')
  const weekly: HoursConfig['weekly'] = {}
  for (let d = 0; d < 7; d += 1) {
    const day = parsed?.[d]
    const windows = day?.enabled ? cleanWindows(day.windows, DAY_NAME[d]) : []
    weekly[d] = { enabled: windows.length > 0, windows }
  }
  return JSON.stringify(weekly)
}

/** Datas especiais: data valida, sem repetir, janela valida; as que ja passaram saem. */
export const normalizeSpecialDates = (raw: string, now = new Date()): string => {
  const parsed = parseJson(raw, 'Lista de datas especiais')
  const list: Array<Record<string, unknown>> = Array.isArray(parsed) ? parsed : []
  const today = zoned(now).isoDate
  const seen = new Set<string>()
  const out: Array<SpecialDate & { note?: string }> = []
  for (const item of list) {
    const date = String(item?.date ?? '')
    const noon = new Date(`${date}T12:00:00Z`)
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(noon.getTime()) && noon.toISOString().slice(0, 10) === date
    if (!valid) throw new BadRequestException('Data especial sem data válida.')
    if (date < today) continue
    if (seen.has(date)) throw new BadRequestException(`A data ${date.split('-').reverse().join('/')} aparece duas vezes.`)
    seen.add(date)
    const note = String(item.note ?? '').trim().slice(0, 120) || undefined
    const closed = Boolean(item.closed)
    const windows = closed ? undefined : cleanWindows(item.windows, date.split('-').reverse().join('/'))
    if (!closed && !windows?.length) throw new BadRequestException(`A data ${date.split('-').reverse().join('/')} precisa de horário ou de "Fechado".`)
    out.push({ date, ...(closed ? { closed: true } : { windows }), ...(note ? { note } : {}) })
  }
  return JSON.stringify(out.sort((a, b) => a.date.localeCompare(b.date)))
}
