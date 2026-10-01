import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { brandAPI, couponsAdminAPI, deliveryAPI, getApiErrorMessage, type DeliveryPoint, type DeliveryZone } from '../services/api'
import { DeliveryPointsTab } from '../components/DeliveryPointsTab'
import { DeliveryAreasTab } from '../components/DeliveryAreasTab'
import type { Tab } from '../utils/deliveryZonesHelpers'

// Taxas de Entrega (refeita em 01/10/2026). Tres abas: a tabela de frete (o
// que o cliente paga pelo CEP), as areas desenhadas no mapa e as regras de
// frete gratis. As janelas com capacidade sairam (nunca usadas; quem decide o
// horario e a tela Horario de entrega).

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'points', label: 'Tabela de frete' },
  { key: 'zones', label: 'Áreas no mapa' },
  { key: 'rules', label: 'Regras' },
]
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const parseMoney = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')))
const isComplete = (z: DeliveryZone) => (z.type === 'GEO_POLYGON' ? Boolean(z.polygonGeoJSON) : Boolean(z.cepStart && z.cepEnd))

export default function DeliveryZones({ onNavigate }: { onNavigate: (section: 'coupons') => void }) {
  const [tab, setTab] = useState<Tab>('points')
  const { data: zones = [] } = useQuery({ queryKey: ['delivery-zones'], queryFn: async () => (await deliveryAPI.listZones()).data })
  const { data: points = [], isLoading } = useQuery({ queryKey: ['delivery-points'], queryFn: () => deliveryAPI.listPoints().then((r) => r.data) })

  const activePoints = points.filter((p) => p.active && p.cep).length
  const activeAreas = zones.filter((z) => z.active && z.type === 'GEO_POLYGON' && isComplete(z)).length
  const activeRanges = zones.filter((z) => z.active && z.type === 'CEP_RANGE' && isComplete(z)).length
  const incomplete = zones.filter((z) => z.active && !isComplete(z))
  const none = !isLoading && activePoints + activeAreas + activeRanges === 0

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {none ? (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> Nenhuma localidade nem área ligada: o site não aceita nenhum endereço para entrega.
        </p>
      ) : (
        !isLoading && (
          <p className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-gray-900 ring-1 ring-black/[0.06]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Entregando em {activePoints} localidade(s) da tabela
            {activeAreas > 0 && ` e ${activeAreas} área(s) no mapa`}
            {activeRanges > 0 && `, com ${activeRanges} faixa(s) de CEP de reserva`}
          </p>
        )
      )}
      {incomplete.length > 0 && (
        <p className="flex gap-2 text-xs text-gray-600">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          {incomplete.map((z) => z.name).join(', ')}: ligada(s) sem área definida, nunca casa(m) com endereço nenhum.
        </p>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 text-sm sm:inline-grid sm:w-auto">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 sm:px-4 ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'points' && <DeliveryPointsTab />}
      {tab === 'zones' && <DeliveryAreasTab />}
      {tab === 'rules' && <RulesTab zones={zones} points={points} counts={{ activeAreas, activePoints, activeRanges }} onNavigate={onNavigate} />}
    </div>
  )
}

function RulesTab({
  zones,
  points,
  counts,
  onNavigate,
}: {
  zones: DeliveryZone[]
  points: DeliveryPoint[]
  counts: { activeAreas: number; activePoints: number; activeRanges: number }
  onNavigate: (section: 'coupons') => void
}) {
  const qc = useQueryClient()
  const { data: brand } = useQuery({ queryKey: ['brand'], queryFn: async () => (await brandAPI.get()).data })
  const { data: promos = [] } = useQuery({ queryKey: ['admin-coupons'], queryFn: async () => (await couponsAdminAPI.list()).data })
  const saved = brand?.freeShippingThreshold == null ? null : Number(brand.freeShippingThreshold)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const text = draft ?? (saved == null ? '' : String(saved).replace('.', ','))
  const value = parseMoney(text)
  const invalid = value != null && (!Number.isFinite(value) || value < 0)
  const dirty = draft != null && value !== saved
  const ownPoints = points.filter((p) => p.active && p.freeAbove != null).length
  const ownAreas = zones.filter((z) => z.active && z.freeAbove != null).length
  const usingGlobal = points.filter((p) => p.active && p.freeAbove == null).length + zones.filter((z) => z.active && z.freeAbove == null).length

  const save = async () => {
    if (invalid || !dirty) return
    setSaving(true)
    setError('')
    try {
      await brandAPI.update({ freeShippingThreshold: value })
      await qc.invalidateQueries({ queryKey: ['brand'] })
      qc.invalidateQueries({ queryKey: ['brand-config'] })
      setDraft(null)
      setOk(true)
      setTimeout(() => setOk(false), 2500)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const now = Date.now()
  const freeCoupons = promos
    .filter((p) => p.status === 'ACTIVE' && new Date(p.endsAt).getTime() > now && p.rules.some((r) => r.effect?.type === 'FREE_SHIPPING'))
    .flatMap((p) =>
      p.coupons
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => {
          const condition = (p.rules.find((r) => r.effect?.type === 'FREE_SHIPPING')?.condition || {}) as { firstOrderOnly?: boolean; minSubtotal?: number }
          const parts = [
            c.maxUsesPerCustomer ? `${c.maxUsesPerCustomer} vez(es) por cliente` : 'sem limite por cliente',
            condition.firstOrderOnly ? 'só na primeira compra' : 'vale também para quem já comprou',
            condition.minSubtotal ? `a partir de ${brl(condition.minSubtotal)}` : null,
            `até ${new Date(p.endsAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
          ].filter(Boolean)
          return { id: c.id, code: c.code, detail: parts.join(' · '), uses: p.stats?.uses ?? 0 }
        }),
    )

  const steps = [
    { title: 'Localização do celular dentro de uma área do mapa', detail: `${counts.activeAreas} área(s) ligada(s). É a mais precisa e vence as outras.` },
    { title: 'CEP na tabela de frete', detail: `${counts.activePoints} localidade(s). Quando o CEP tem mais de uma, o cliente escolhe a dele.` },
    { title: 'CEP numa faixa de reserva', detail: `${counts.activeRanges} faixa(s) ligada(s). Só para CEP que não está na tabela.` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Como o frete é decidido</h3>
        <ol className="mt-3 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs tabular-nums text-gray-700">{i + 1}</span>
              <span className="text-sm">
                <span className="text-gray-900">{s.title}</span>
                <span className="block text-xs text-gray-500">{s.detail}</span>
              </span>
            </li>
          ))}
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs text-rose-700">×</span>
            <span className="text-sm text-gray-900">
              Nenhum dos três: fora da área
              <span className="block text-xs text-gray-500">O site não aceita o endereço para entrega; o cliente ainda pode retirar na loja.</span>
            </span>
          </li>
        </ol>
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Frete grátis por valor</h3>
          <p className="mt-1 text-xs text-gray-500">
            Entrega com subtotal a partir deste valor sai grátis, e o site mostra quanto falta. Localidade ou área com "grátis acima de" próprio vence esta regra.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">Acima de R$</span>
            <input
              value={text}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="decimal"
              placeholder="vazio = desligado"
              aria-label="Frete grátis acima de"
              className="h-10 w-36 rounded-xl border border-black/[0.08] px-3 text-sm tabular-nums focus:border-gray-900 focus:outline-none"
            />
            <button type="button" onClick={save} disabled={!dirty || invalid || saving} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {saving ? 'Salvando…' : ok ? 'Salvo' : 'Salvar'}
            </button>
            {dirty && (
              <button type="button" onClick={() => setDraft(null)} className="text-xs text-gray-500 underline">
                desfazer
              </button>
            )}
          </div>
          {invalid && <p className="mt-1.5 text-xs text-rose-700">Valor inválido.</p>}
          {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
          <p className="mt-3 text-xs text-gray-600">
            {saved == null ? 'Desligado hoje: ' : `Hoje: grátis acima de ${brl(saved)}. `}
            {ownPoints + ownAreas > 0 ? `${ownPoints} localidade(s) e ${ownAreas} área(s) têm valor próprio` : 'Nenhuma localidade ou área tem valor próprio'}
            {`; ${usingGlobal} seguem esta regra.`}
          </p>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Frete grátis por cupom</h3>
            <button type="button" onClick={() => onNavigate('coupons')} className="text-xs text-gray-600 underline">
              Abrir Cupons
            </button>
          </div>
          {freeCoupons.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Nenhum cupom de frete grátis ativo.</p>
          ) : (
            <ul className="mt-2 divide-y divide-black/[0.05]">
              {freeCoupons.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-gray-900">{c.code}</span>
                    <span className="block text-xs text-gray-500">{c.detail}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">{c.uses} uso(s)</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
