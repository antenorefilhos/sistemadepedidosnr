import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { overviewAPI, type AdminOverview, type CheckupLast, type OverviewPeriod } from '../../services/api'
import type { Section } from '../Dashboard'

// Painel inicial (refeito em 29/09/2026 com o Jonathan). Sobrio de proposito:
// so o que leva a uma decisao. Nada de cor gritando -- o acento da marca
// aparece nos graficos; verde/vermelho so nas variacoes, em tom baixo.

const ACCENT = '#5D082A'
const REFRESH_MS = 60_000

const PERIODS: Array<{ value: OverviewPeriod; label: string; compare: string }> = [
  { value: 'day', label: 'Hoje', compare: 'ontem até esta hora' },
  { value: 'week', label: '7 dias', compare: '7 dias anteriores' },
  { value: 'month', label: '30 dias', compare: '30 dias anteriores' },
]

const brl = (value: number, compact = false) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...(compact ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
  })
const int = (value: number) => value.toLocaleString('pt-BR')
const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const days = Math.floor(minutes / (24 * 60))
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

/** Variacao contra o periodo anterior. `inverse`: cair e bom (ex.: cancelamento). */
function Delta({ current, previous, inverse = false, percentPoints = false }: { current: number; previous: number; inverse?: boolean; percentPoints?: boolean }) {
  if (!previous && !current) return <span className="text-gray-400">sem movimento</span>
  if (!previous) return <span className="text-gray-400">sem base anterior</span>
  const diff = percentPoints ? current - previous : ((current - previous) / previous) * 100
  if (Math.abs(diff) < 0.5) return <span className="text-gray-400">estável</span>
  const good = inverse ? diff < 0 : diff > 0
  const sign = diff > 0 ? '+' : '−'
  const value = Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: percentPoints ? 1 : 0 })
  return <span className={good ? 'text-emerald-700' : 'text-rose-700'}>{`${sign}${value}${percentPoints ? ' p.p.' : '%'}`}</span>
}

function Panel({ title, aside, children, className = '' }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <header className="mb-4 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h2>}
          {aside && <div className="text-xs text-gray-400">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

function Kpi({ label, value, delta, note }: { label: string; value: string; delta?: ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-gray-900 tabular-nums">{value}</p>
      <p className="mt-2 text-xs tabular-nums">{delta}{note && <span className="text-gray-400"> {note}</span>}</p>
    </div>
  )
}

/** Barras de serie unica, com dica ao passar o mouse/tocar e tabela para leitor de tela. */
function Bars({ data, format, caption }: { data: Array<{ label: string; value: number; sub?: string }>; format: (v: number) => string; caption: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 0)
  const every = data.length > 24 ? 5 : data.length > 12 ? 3 : 1
  if (max === 0) return <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido no período.</p>
  return (
    <figure className="relative">
      <div className="flex h-40 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <button
            key={d.label + i}
            type="button"
            aria-label={`${d.label}: ${format(d.value)}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            className="group relative flex h-full flex-1 items-end focus:outline-none"
          >
            <span
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : '1px',
                background: d.value ? ACCENT : '#e5e7eb',
                opacity: hover === null || hover === i ? 0.85 : 0.35,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] text-[10px] text-gray-400">
        {data.map((d, i) => (
          <span key={d.label + i} className="flex-1 text-center tabular-nums">{i % every === 0 ? d.label : ''}</span>
        ))}
      </div>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <span className="text-gray-300">{data[hover].label}</span> · <span className="tabular-nums">{format(data[hover].value)}</span>
          {data[hover].sub && <span className="text-gray-300"> · {data[hover].sub}</span>}
        </div>
      )}
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><td>{d.label}</td><td>{format(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

function List({ items, empty }: { items: Array<{ key: string; main: string; side: string; sub?: string }>; empty: string }) {
  if (!items.length) return <p className="py-2 text-sm text-gray-400">{empty}</p>
  return (
    <ul className="divide-y divide-black/[0.05]">
      {items.map((it) => (
        <li key={it.key} className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm text-gray-800" title={it.main}>{it.main}</span>
            {it.sub && <span className="block text-xs text-gray-400">{it.sub}</span>}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-gray-600">{it.side}</span>
        </li>
      ))}
    </ul>
  )
}

export function DashboardSection({ onNavigate, onOpenOrder }: { onNavigate?: (section: Section) => void; onOpenOrder?: (orderId: string) => void }) {
  const [period, setPeriod] = useState<OverviewPeriod>('day')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkup, setCheckup] = useState<CheckupLast | null>(null)
  const [healthOpen, setHealthOpen] = useState(false)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestRef.current
    setLoading(true)
    try {
      const res = await overviewAPI.get(period)
      if (id === requestRef.current) {
        setData(res.data)
        setError(false)
      }
    } catch {
      if (id === requestRef.current) setError(true)
    } finally {
      if (id === requestRef.current) setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    overviewAPI.lastCheckup().then((res) => setCheckup(res.data)).catch(() => setCheckup(null))
  }, [])

  const compare = PERIODS.find((p) => p.value === period)!.compare
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const updatedAt = data ? new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const failures = checkup?.results.filter((r) => !r.ok) ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
      {/* Cabecalho + periodo (fixo no topo no celular, como app) */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-end justify-between gap-3 bg-gray-100/90 px-4 pb-3 pt-1 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
        <p className="text-sm capitalize text-gray-500">{today}</p>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Período" className="flex rounded-xl border border-black/[0.06] bg-white p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                role="tab"
                aria-selected={period === p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${period === p.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label="Atualizar" title={updatedAt ? `Atualizado às ${updatedAt}` : 'Atualizar'} className="rounded-xl border border-black/[0.06] bg-white p-2 text-gray-500 hover:text-gray-900">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && !data && (
        <Panel>
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <AlertCircle size={16} className="text-rose-700" /> Não foi possível carregar o painel.
            <button type="button" onClick={load} className="font-medium text-gray-900 underline underline-offset-2">Tentar de novo</button>
          </p>
        </Panel>
      )}

      {!data && !error && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/70" />)}
        </div>
      )}

      {data && (
        <>
          {/* 1. Agora */}
          <Panel title="Agora" aside={`${data.operation.active} em andamento · ${updatedAt}`}>
            <div className="grid grid-cols-5 gap-2">
              {data.operation.stages.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onNavigate?.('orders')}
                  className="rounded-xl bg-gray-50 px-2 py-3 text-center transition-colors hover:bg-gray-100"
                >
                  <span className={`block text-2xl font-semibold tabular-nums ${s.count ? 'text-gray-900' : 'text-gray-300'}`}>{s.count}</span>
                  <span className="mt-1 block truncate text-[11px] text-gray-500">{s.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              {data.operation.alerts.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-500"><Check size={16} className="text-emerald-700" /> Nenhum pedido parado.</p>
              ) : (
                <>
                  <p className="mb-1 text-xs text-gray-500">
                    {data.operation.alertCount} {data.operation.alertCount === 1 ? 'pedido precisa' : 'pedidos precisam'} de atenção
                  </p>
                  <ul className="divide-y divide-black/[0.05]">
                    {data.operation.alerts.map((a) => (
                      <li key={a.orderId}>
                        <button type="button" onClick={() => onOpenOrder?.(a.orderId)} className="group flex w-full items-center gap-3 py-2.5 text-left">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-gray-900">
                              <span className="font-mono text-xs text-gray-500">#{a.code}</span>
                              {a.customer && <span> · {a.customer}</span>}
                            </span>
                            <span className="block truncate text-xs text-gray-500">{a.message}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-gray-500">há {duration(a.minutes)}</span>
                          <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Panel>

          {/* 2. Resultado */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Kpi label="Faturamento" value={brl(data.results.current.revenue)} delta={<Delta current={data.results.current.revenue} previous={data.results.previous.revenue} />} note={`vs ${compare}`} />
            <Kpi label="Pedidos" value={int(data.results.current.orders)} delta={<Delta current={data.results.current.orders} previous={data.results.previous.orders} />} />
            <Kpi label="Ticket médio" value={brl(data.results.current.avgTicket)} delta={<Delta current={data.results.current.avgTicket} previous={data.results.previous.avgTicket} />} />
            <Kpi label="Cancelamentos" value={pct(data.results.current.cancelRate)} delta={<Delta current={data.results.current.cancelRate} previous={data.results.previous.cancelRate} inverse percentPoints />} />
            <Kpi
              label="Clientes"
              value={int(data.results.current.newCustomers + data.results.current.returningCustomers)}
              delta={<span className="text-gray-500">{data.results.current.newCustomers} novos · {data.results.current.returningCustomers} voltaram</span>}
            />
          </div>

          <div className={`grid gap-4 ${period === 'day' ? '' : 'lg:grid-cols-3'}`}>
            <Panel title={period === 'day' ? 'Faturamento por hora' : 'Faturamento por dia'} className={period === 'day' ? '' : 'lg:col-span-2'}>
              <Bars
                caption="Faturamento no período"
                data={data.results.series.map((s) => ({ label: s.label, value: s.revenue, sub: `${s.orders} ${s.orders === 1 ? 'pedido' : 'pedidos'}` }))}
                format={(v) => brl(v)}
              />
            </Panel>
            {period !== 'day' && (
              <Panel title="Pedidos por hora do dia">
                <Bars
                  caption="Pedidos por hora do dia"
                  data={data.results.ordersByHour.map((v, h) => ({ label: `${h}h`, value: v }))}
                  format={(v) => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`}
                />
              </Panel>
            )}
          </div>

          {/* 3. Site */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Funil do site" aside="robôs de busca excluídos">
              <p className="mb-4 text-sm text-gray-600">
                <span className="text-2xl font-semibold tabular-nums text-gray-900">{pct(data.site.conversion.current)}</span>
                <span className="ml-2">dos visitantes fizeram pedido</span>
                <span className="ml-2 text-xs"><Delta current={data.site.conversion.current} previous={data.site.conversion.previous} percentPoints /></span>
              </p>
              <ul className="space-y-2.5">
                {data.site.funnel.map((step, i) => {
                  const top = data.site.funnel[0].value || 1
                  const prev = i > 0 ? data.site.funnel[i - 1].value : 0
                  return (
                    <li key={step.key}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-gray-700">{step.label}</span>
                        <span className="tabular-nums text-gray-900">
                          {int(step.value)}
                          {i > 0 && <span className="ml-2 text-xs text-gray-400">{prev ? pct((step.value / prev) * 100) : '—'}</span>}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${(step.value / top) * 100}%`, background: ACCENT, opacity: 0.8 }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title="Buscas sem resultado" aside={`${int(data.site.searches)} buscas no período`}>
              <List
                empty="Todas as buscas encontraram produtos."
                items={data.site.searchesWithoutResult.map((s) => ({ key: s.term, main: s.term, side: `${s.count}×` }))}
              />
              {data.site.searchesWithoutResult.length > 0 && (
                <p className="mt-3 text-xs text-gray-400">O cliente procurou e não achou: produto que falta no site, nome diferente no cadastro ou sinônimo a ensinar à busca.</p>
              )}
            </Panel>
          </div>

          {/* 4. Produtos */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Mais vendidos">
              <List
                empty="Nenhuma venda no período."
                items={data.products.topSold.map((p, i) => ({ key: p.name + i, main: p.name, side: brl(p.revenue), sub: `${p.orders} ${p.orders === 1 ? 'pedido' : 'pedidos'}` }))}
              />
            </Panel>
            <Panel title="Vistos e pouco comprados">
              <List
                empty="Nenhum produto com muita visita e pouca compra."
                items={data.products.viewedNotBought.map((p, i) => ({ key: p.name + i, main: p.name, side: `${p.views} visitas`, sub: `${p.carts} no carrinho` }))}
              />
            </Panel>
            <Panel title="Faltaram na separação">
              <List
                empty="Nada faltou na separação."
                items={data.products.ruptures.map((p, i) => ({
                  key: p.name + i,
                  main: p.name,
                  side: `${p.missing + p.substituted}×`,
                  sub: [p.missing && `${p.missing} em falta`, p.substituted && `${p.substituted} substituído`].filter(Boolean).join(' · '),
                }))}
              />
            </Panel>
          </div>

          {/* Saude do sistema: o mesmo check-up diario do Telegram */}
          <Panel>
            <button type="button" onClick={() => setHealthOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
              <span className="flex items-center gap-2 text-sm text-gray-700">
                {!checkup ? (
                  <span className="text-gray-400">Verificando o sistema…</span>
                ) : failures.length === 0 ? (
                  <><Check size={16} className="text-emerald-700" /> Sistema em ordem · {checkup.results.length} verificações</>
                ) : (
                  <><AlertCircle size={16} className="text-rose-700" /> {failures.length} {failures.length === 1 ? 'verificação pede' : 'verificações pedem'} atenção</>
                )}
              </span>
              <span className="flex items-center gap-2 text-xs text-gray-400">
                {checkup && `check-up das ${new Date(checkup.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                <ChevronDown size={16} className={`transition-transform ${healthOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {healthOpen && checkup && (
              <ul className="mt-4 divide-y divide-black/[0.05]">
                {checkup.results.map((r) => (
                  <li key={r.name} className="flex gap-3 py-2.5 text-sm">
                    {r.ok ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-700" /> : <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-700" />}
                    <span className="min-w-0">
                      <span className="block text-gray-800">{r.name}</span>
                      <span className="block break-words text-xs text-gray-500">{r.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
