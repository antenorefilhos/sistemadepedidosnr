import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { NoResultSearches } from './NoResultSearches'
import { getApiErrorMessage, intelligenceAPI, resolveApiUrl, type IntelligenceFunnel, type IntelligenceProduct, type IntelligenceResponse } from '../../services/api'

// Inteligencia (refeita em 29/09/2026 com o Jonathan). So o que leva a uma
// decisao, calculado dos dados da loja: onde o cliente desiste (funil), o que
// ele procura e nao acha (busca), o que olha e nao leva, quando os pedidos
// chegam e se ele volta a comprar. Robos de busca (1 pagina e somem) ficam
// fora das contas e aparecem a parte.

const PERIODS = [7, 30, 90] as const
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number) => v.toLocaleString('pt-BR')
const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export default function IntelligenceSection() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [data, setData] = useState<IntelligenceResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    intelligenceAPI
      .get(days)
      .then((r) => (setData(r.data), setError('')))
      .catch((e) => setError(getApiErrorMessage(e, 'Não foi possível carregar.')))
  }, [days])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Comportamento de quem visita o site e compra, sem contar robôs de busca.</p>
        <div className="flex gap-1 rounded-2xl border border-black/[0.06] bg-white p-1">
          {PERIODS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-xl px-3 py-1.5 text-sm ${days === d ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!data ? (
        !error && <div className="h-96 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <>
          <Funnel current={data.funnel.current} previous={data.funnel.previous} days={data.days} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="O que procuram e não acham" hint="Buscas que voltaram vazias no período, conferidas de novo agora. Cada uma é venda perdida: resolva com um sinônimo ou cadastrando o produto.">
              <NoResultSearches items={data.search.noResult} />
            </Card>
            <Card title="O que mais procuram" hint={`${num(data.search.total)} buscas no período.`}>
              {data.search.top.length === 0 ? (
                <Empty text="Sem buscas no período." />
              ) : (
                <Bars rows={data.search.top.map((s) => ({ key: s.term, label: s.term, value: s.total, note: s.empty ? `${s.empty} sem resultado` : '' }))} />
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Mais vendidos" hint="Pedidos com o produto no período.">
              <ProductRows items={data.products.topSold} value={(p) => `${p.sold} ped.`} empty="Sem vendas no período." />
            </Card>
            <Card title="Olham e não levam" hint="5+ pessoas viram e menos de 10% colocou no carrinho. Vale rever preço, foto ou nome.">
              <ProductRows items={data.products.lookNoBuy} value={(p) => `${p.views} viram · ${p.adds} levaram`} empty="Nada chamou atenção sem vender." />
            </Card>
            <Card title="Ficam no carrinho" hint="Colocaram no carrinho e não compraram.">
              <ProductRows items={data.products.abandoned} value={(p) => `${p.adds} no carrinho · ${p.sold} compraram`} empty="Nenhum carrinho esquecido relevante." />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card title="Quando os pedidos chegam" hint="Pedidos por dia da semana e hora (Brasília). Ajuda a planejar equipe e horário de promoção.">
              <Heatmap points={data.heatmap} />
            </Card>
            <Card title="Clientes" hint="Quem comprou no período.">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Compraram" value={num(data.customers.buyers)} />
                <Stat label="Primeira compra" value={num(data.customers.firstTime)} />
                <Stat label="Já eram clientes" value={num(data.customers.returning)} />
                <Stat label="Compraram 2+ vezes" value={num(data.customers.boughtTwiceInPeriod)} note={`${rate(data.customers.boughtTwiceInPeriod, data.customers.buyers)}% dos clientes`} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Funnel({ current: c, previous: p, days }: { current: IntelligenceFunnel; previous: IntelligenceFunnel; days: number }) {
  const steps = [
    { label: 'Visitaram', value: c.visitors, prev: p.visitors },
    // "Viram produto" nao e etapa: a maioria poe no carrinho direto da vitrine.
    { label: 'Puseram no carrinho', value: c.carted, prev: p.carted },
    { label: 'Checkout', value: c.checkout, prev: p.checkout },
    { label: 'Pedidos', value: c.orders, prev: p.orders },
  ]
  const max = Math.max(1, ...steps.map((s) => s.value))
  const conv = rate(c.orders, c.visitors)
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Do acesso ao pedido · {days} dias</h3>
        <p className="text-xs text-gray-400">Comparado aos {days} dias anteriores</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.label}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums text-gray-900">
              {num(s.value)} <Delta now={s.value} before={s.prev} />
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100">
              <div className="h-1.5 rounded-full bg-[#5D082A]/70" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
            {i > 0 && <p className="mt-1 text-xs text-gray-400">{rate(s.value, steps[i - 1].value)}% da etapa anterior</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-black/[0.05] pt-3 text-sm text-gray-600">
        <span>
          Conversão <span className="tabular-nums text-gray-900">{conv}%</span>
        </span>
        <span>
          Faturamento <span className="tabular-nums text-gray-900">{brl(c.revenue)}</span> <Delta now={c.revenue} before={p.revenue} />
        </span>
        <span>
          Ticket médio <span className="tabular-nums text-gray-900">{brl(c.ticket)}</span>
        </span>
        <span>
          Abriram a página de um produto <span className="tabular-nums text-gray-900">{num(c.viewed)}</span>
        </span>
        <span className="text-gray-400">{num(c.bots)} acessos de robôs de busca (1 página só) fora da conta</span>
      </div>
    </div>
  )
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null
  const d = Math.round(((now - before) / before) * 100)
  if (d === 0) return null
  const Up = d > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center text-xs font-normal ${d > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
      <Up size={12} />
      {Math.abs(d)}%
    </span>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400">{text}</p>
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      {note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  )
}

function Bars({ rows }: { rows: Array<{ key: string; label: string; value: number; note?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate text-gray-900">{r.label}</span>
            <span className="shrink-0 tabular-nums text-gray-600">
              {r.value}
              {r.note && <span className="ml-1.5 text-xs text-gray-400">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-gray-100">
            <div className="h-1 rounded-full bg-[#5D082A]/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ProductRows({ items, value, empty }: { items: IntelligenceProduct[]; value: (p: IntelligenceProduct) => string; empty: string }) {
  if (!items.length) return <Empty text={empty} />
  return (
    <ul className="divide-y divide-black/[0.05]">
      {items.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2">
          <Thumb ean={p.ean} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-gray-900">{p.name}</span>
            <span className="block text-xs tabular-nums text-gray-500">{value(p)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Thumb({ ean }: { ean: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      {!broken && <img src={resolveApiUrl(`/thumbs/products/${ean}.webp`)} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setBroken(true)} />}
    </span>
  )
}

function Heatmap({ points }: { points: Array<{ dow: number; hour: number; n: number }> }) {
  if (!points.length) return <Empty text="Sem pedidos no período." />
  const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 7h-22h
  const at = (d: number, h: number) => points.find((p) => p.dow === d && p.hour === h)?.n || 0
  const max = Math.max(1, ...points.map((p) => p.n))
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[11px]">
        <thead>
          <tr>
            <th />
            {hours.map((h) => (
              <th key={h} className="font-normal tabular-nums text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW.map((d, di) => (
            <tr key={d}>
              <td className="pr-1 text-gray-500">{d}</td>
              {hours.map((h) => {
                const n = at(di, h)
                return (
                  <td
                    key={h}
                    title={`${d} ${h}h: ${n} pedido(s)`}
                    className="h-6 min-w-[18px] rounded text-center tabular-nums text-white"
                    style={{ background: n ? `rgba(93, 8, 42, ${0.15 + (n / max) * 0.75})` : '#f3f4f6' }}
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
  )
}
