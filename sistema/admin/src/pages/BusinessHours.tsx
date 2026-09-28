import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { brandAPI } from '../services/api'
import { Clock, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DAYS: { index: number; label: string; short: string }[] = [
  { index: 1, label: 'Segunda-feira', short: 'Seg' },
  { index: 2, label: 'Terça-feira', short: 'Ter' },
  { index: 3, label: 'Quarta-feira', short: 'Qua' },
  { index: 4, label: 'Quinta-feira', short: 'Qui' },
  { index: 5, label: 'Sexta-feira', short: 'Sex' },
  { index: 6, label: 'Sábado', short: 'Sáb' },
  { index: 0, label: 'Domingo', short: 'Dom' },
]

type Window = { start: string; end: string }
type DayConfig = { enabled: boolean; windows: Window[] }
type WeeklyConfig = Record<number, DayConfig>

const DEFAULT_HOURS: WeeklyConfig = {
  0: { enabled: true, windows: [{ start: '07:00', end: '13:45' }] },
  1: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  2: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  3: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  4: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  5: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
  6: { enabled: true, windows: [{ start: '07:00', end: '14:00' }, { start: '14:30', end: '20:50' }] },
}

/** Feriado ou horario reduzido: vence a semana naquele dia (site e checkout). */
type SpecialDate = { date: string; closed?: boolean; windows?: Window[]; note?: string }

// Sugestao: o que o horario antigo (embutido no site) ja tratava.
const SUGGESTED_DATES: SpecialDate[] = [
  { date: '2026-12-24', windows: [{ start: '07:00', end: '16:00' }], note: 'Véspera de Natal: até 16h' },
  { date: '2026-12-25', closed: true, note: 'Natal: fechado' },
  { date: '2026-12-31', windows: [{ start: '07:00', end: '15:00' }], note: 'Véspera de Ano Novo: até 15h' },
  { date: '2027-01-01', closed: true, note: 'Ano Novo: fechado' },
]

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
const hourLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

/** Proximos 7 dias como o cliente vai ver (semana + datas especiais). */
function nextDaysPreview(weekly: WeeklyConfig, specialDates: SpecialDate[]) {
  const start = todayIso()
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
    const special = specialDates.find((d) => d.date === date)
    const windows = special?.closed ? [] : special?.windows?.length ? special.windows : weekly[weekday]?.enabled ? weekly[weekday].windows : []
    const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${WEEKDAY_SHORT[weekday]} ${date.slice(8)}/${date.slice(5, 7)}`
    return {
      label,
      hours: windows.length ? windows.map((w) => `${hourLabel(w.start)}–${hourLabel(w.end)}`).join(' · ') : 'Fechado',
      note: special?.note || null,
    }
  })
}

export default function BusinessHours() {
  const qc = useQueryClient()
  const [weekly, setWeekly] = useState<WeeklyConfig>(DEFAULT_HOURS)
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([])
  const [saved, setSaved] = useState(false)

  const { data: brand } = useQuery({
    queryKey: ['brand'],
    queryFn: async () => (await brandAPI.get()).data,
  })

  // Carregar dados do backend quando disponível
  useEffect(() => {
    if (!brand) return
    if (brand.businessHours) {
      try { setWeekly(JSON.parse(brand.businessHours)) } catch { /* keep default */ }
    }
    if (brand.specialDates) {
      try { setSpecialDates(JSON.parse(brand.specialDates)) } catch { /* keep empty */ }
    }
  }, [brand])

  const saveMut = useMutation({
    mutationFn: () =>
      brandAPI.update({
        businessHours: JSON.stringify(weekly),
        specialDates: JSON.stringify([...specialDates].filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date))),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const setDay = (index: number, patch: Partial<DayConfig>) => {
    setWeekly((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }))
  }

  const setWindow = (dayIndex: number, winIndex: number, patch: Partial<Window>) => {
    setWeekly((prev) => {
      const windows = [...prev[dayIndex].windows]
      windows[winIndex] = { ...windows[winIndex], ...patch }
      return { ...prev, [dayIndex]: { ...prev[dayIndex], windows } }
    })
  }

  const addWindow = (dayIndex: number) => {
    setWeekly((prev) => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        windows: [...prev[dayIndex].windows, { start: '08:00', end: '12:00' }],
      },
    }))
  }

  const removeWindow = (dayIndex: number, winIndex: number) => {
    setWeekly((prev) => {
      const windows = prev[dayIndex].windows.filter((_, i) => i !== winIndex)
      return { ...prev, [dayIndex]: { ...prev[dayIndex], windows } }
    })
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Horário de entrega</h1>
      </div>

      {/* Dias da semana */}
      <div className="space-y-3 mb-8">
        {DAYS.map(({ index, label }) => {
          const day = weekly[index] ?? { enabled: false, windows: [] }
          return (
            <div key={index} className={`bg-white border rounded-lg p-4 transition-opacity ${day.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-3">
                <Label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={day.enabled}
                    onChange={(e) => setDay(index, { enabled: e.target.checked })}
                  />
                  <span className="font-semibold text-gray-800">{label}</span>
                </Label>
                {day.enabled && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => addWindow(index)}
                    className="ml-auto h-auto px-0 py-0 text-xs"
                  >
                    + janela
                  </Button>
                )}
              </div>

              {day.enabled && (
                <div className="space-y-2 pl-6">
                  {day.windows.map((win, wi) => (
                    <div key={wi} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={win.start}
                        onChange={(e) => setWindow(index, wi, { start: e.target.value })}
                        className="h-8 w-28 font-mono"
                      />
                      <span className="text-gray-400 text-sm">até</span>
                      <Input
                        type="time"
                        value={win.end}
                        onChange={(e) => setWindow(index, wi, { end: e.target.value })}
                        className="h-8 w-28 font-mono"
                      />
                      {day.windows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWindow(index, wi)}
                          className="ml-1 h-8 w-8 text-gray-300 hover:text-red-500"
                          title="Remover janela"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  {day.windows.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhuma janela — dia marcado como aberto mas sem horário</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Datas especiais */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-700">Feriados e datas especiais</h2>
            <p className="text-xs text-gray-500">Nesses dias vale o que estiver aqui, não o horário da semana. O recado aparece no topo do site.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSpecialDates((prev) => [...prev, ...SUGGESTED_DATES.filter((s) => !prev.some((d) => d.date === s.date))])}
          >
            Sugerir Natal e Ano Novo
          </Button>
        </div>

        {specialDates.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma data cadastrada.</p>}

        {specialDates.map((d, i) => {
          const update = (patch: Partial<SpecialDate>) =>
            setSpecialDates((prev) => prev.map((item, j) => (j === i ? { ...item, ...patch } : item)))
          const past = d.date && d.date < todayIso()
          return (
            <div key={i} className={`flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2 ${past ? 'opacity-50' : ''}`}>
              <Input type="date" value={d.date} onChange={(e) => update({ date: e.target.value })} className="h-8 w-40" />
              <select
                value={d.closed ? 'closed' : 'reduced'}
                onChange={(e) =>
                  update(e.target.value === 'closed'
                    ? { closed: true, windows: undefined }
                    : { closed: false, windows: d.windows?.length ? d.windows : [{ start: '07:00', end: '14:00' }] })}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                <option value="closed">Fechado</option>
                <option value="reduced">Horário especial</option>
              </select>
              {!d.closed && (
                <>
                  <Input type="time" value={d.windows?.[0]?.start ?? '07:00'} onChange={(e) => update({ windows: [{ start: e.target.value, end: d.windows?.[0]?.end ?? '14:00' }] })} className="h-8 w-28 font-mono" />
                  <span className="text-gray-400 text-sm">até</span>
                  <Input type="time" value={d.windows?.[0]?.end ?? '14:00'} onChange={(e) => update({ windows: [{ start: d.windows?.[0]?.start ?? '07:00', end: e.target.value }] })} className="h-8 w-28 font-mono" />
                </>
              )}
              <Input
                type="text"
                value={d.note ?? ''}
                onChange={(e) => update({ note: e.target.value })}
                placeholder="Recado (ex.: Natal: fechado)"
                className="h-8 min-w-[180px] flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSpecialDates((prev) => prev.filter((_, j) => j !== i))}
                className="h-8 w-8 text-gray-300 hover:text-red-500"
                title="Remover data"
              >
                ✕
              </Button>
            </div>
          )
        })}

        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setSpecialDates((prev) => [...prev, { date: '', closed: true, note: '' }])}
          className="h-auto px-0 py-0 text-xs"
        >
          + adicionar data
        </Button>
      </div>

      {/* Previa */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-700 mb-1">Próximos 7 dias</h2>
        <p className="text-xs text-gray-500 mb-3">
          É o que o site e o checkout vão usar. O topo do site mostra, por exemplo, "Entregamos hoje até 20h50", "Últimos 35 min para pedir", "Voltamos às 14h30" ou "Fechado agora · abrimos amanhã às 7h". Com a loja fechada, o cliente agenda em vez de pedir para agora.
        </p>
        <ul className="divide-y divide-gray-100 text-sm">
          {nextDaysPreview(weekly, specialDates).map((day) => (
            <li key={day.label} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="font-semibold text-gray-700">{day.label}</span>
              <span className={day.hours === 'Fechado' ? 'text-red-600' : 'text-gray-600'}>
                {day.hours}
                {day.note && <span className="ml-2 text-xs text-amber-700">· {day.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          <Save size={15} />
          {saveMut.isPending ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setWeekly(DEFAULT_HOURS)}
        >
          <RotateCcw size={14} />
          Restaurar semana padrão
        </Button>
      </div>
    </div>
  )
}
