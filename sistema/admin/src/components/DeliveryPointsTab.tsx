import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { WorkspaceDialog } from './WorkspaceDialog'
import { deliveryAPI, getApiErrorMessage, type DeliveryPoint } from '../services/api'

// Tabela de frete por localidade (30/09/2026). E o que o cliente paga quando
// digita o CEP -- antes vivia num arquivo fixo no codigo, e as "zonas" desta
// tela nunca valiam (a planilha tinha prioridade). Mudou aqui, vale na hora.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const cepMask = (v: string | null) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v || '')
const parseMoney = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')))

export function DeliveryPointsTab() {
  const qc = useQueryClient()
  const { data: points = [], isLoading } = useQuery({ queryKey: ['delivery-points'], queryFn: () => deliveryAPI.listPoints().then((r) => r.data) })
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<DeliveryPoint | 'new' | null>(null)
  const [error, setError] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: ['delivery-points'] })

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof deliveryAPI.updatePoint>[1] }) => deliveryAPI.updatePoint(id, data),
    onSuccess: () => {
      setError('')
      refresh()
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Não foi possível salvar.')),
  })
  const applyAll = useMutation({
    mutationFn: () => deliveryAPI.applyAllSuggestions(),
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e, 'Não foi possível aplicar.')),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deliveryAPI.deletePoint(id),
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e, 'Não foi possível apagar.')),
  })

  const q = query.trim().toLowerCase().replace(/\D/g, '') || query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? points.filter((p) => p.locality.toLowerCase().includes(query.trim().toLowerCase()) || (p.cep || '').includes(q)) : points),
    [points, q, query],
  )
  const groups = useMemo(() => {
    const map = new Map<string, DeliveryPoint[]>()
    for (const p of filtered) map.set(p.cep || '', [...(map.get(p.cep || '') || []), p])
    return [...map.entries()].sort(([a], [b]) => (a || '99999999').localeCompare(b || '99999999'))
  }, [filtered])
  const pending = points.filter((p) => p.suggestedFee != null)
  const withCep = points.filter((p) => p.cep && p.active)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        É o que o cliente paga quando digita o CEP. Quando mais de uma localidade divide o CEP, o site pede para ele escolher. Mudou aqui, vale na hora.
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-medium text-amber-900">{pending.length} localidade(s) com a taxa que vocês digitaram em 24/09 e que nunca foi aplicada</p>
          <p className="mt-1 text-xs text-amber-800">
            A tela antiga salvava, mas o site cobrava pela planilha fixa. O valor de 24/09 aparece ao lado de cada uma: aplique uma a uma ou todas.
          </p>
          <button
            type="button"
            disabled={applyAll.isPending}
            onClick={() => window.confirm(`Aplicar as ${pending.length} taxas de 24/09? O cliente passa a pagar esses valores na hora.`) && applyAll.mutate()}
            className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Aplicar todas
          </button>
        </section>
      )}

      <Simulator />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar localidade ou CEP" className="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-3 text-sm" />
        </div>
        <span className="text-xs text-gray-500">{withCep.length} localidade(s) no ar</span>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white">
          <Plus size={15} /> Nova localidade
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <div className="space-y-3">
          {groups.map(([cep, list]) => (
            <section key={cep || 'sem'} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/[0.05] px-4 py-2">
                <span className="text-sm font-medium text-gray-900">{cep ? `CEP ${cepMask(cep)}` : 'Sem CEP'}</span>
                <span className="text-xs text-gray-500">
                  {cep ? (list.length > 1 ? `${list.length} localidades: o cliente escolhe a dele` : 'uma localidade: cobra direto') : 'não entram no cálculo até ter CEP'}
                </span>
              </div>
              <ul className="divide-y divide-black/[0.05]">
                {list.map((p) => (
                  <Row
                    key={p.id}
                    p={p}
                    busy={patch.isPending}
                    onSave={(data) => patch.mutate({ id: p.id, data })}
                    onEdit={() => setEditing(p)}
                    onDelete={() => window.confirm(`Apagar "${p.locality}"? Quem digitar esse CEP deixa de ver essa opção.`) && remove.mutate(p.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-500">Nada encontrado.</p>}
        </div>
      )}

      {editing && (
        <PointEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Row({
  p,
  busy,
  onSave,
  onEdit,
  onDelete,
}: {
  p: DeliveryPoint
  busy: boolean
  onSave: (data: Parameters<typeof deliveryAPI.updatePoint>[1]) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [fee, setFee] = useState(String(p.fee).replace('.', ','))
  const [free, setFree] = useState(p.freeAbove == null ? '' : String(p.freeAbove).replace('.', ','))
  const commitFee = () => {
    const v = parseMoney(fee)
    if (v == null || !Number.isFinite(v) || v < 0) return setFee(String(p.fee).replace('.', ','))
    if (v !== p.fee) onSave({ fee: v })
  }
  const commitFree = () => {
    const v = parseMoney(free)
    if (v != null && (!Number.isFinite(v) || v <= 0)) return setFree(p.freeAbove == null ? '' : String(p.freeAbove))
    if (v !== p.freeAbove) onSave({ freeAbove: v })
  }
  const input = 'h-9 w-24 rounded-lg border border-black/[0.08] px-2 text-right text-sm tabular-nums'
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center ${p.active ? '' : 'opacity-60'}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-gray-900">{p.locality}</span>
        <span className="block text-xs text-gray-500">
          {[p.minutes != null && `${p.minutes} min`, p.km != null && `${String(p.km).replace('.', ',')} km`, p.reference].filter(Boolean).join(' · ') || '—'}
        </span>
        {p.suggestedFee != null && (
          <span className="mt-1 inline-flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Digitado em 24/09: {brl(p.suggestedFee)}
            <button type="button" disabled={busy} onClick={() => onSave({ applySuggestion: true })} className="font-medium underline">
              Aplicar
            </button>
            <button type="button" disabled={busy} onClick={() => onSave({ dismissSuggestion: true })} className="underline">
              Descartar
            </button>
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Taxa R$
          <input value={fee} inputMode="decimal" onChange={(e) => setFee(e.target.value)} onBlur={commitFee} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={input} aria-label={`Taxa de ${p.locality}`} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Grátis acima de
          <input value={free} inputMode="decimal" placeholder="—" onChange={(e) => setFree(e.target.value)} onBlur={commitFree} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={input} aria-label={`Frete grátis acima de, em ${p.locality}`} />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={p.active}
          aria-label={`${p.locality}: ${p.active ? 'entrega ativa' : 'desligada'}`}
          disabled={busy}
          onClick={() => onSave({ active: !p.active })}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${p.active ? 'bg-gray-900' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.active ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
        <button type="button" aria-label="Editar" title="Editar" onClick={onEdit} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
          <Pencil size={15} />
        </button>
        <button type="button" aria-label="Apagar" title="Apagar" onClick={onDelete} className="rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-700">
          <Trash2 size={15} />
        </button>
      </span>
    </li>
  )
}

/** Mesmo calculo do checkout: CEP (+ subtotal) -> taxa, localidades e frete gratis. */
function Simulator() {
  const [cep, setCep] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [result, setResult] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const run = async () => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return setResult(['Digite um CEP com 8 números.'])
    setLoading(true)
    try {
      const { data } = await deliveryAPI.testZone({ cep: digits, subtotal: parseMoney(subtotal) ?? undefined })
      const c = data.calculation
      if (c.outOfArea) setResult(['Fora da área de entrega: o site não aceita esse CEP.'])
      else if (c.requiresLocalitySelection)
        setResult([
          'O cliente escolhe a localidade:',
          ...(c.availableLocalities || []).map((l: { name: string; fee: number }) => `${l.name}: ${brl(l.fee)}`),
        ])
      else setResult([`${c.zoneName}: ${c.isFree ? `grátis (taxa ${brl(c.rawFee)}, subtotal passou do mínimo)` : brl(c.fee)}`])
    } catch (e) {
      setResult([getApiErrorMessage(e, 'Não foi possível calcular.')])
    } finally {
      setLoading(false)
    }
  }
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Simular como o cliente</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="CEP" inputMode="numeric" className="h-10 w-36 rounded-xl border border-black/[0.08] px-3 text-sm" />
        <input value={subtotal} onChange={(e) => setSubtotal(e.target.value)} placeholder="Subtotal (opcional)" inputMode="decimal" className="h-10 w-44 rounded-xl border border-black/[0.08] px-3 text-sm" />
        <button type="button" onClick={run} disabled={loading} className="rounded-xl border border-black/[0.08] px-4 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          Calcular
        </button>
      </div>
      {result && (
        <ul className="mt-2 space-y-0.5 text-sm text-gray-800">
          {result.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PointEditor({ initial, onClose, onSaved }: { initial: DeliveryPoint | null; onClose: () => void; onSaved: () => void }) {
  const [locality, setLocality] = useState(initial?.locality || '')
  const [cep, setCep] = useState(cepMask(initial?.cep || ''))
  const [fee, setFee] = useState(initial ? String(initial.fee).replace('.', ',') : '')
  const [free, setFree] = useState(initial?.freeAbove == null ? '' : String(initial.freeAbove).replace('.', ','))
  const [minutes, setMinutes] = useState(initial?.minutes == null ? '' : String(initial.minutes))
  const [reference, setReference] = useState(initial?.reference || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cepDigits = cep.replace(/\D/g, '')
  const feeNum = parseMoney(fee)
  const problems = [!locality.trim() && 'nome', cepDigits && cepDigits.length !== 8 && 'CEP com 8 números', (feeNum == null || feeNum < 0) && 'taxa'].filter(Boolean) as string[]

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    setError('')
    const data = {
      locality: locality.trim(),
      cep: cepDigits || null,
      fee: feeNum as number,
      freeAbove: parseMoney(free),
      minutes: minutes.trim() ? Number(minutes) : null,
      reference: reference.trim() || null,
    }
    try {
      if (initial) await deliveryAPI.updatePoint(initial.id, data)
      else await deliveryAPI.createPoint({ ...data, active: true })
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const field = 'mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm'
  return (
    <WorkspaceDialog
      label={initial ? `Localidade ${initial.locality}` : 'Nova localidade'}
      size="lg"
      onClose={onClose}
      closeOnEsc={!saving}
      title={<h3 className="text-base font-semibold text-gray-900">{initial ? initial.locality : 'Nova localidade'}</h3>}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-500">{error ? <span className="text-rose-700">{error}</span> : problems.length ? `Falta: ${problems.join(', ')}.` : ''}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className="rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
            {saving ? 'Salvando…' : initial ? 'Salvar' : 'Criar'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-4">
          <label className="block text-xs text-gray-500">
            <span className="font-medium text-gray-700">Localidade</span> — o nome que o cliente vê para escolher
            <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Ex.: Condomínio Vale do Barão" className={field} />
          </label>
          <label className="block text-xs text-gray-500">
            <span className="font-medium text-gray-700">CEP</span> — várias localidades podem dividir o mesmo CEP
            <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="25750-222" inputMode="numeric" className={field} />
          </label>
          <label className="block text-xs text-gray-500">
            <span className="font-medium text-gray-700">Referência</span> (opcional) — ajuda o entregador
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: Estr. União e Indústria, 21900" className={field} />
          </label>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-gray-500">
              <span className="font-medium text-gray-700">Taxa (R$)</span>
              <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="block text-xs text-gray-500">
              <span className="font-medium text-gray-700">Grátis acima de</span> (opcional)
              <input value={free} onChange={(e) => setFree(e.target.value)} inputMode="decimal" placeholder="sem regra" className={field} />
            </label>
          </div>
          <label className="block text-xs text-gray-500">
            <span className="font-medium text-gray-700">Tempo até lá (min)</span> (opcional)
            <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${field} sm:w-40`} />
          </label>
          <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            “Grátis acima de” vale só para esta localidade e passa na frente do valor geral de frete grátis da loja. Vazio: segue a regra geral.
          </p>
        </div>
      </div>
    </WorkspaceDialog>
  )
}
