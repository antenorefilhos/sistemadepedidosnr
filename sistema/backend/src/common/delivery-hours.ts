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
