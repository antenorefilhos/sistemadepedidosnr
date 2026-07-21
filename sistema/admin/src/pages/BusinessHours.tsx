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
  0: { enabled: true, windows: [{ start: '09:00', end: '13:00' }] },
  1: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  2: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  3: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  4: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  5: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '21:00' }] },
  6: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
}

export default function BusinessHours() {
  const qc = useQueryClient()
  const [weekly, setWeekly] = useState<WeeklyConfig>(DEFAULT_HOURS)
  const [openMessage, setOpenMessage] = useState('Fazemos entregas agora! 🛵')
  const [closedMessage, setClosedMessage] = useState('Estamos fechados no momento.')
  const [countdownLabel, setCountdownLabel] = useState('Abrimos em')
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
    if (brand.openMessage) setOpenMessage(brand.openMessage)
    if (brand.closedMessage) setClosedMessage(brand.closedMessage)
    if (brand.countdownLabel) setCountdownLabel(brand.countdownLabel)
  }, [brand])

  const saveMut = useMutation({
    mutationFn: () =>
      brandAPI.update({
        businessHours: JSON.stringify(weekly),
        openMessage,
        closedMessage,
        countdownLabel,
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
        <h1 className="text-2xl font-bold text-gray-800">Horários de Funcionamento</h1>
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

      {/* Mensagens */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-700">Mensagens personalizadas</h2>

        <div>
          <Label className="mb-1 block text-xs text-gray-600">Mensagem quando aberto</Label>
          <Input
            type="text"
            value={openMessage}
            onChange={(e) => setOpenMessage(e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs text-gray-600">Mensagem quando fechado</Label>
          <Input
            type="text"
            value={closedMessage}
            onChange={(e) => setClosedMessage(e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs text-gray-600">Rótulo do countdown</Label>
          <Input
            type="text"
            value={countdownLabel}
            onChange={(e) => setCountdownLabel(e.target.value)}
            placeholder="Ex: Abrimos em"
          />
          <p className="text-xs text-gray-400 mt-0.5">Exibido antes do contador regressivo no storefront.</p>
        </div>
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
          onClick={() => { setWeekly(DEFAULT_HOURS); setOpenMessage('Fazemos entregas agora! 🛵'); setClosedMessage('Estamos fechados no momento.'); setCountdownLabel('Abrimos em') }}
        >
          <RotateCcw size={14} />
          Restaurar padrão
        </Button>
      </div>
    </div>
  )
}
