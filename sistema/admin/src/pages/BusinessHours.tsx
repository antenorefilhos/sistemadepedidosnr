import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Plus, X } from 'lucide-react'
import { brandAPI, getApiErrorMessage, intelligenceAPI } from '../services/api'
import { Switch } from '@/components/ui/switch'

// Horario de entrega (refeita em 01/10/2026). Uma regra so vale para a faixa do
// topo do site, os horarios do checkout e a recusa do servidor
// (backend/src/common/delivery-hours.ts). O servidor valida o que chega aqui.

type Window = { start: string; end: string }
type DayConfig = { enabled: boolean; windows: Window[] }
type WeeklyConfig = Record<number, DayConfig>
/** Feriado ou horario reduzido: vence a semana naquele dia. */
type SpecialDate = { date: string; closed?: boolean; windows?: Window[]; note?: string }

const TZ = 'America/Sao_Paulo'
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAY_LOWER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const HEAT_HOURS = Array.from({ length: 24 }, (_, i) => i)

// So o ponto de partida quando nada foi salvo ainda.
const DEFAULT_HOURS: WeeklyConfig = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [
    d,
    { enabled: true, windows: d === 0 ? [{ start: '07:00', end: '13:45' }] : [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  ]),
)

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const hourLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}
const brDate = (iso: string) => iso.split('-').reverse().join('/')
const nowParts = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  const iso = `${p.year}-${p.month}-${p.day}`
  return { iso, weekday: new Date(`${iso}T12:00:00Z`).getUTCDay(), minutes: Number(p.hour) * 60 + Number(p.minute) }
}
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Mesmo erro que o servidor daria, mostrado antes de salvar. */
function windowsError(windows: Window[]): string | null {
  for (const w of windows) {
    if (!w.start || !w.end) return 'Preencha início e fim.'
    if (toMin(w.end) <= toMin(w.start)) return `O fim (${w.end}) precisa ser depois do início (${w.start}).`
  }
  const sorted = [...windows].sort((a, b) => toMin(a.start) - toMin(b.start))
  for (let i = 1; i < sorted.length; i += 1) {
    if (toMin(sorted[i].start) < toMin(sorted[i - 1].end)) return `${sorted[i - 1].start}–${sorted[i - 1].end} e ${sorted[i].start}–${sorted[i].end} se sobrepõem.`
  }
  return null
}

function dayWindows(weekly: WeeklyConfig, specials: SpecialDate[], iso: string, weekday: number) {
  const special = specials.find((d) => d.date === iso)
  if (special?.closed) return { windows: [] as Window[], note: special.note || null }
  if (special?.windows?.length) return { windows: special.windows, note: special.note || null }
  return { windows: weekly[weekday]?.enabled ? weekly[weekday].windows : [], note: special?.note || null }
}

/** O que a faixa do topo do site diz agora (mesma regra de frontend/src/utils/deliveryOperation.ts). */
function statusNow(weekly: WeeklyConfig, specials: SpecialDate[]) {
  const { iso, weekday, minutes } = nowParts()
  const today = dayWindows(weekly, specials, iso, weekday).windows
  if (today.some((w) => minutes >= toMin(w.start) && minutes < toMin(w.end))) {
    const end = today.reduce((max, w) => (toMin(w.end) > toMin(max) ? w.end : max), today[0].end)
    return { open: true, text: `Entregando agora · até ${hourLabel(end)}` }
  }
  for (let offset = 0; offset <= 7; offset += 1) {
    const wd = (weekday + offset) % 7
    const next = dayWindows(weekly, specials, addDays(iso, offset), wd)
      .windows.map((w) => w.start)
      .sort()
      .find((start) => offset > 0 || toMin(start) > minutes)
    if (next) {
      const when = offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : DAY_LOWER[wd]
      return { open: false, text: `Fechado agora · abre ${when} às ${hourLabel(next)}` }
    }
  }
  return { open: false, text: 'Sem entrega nos próximos 7 dias' }
}

function suggestedHolidays(): SpecialDate[] {
  const year = Number(nowParts().iso.slice(0, 4))
  return [
    { date: `${year}-12-24`, windows: [{ start: '07:00', end: '16:00' }], note: 'Véspera de Natal: até 16h' },
    { date: `${year}-12-25`, closed: true, note: 'Natal: fechado' },
    { date: `${year}-12-31`, windows: [{ start: '07:00', end: '15:00' }], note: 'Véspera de Ano Novo: até 15h' },
    { date: `${year + 1}-01-01`, closed: true, note: 'Ano Novo: fechado' },
  ]
}

const timeInput = 'h-8 w-[5.25rem] rounded-lg border border-black/[0.08] bg-white px-1.5 text-sm tabular-nums focus:border-gray-900 focus:outline-none'

export default function BusinessHours() {
  const qc = useQueryClient()
  const [weekly, setWeekly] = useState<WeeklyConfig>(DEFAULT_HOURS)
  const [specials, setSpecials] = useState<SpecialDate[]>([])
  const [baseline, setBaseline] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: brand, isLoading } = useQuery({ queryKey: ['brand'], queryFn: async () => (await brandAPI.get()).data })
  const { data: heat, isError: heatError } = useQuery({
    queryKey: ['intelligence', 90],
    queryFn: async () => (await intelligenceAPI.get(90)).data,
    retry: false,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!brand) return
    let w = DEFAULT_HOURS
    let s: SpecialDate[] = []
    try { if (brand.businessHours) w = JSON.parse(brand.businessHours) } catch { /* fica o padrao */ }
    try { if (brand.specialDates) s = JSON.parse(brand.specialDates) } catch { /* vazio */ }
    const today = nowParts().iso
    s = s.filter((d) => !d.date || d.date >= today) // o servidor tira as passadas ao salvar
    setWeekly(w)
    setSpecials(s)
    setBaseline(JSON.stringify({ w, s }))
  }, [brand])

  const dirty = baseline !== '' && JSON.stringify({ w: weekly, s: specials }) !== baseline
  const dayErrors = useMemo(
    () => Object.fromEntries(ORDER.map((d) => [d, weekly[d]?.enabled ? (weekly[d].windows.length ? windowsError(weekly[d].windows) : 'Ligado sem horário: adicione um intervalo ou desligue.') : null])),
    [weekly],
  )
  const specialErrors = useMemo(
    () =>
      specials.map((d, i) => {
        if (!d.date) return 'Escolha a data.'
        if (specials.findIndex((x) => x.date === d.date) !== i) return 'Essa data já está na lista.'
        return d.closed ? null : windowsError(d.windows || [])
      }),
    [specials],
  )
  const hasErrors = Object.values(dayErrors).some(Boolean) || specialErrors.some(Boolean)

  const saveMut = useMutation({
    mutationFn: () => brandAPI.update({ businessHours: JSON.stringify(weekly), specialDates: JSON.stringify(specials) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const setDay = (d: number, patch: Partial<DayConfig>) => setWeekly((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }))
  const setWindow = (d: number, i: number, patch: Partial<Window>) =>
    setDay(d, { windows: weekly[d].windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) })
  const addWindow = (d: number) => {
    const last = weekly[d].windows[weekly[d].windows.length - 1]
    const start = last ? last.end : '07:00'
    setDay(d, { enabled: true, windows: [...weekly[d].windows, { start, end: fromMin(Math.min(toMin(start) + 120, 1439)) }] })
  }
  const toggleDay = (d: number, on: boolean) =>
    setDay(d, { enabled: on, windows: on && !weekly[d].windows.length ? [{ start: '07:00', end: '14:00' }] : weekly[d].windows })
  const setSpecial = (i: number, patch: Partial<SpecialDate>) => setSpecials((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  const status = statusNow(weekly, specials)
  const todayIso = nowParts().iso
  const preview = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(todayIso, i)
    const wd = new Date(`${iso}T12:00:00Z`).getUTCDay()
    const { windows, note } = dayWindows(weekly, specials, iso, wd)
    return {
      iso,
      label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${DAY_SHORT[wd]} ${brDate(iso).slice(0, 5)}`,
      hours: windows.length ? windows.map((w) => `${hourLabel(w.start)}–${hourLabel(w.end)}`).join(' · ') : 'Sem entrega',
      note,
      special: specials.some((d) => d.date === iso),
    }
  })

  // Pedidos por dia e hora (90 dias) sobre o horario da semana: mostra demanda fora do horario.
  const openAt = (d: number, h: number) => weekly[d]?.enabled && weekly[d].windows.some((w) => toMin(w.start) < (h + 1) * 60 && toMin(w.end) > h * 60)
  const countAt = (d: number, h: number) => heat?.heatmap.find((p) => p.dow === d && p.hour === h)?.n || 0
  const totalOrders = heat?.heatmap.reduce((a, p) => a + p.n, 0) || 0
  const outside = heat?.heatmap.filter((p) => !openAt(p.dow, p.hour)).reduce((a, p) => a + p.n, 0) || 0

  if (isLoading) return <div className="mx-auto h-64 max-w-7xl animate-pulse rounded-2xl bg-white/70" />

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="max-w-2xl text-sm text-gray-500">Vale para a faixa do topo do site, os horários do checkout e o servidor, que recusa pedido "o quanto antes" com a entrega fechada. Fechado, o cliente agenda para o próximo horário.</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-gray-900 ring-1 ring-black/[0.06]">
            <span className={`h-2 w-2 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {status.text}
          </p>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-black/[0.06] bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          {dirty && (
            <button type="button" onClick={() => { const b = JSON.parse(baseline); setWeekly(b.w); setSpecials(b.s) }} className="flex-1 rounded-xl px-4 py-2 text-sm text-gray-600 ring-1 ring-black/[0.08] sm:flex-none">
              Descartar
            </button>
          )}
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={!dirty || hasErrors || saveMut.isPending}
            className="flex-1 rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 sm:flex-none"
          >
            {saveMut.isPending ? 'Salvando…' : saved ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </div>

      {saveMut.isError && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {getApiErrorMessage(saveMut.error, 'Não foi possível salvar o horário.')}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Semana</h3>
            <ul className="mt-2 divide-y divide-black/[0.05]">
              {ORDER.map((d) => {
                const day = weekly[d] ?? { enabled: false, windows: [] }
                const err = dayErrors[d]
                return (
                  <li key={d} className="py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="flex w-36 shrink-0 items-center gap-3">
                        <Switch checked={day.enabled} onChange={(on) => toggleDay(d, on)} aria-label={`Entrega na ${DAY_LOWER[d]}`} />
                        <span className={`text-sm ${day.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {DAY[d]}
                          {nowParts().weekday === d && <span className="ml-1.5 text-[11px] text-gray-400">hoje</span>}
                        </span>
                      </label>
                      {day.enabled ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          {day.windows.map((w, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-xl bg-gray-50 p-1">
                              <input type="time" value={w.start} onChange={(e) => setWindow(d, i, { start: e.target.value })} className={timeInput} aria-label={`Início ${i + 1} de ${DAY_LOWER[d]}`} />
                              <span className="text-xs text-gray-400">às</span>
                              <input type="time" value={w.end} onChange={(e) => setWindow(d, i, { end: e.target.value })} className={timeInput} aria-label={`Fim ${i + 1} de ${DAY_LOWER[d]}`} />
                              <button type="button" onClick={() => setDay(d, { windows: day.windows.filter((_, j) => j !== i) })} className="rounded-lg p-1 text-gray-400 hover:text-gray-900" aria-label="Tirar este intervalo">
                                <X size={14} />
                              </button>
                            </span>
                          ))}
                          <button type="button" onClick={() => addWindow(d)} className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs text-gray-600 ring-1 ring-black/[0.08] hover:text-gray-900">
                            <Plus size={13} /> intervalo
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Sem entrega</span>
                      )}
                    </div>
                    {err && <p className="mt-1.5 text-xs text-rose-700 sm:pl-[9.5rem]">{err}</p>}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Feriados e datas especiais</h3>
                <p className="mt-1 text-xs text-gray-500">Nesses dias vale o que estiver aqui, não a semana. O recado aparece no topo do site. Datas que já passaram saem sozinhas.</p>
              </div>
              <button
                type="button"
                onClick={() => setSpecials((prev) => [...prev, ...suggestedHolidays().filter((s) => s.date >= todayIso && !prev.some((d) => d.date === s.date))])}
                className="rounded-xl px-3 py-1.5 text-xs text-gray-600 ring-1 ring-black/[0.08] hover:text-gray-900"
              >
                Sugerir Natal e Ano Novo
              </button>
            </div>
            {specials.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Nenhuma data cadastrada: vale a semana todos os dias.</p>
            ) : (
              <ul className="mt-2 divide-y divide-black/[0.05]">
                {specials.map((d, i) => (
                  <li key={i} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="date" value={d.date} min={todayIso} onChange={(e) => setSpecial(i, { date: e.target.value })} className={`${timeInput} w-36`} aria-label="Data" />
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-xs">
                        {[
                          { closed: true, label: 'Fechado' },
                          { closed: false, label: 'Horário especial' },
                        ].map((o) => (
                          <button
                            key={o.label}
                            type="button"
                            onClick={() => setSpecial(i, o.closed ? { closed: true, windows: undefined } : { closed: false, windows: d.windows?.length ? d.windows : [{ start: '07:00', end: '14:00' }] })}
                            className={`rounded-lg px-2.5 py-1 ${Boolean(d.closed) === o.closed ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      {!d.closed && (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-gray-50 p-1">
                          <input type="time" value={d.windows?.[0]?.start ?? ''} onChange={(e) => setSpecial(i, { windows: [{ start: e.target.value, end: d.windows?.[0]?.end ?? '' }] })} className={timeInput} aria-label="Início" />
                          <span className="text-xs text-gray-400">às</span>
                          <input type="time" value={d.windows?.[0]?.end ?? ''} onChange={(e) => setSpecial(i, { windows: [{ start: d.windows?.[0]?.start ?? '', end: e.target.value }] })} className={timeInput} aria-label="Fim" />
                        </span>
                      )}
                      <input
                        type="text"
                        value={d.note ?? ''}
                        maxLength={120}
                        onChange={(e) => setSpecial(i, { note: e.target.value })}
                        placeholder="Recado no topo do site (ex.: Natal: fechado)"
                        className="h-8 min-w-[12rem] flex-1 rounded-lg border border-black/[0.08] px-2 text-sm focus:border-gray-900 focus:outline-none"
                      />
                      <button type="button" onClick={() => setSpecials((prev) => prev.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-900" aria-label="Tirar esta data">
                        <X size={15} />
                      </button>
                    </div>
                    {specialErrors[i] && <p className="mt-1.5 text-xs text-rose-700">{specialErrors[i]}</p>}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setSpecials((prev) => [...prev, { date: '', closed: true, note: '' }])} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900">
              <Plus size={13} /> adicionar data
            </button>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Como o cliente vê</h3>
            <ul className="mt-2 divide-y divide-black/[0.05] text-sm">
              {preview.map((day) => (
                <li key={day.iso} className="flex items-start justify-between gap-3 py-2">
                  <span className="text-gray-900">{day.label}</span>
                  <span className="text-right">
                    <span className={`tabular-nums ${day.hours === 'Sem entrega' ? 'text-gray-400' : 'text-gray-700'}`}>{day.hours}</span>
                    {day.note && (
                      <span className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {day.note}
                      </span>
                    )}
                    {day.special && !day.note && <span className="block text-xs text-gray-400">data especial</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {!heatError && (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Pedidos por dia e hora · 90 dias</h3>
              {!heat ? (
                <div className="mt-3 h-40 animate-pulse rounded-xl bg-gray-50" />
              ) : (
                <>
                  <p className="mt-1 text-xs text-gray-500">
                    {totalOrders === 0
                      ? 'Nenhum pedido no período.'
                      : outside > 0
                        ? `${outside} de ${totalOrders} pedido(s) chegaram em hora sem entrega na semana atual. Se acontecer com frequência, vale abrir esse horário.`
                        : `${totalOrders} pedido(s), todos dentro do horário de entrega.`}
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-separate border-spacing-[2px] text-[10px]">
                      <thead>
                        <tr>
                          <th />
                          {HEAT_HOURS.map((h) => (
                            <th key={h} className="font-normal tabular-nums text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ORDER.map((d) => (
                          <tr key={d}>
                            <td className="pr-1 text-gray-500">{DAY_SHORT[d]}</td>
                            {HEAT_HOURS.map((h) => {
                              const n = countAt(d, h)
                              const open = openAt(d, h)
                              return (
                                <td
                                  key={h}
                                  title={`${DAY_SHORT[d]} ${h}h: ${open ? 'com entrega' : 'sem entrega'} · ${n} pedido(s)`}
                                  className={`h-6 min-w-[16px] rounded text-center tabular-nums ${open ? 'bg-emerald-50' : 'bg-gray-100'} ${n ? (open ? 'font-medium text-[#5D082A]' : 'font-medium text-amber-700 ring-1 ring-inset ring-amber-400') : ''}`}
                                >
                                  {n || ''}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-50 ring-1 ring-inset ring-black/[0.06]" /> com entrega</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-100" /> sem entrega</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-1 ring-inset ring-amber-400" /> pedido fora do horário</span>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
