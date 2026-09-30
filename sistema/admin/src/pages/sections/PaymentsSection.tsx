import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronDown, Copy } from 'lucide-react'
import { getApiErrorMessage, paymentsAdminAPI, type PaymentsOverview, type PaymentsOverviewOrder } from '../../services/api'
import { OrderDetail, STATUS_LABEL } from './OrdersSection'

// Pagamentos (refeita em 30/09/2026). O site nao cobra: o cliente escolhe a
// forma e o caixa (PDV) cobra depois da separacao. A tela antiga mostrava o
// livro de um gateway que nunca existiu. Esta segue o dinheiro em tres
// valores: aprovado no site -> depois da separacao -> cupom do caixa.

const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + brl(Math.abs(v))
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const METHOD: Record<string, string> = { CASH: 'Dinheiro', PIX: 'PIX', CARD: 'Cartão', VOUCHER: 'Vale-alimentação', OTHER: 'Outra' }
const FLAG: Record<string, string> = {
  CAIXA_DIFERENTE: 'Caixa cobrou diferente do separado',
  SAIU_SEM_CUPOM: 'Saiu sem cupom no caixa',
  CANCELADO_APOS_FATURAR: 'Cupom cancelado depois de faturado',
}
const DAYS = [7, 30, 90]
const moved = (v: number | null) => v != null && Math.abs(v) > 0.02

export default function PaymentsSection() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<PaymentsOverview | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState<string | null>(null)
  const [onlyFlags, setOnlyFlags] = useState(false)

  const load = useCallback(async () => {
    try {
      setData((await paymentsAdminAPI.overview(days)).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar os pagamentos.'))
    }
  }, [days])
  useEffect(() => {
    load()
  }, [load])

  const s = data?.summary
  const flagged = data?.orders.filter((o) => o.flags.length) || []
  const list = onlyFlags ? flagged : data?.orders || []
  const maxOrders = Math.max(1, ...(data?.byMethod || []).map((m) => Math.max(m.siteOrders, m.pdvOrders)))

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">O site não cobra: o cliente escolhe a forma e o caixa cobra depois da separação, pelo peso real. Aqui fica o caminho do dinheiro: aprovado, separado e cobrado.</p>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
          {DAYS.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-sm ${days === d ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
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

      {!s ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Aprovado no site" value={brl(s.approved)} hint={`${s.orders} pedido(s), com ${brl(s.delivery)} de frete`} />
            <Stat label="Depois da separação" value={brl(s.final)} hint={`${signed(s.pickingAdjust)} por peso real, falta e troca`} />
            <Stat
              label="Cobrado no caixa"
              value={s.withCupom ? brl(s.charged) : '—'}
              hint={s.withCupom ? `${s.withCupom} cupom(ns); ${moved(s.cashierDiff) ? `${signed(s.cashierDiff)} contra o separado` : 'bate com o separado'}` : 'aparece quando o caixa faturar'}
            />
            <Stat label="Aguardando caixa" value={String(s.awaitingCashier)} hint={`${s.cancelled} cancelado(s) no período`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Formas de pagamento</h3>
              {data.byMethod.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Nenhum pedido no período.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.byMethod.map((m) => (
                    <li key={m.method}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-gray-900">{METHOD[m.method] || m.method}</span>
                        <span className="text-xs tabular-nums text-gray-500">{m.siteOrders ? brl(m.siteValue) : ''}</span>
                      </div>
                      <Bar label="escolheram no site" value={m.siteOrders} max={maxOrders} tone="bg-[#5D082A]" />
                      <Bar label="registrados no caixa" value={m.pdvOrders} max={maxOrders} tone="bg-gray-400" />
                    </li>
                  ))}
                </ul>
              )}
              {s.methodMismatch > 0 && (
                <p className="mt-3 flex gap-2 text-xs text-gray-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    {s.methodMismatch} de {s.withCupom} pedido(s) foram registrados no caixa com forma diferente da escolhida no site. Se o cliente pagou por PIX ou cartão e o caixa lançou Dinheiro, o fechamento da gaveta não bate.
                  </span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Precisa de atenção</h3>
              {flagged.length === 0 ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Nada fora do normal no período.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-black/[0.05]">
                  {flagged.slice(0, 6).map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setOrderOpen(o.id)} className="flex w-full items-start gap-2 py-2 text-left">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-900">
                            {o.dav ? `DAV ${o.dav}` : 'Sem DAV'} · {o.customer || 'Cliente'}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {o.flags.map((f) => FLAG[f] || f).join(' · ')} · {when(o.createdAt)}
                          </span>
                        </span>
                        {moved(o.cashierDiff) && <span className="text-sm tabular-nums text-gray-900">{signed(o.cashierDiff!)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {flagged.length > 6 && (
                <button type="button" onClick={() => setOnlyFlags(true)} className="mt-1 text-xs text-gray-600 underline">
                  Ver os {flagged.length}
                </button>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.05] px-4 py-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Pedidos do período</h3>
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={onlyFlags} onChange={(e) => setOnlyFlags(e.target.checked)} /> Só os que precisam de atenção
              </label>
            </div>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_105px_105px_105px_24px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
              <span>Pedido</span>
              <span>Forma: site → caixa</span>
              <span className="text-right">Aprovado</span>
              <span className="text-right">Separado</span>
              <span className="text-right">Cobrado</span>
              <span />
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhum pedido.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {list.map((o) => (
                  <Row key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} onOpenOrder={() => setOrderOpen(o.id)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {orderOpen && <OrderDetail orderId={orderOpen} onClose={() => setOrderOpen(null)} onChanged={load} />}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-40 shrink-0 text-xs tabular-nums text-gray-500">
        {value} {label}
      </span>
    </div>
  )
}

function Row({ o, open, onToggle, onOpenOrder }: { o: PaymentsOverviewOrder; open: boolean; onToggle: () => void; onOpenOrder: () => void }) {
  const cancelled = o.status === 'CANCELLED' || o.status === 'REFUNDED'
  const caixa = o.pdv?.formas.length ? o.pdv.formas.map((f) => METHOD[f] || f).join(' + ') : null
  const semCaixa = cancelled
    ? 'cancelado'
    : !o.invoicedAt
      ? o.status === 'READY_FOR_CHECKOUT'
        ? 'aguardando caixa'
        : 'ainda não faturado'
      : 'forma não informada'
  return (
    <li className={cancelled ? 'opacity-60' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-3 gap-x-3 gap-y-1 px-4 py-3 text-left md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_105px_105px_105px_24px] md:items-center"
      >
        <span className="col-span-3 flex min-w-0 items-start justify-between gap-2 md:col-span-1">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm text-gray-900">
              {o.flags.length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
              <span className="truncate">
                {o.dav ? `DAV ${o.dav}` : 'Sem DAV'} · {o.customer || 'Cliente'}
              </span>
            </span>
            <span className="block text-xs text-gray-500">
              {when(o.createdAt)} · {o.pickup ? 'retirada' : 'entrega'} · {STATUS_LABEL[o.status] || o.status}
            </span>
          </span>
          <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition-transform md:hidden ${open ? 'rotate-180' : ''}`} />
        </span>
        <span className="col-span-3 text-xs text-gray-600 md:col-span-1 md:text-sm">
          {METHOD[o.siteMethod] || o.siteMethod} → {caixa ? <span className={o.methodMismatch ? 'text-amber-700' : ''}>{caixa}</span> : <span className="text-gray-400">{semCaixa}</span>}
        </span>
        <Money label="Aprovado" value={o.approved} />
        <Money label="Separado" value={o.total} dim={!moved(o.pickingAdjust)} />
        <Money label="Cobrado" value={o.charged} strong={moved(o.cashierDiff)} />
        <ChevronDown size={16} className={`hidden text-gray-400 transition-transform md:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <Details o={o} onOpenOrder={onOpenOrder} />}
    </li>
  )
}

function Money({ label, value, dim, strong }: { label: string; value: number | null; dim?: boolean; strong?: boolean }) {
  return (
    <span className={`text-xs tabular-nums md:text-right md:text-sm ${value == null || dim ? 'text-gray-400' : strong ? 'font-semibold text-amber-800' : 'text-gray-900'}`}>
      <span className="block text-[11px] text-gray-400 md:hidden">{label}</span>
      {value != null ? brl(value) : '—'}
    </span>
  )
}

function Details({ o, onOpenOrder }: { o: PaymentsOverviewOrder; onOpenOrder: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid gap-4 bg-gray-50/70 px-4 py-3 text-sm md:grid-cols-3">
      <div>
        <p className="text-xs text-gray-500">No site</p>
        <p className="tabular-nums text-gray-900">Aprovou {brl(o.approved)}</p>
        <p className="tabular-nums text-gray-900">
          Depois da separação {brl(o.total)} {moved(o.pickingAdjust) && <span className="text-xs text-gray-500">({signed(o.pickingAdjust)})</span>}
        </p>
        <p className="text-xs text-gray-500">
          {o.delivery > 0 ? `Frete ${brl(o.delivery)} · ` : ''}
          {o.discount > 0 ? `Cupom de desconto ${brl(o.discount)} · ` : ''}
          Escolheu {METHOD[o.siteMethod] || o.siteMethod}
          {o.changeFor ? `, troco para R$ ${o.changeFor}` : ''}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500">No caixa</p>
        {o.pdv ? (
          <>
            {o.pdv.valorCupom != null && (
              <p className="tabular-nums text-gray-900">
                Cupom {brl(o.pdv.valorCupom)}
                {o.delivery > 0 && <span className="text-xs text-gray-500"> + frete {brl(o.delivery)}</span>}
              </p>
            )}
            {o.pdv.meios.map((m, i) => (
              <p key={i} className="text-xs tabular-nums text-gray-600">
                Lançado como {m.descricao}: {brl(m.valor)}
                {m.troco > 0 && ` (troco ${brl(m.troco)})`}
              </p>
            ))}
            {moved(o.cashierDiff) && <p className="text-xs text-amber-700">{signed(o.cashierDiff!)} em relação ao separado</p>}
            <p className="text-xs text-gray-500">
              {o.pdv.cupom ? `Cupom nº ${o.pdv.cupom}` : ''}
              {o.pdv.caixa ? ` · caixa ${o.pdv.caixa}` : ''}
              {o.invoicedAt ? ` · ${when(o.invoicedAt)}` : ''}
            </p>
            {o.pdv.nfce && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(o.pdv!.nfce!).then(() => setCopied(true))}
                className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600 underline"
              >
                <Copy size={12} /> {copied ? 'Chave copiada' : 'Copiar chave da NFC-e'}
              </button>
            )}
          </>
        ) : (
          <p className="text-gray-500">
            {o.cancelledInErp ? 'Cupom cancelado no caixa.' : o.invoicedAt ? `Faturado em ${when(o.invoicedAt)}; o detalhe do cupom ainda não chegou.` : 'Ainda não passou no caixa.'}
          </p>
        )}
      </div>
      <div>
        {o.flags.length > 0 && (
          <>
            <p className="text-xs text-gray-500">Atenção</p>
            <p className="text-xs text-amber-700">{o.flags.map((f) => FLAG[f] || f).join(' · ')}</p>
          </>
        )}
        <button type="button" onClick={onOpenOrder} className="mt-2 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">
          Abrir pedido (itens e separação)
        </button>
      </div>
    </div>
  )
}
