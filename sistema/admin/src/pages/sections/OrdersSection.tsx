import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronRight, Copy, ExternalLink, MessageCircle, Printer, RefreshCw, Search, X } from 'lucide-react'
import { escapeHtml } from '@/lib/utils'
import { getApiErrorMessage, ordersAPI, type AdminOrder, type AdminOrderSummary } from '../../services/api'

// Pedidos (refeito em 29/09/2026 com o Jonathan). Sobrio: lista por abas,
// detalhe com o que a loja usa (DAV, agendamento, preferencia de troca) e
// acoes conforme o momento do pedido -- sem seletor livre de status, que
// deixava levar um pedido cancelado a "Concluido" com um clique.

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Novo',
  PAYMENT_PENDING: 'Aguardando pagamento',
  CONFIRMED: 'Confirmado',
  PICKING_PENDING: 'Aguardando separação',
  PICKING: 'Em separação',
  WAITING_CUSTOMER_SUBSTITUTION: 'Aguardando cliente (troca)',
  CONFERENCE_PENDING: 'Aguardando conferência',
  PACKING: 'Embalando',
  READY_FOR_CHECKOUT: 'No caixa',
  READY_FOR_PICKUP: 'Pronto para retirada',
  READY_FOR_DELIVERY: 'Pronto para entrega',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  PARTIALLY_CANCELLED: 'Parcialmente cancelado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Estornado',
  FAILED_SYNC: 'Falha ao enviar ao ERP',
}
const ALL_STATUSES = Object.keys(STATUS_LABEL)
const DONE = ['DELIVERED', 'COMPLETED', 'PARTIALLY_CANCELLED']
const CANCELLED = ['CANCELLED', 'REFUNDED']
const PAST_CHECKOUT = ['READY_FOR_PICKUP', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED']

// Minutos na mesma etapa ate contar como atrasado (mesma regra da Visao geral).
const LATE_AFTER: Record<string, number> = {
  PENDING: 15, PAYMENT_PENDING: 15, CONFIRMED: 15, PICKING_PENDING: 15, PICKING: 45,
  WAITING_CUSTOMER_SUBSTITUTION: 10, CONFERENCE_PENDING: 20, PACKING: 20, READY_FOR_CHECKOUT: 60,
  READY_FOR_PICKUP: 120, READY_FOR_DELIVERY: 60, OUT_FOR_DELIVERY: 120, FAILED_SYNC: 0,
}

const EVENT_LABEL: Record<string, string> = {
  'order.created': 'Pedido criado',
  'order.updated': 'Pedido atualizado',
  'order.confirmed': 'Pedido confirmado',
  'order.cancelled': 'Pedido cancelado',
  'order.completed': 'Pedido concluído',
  'order.partially_cancelled': 'Parcialmente cancelado',
  'order.refunded': 'Pedido estornado',
  'order.status_changed': 'Status atualizado',
  'order.status_updated': 'Status atualizado',
  'order.recalculated': 'Valores recalculados',
  'order.payment_pending': 'Aguardando pagamento',
  'order.payment_updated': 'Pagamento atualizado',
  'order.sent_to_cashier': 'Enviado ao caixa',
  'order.picking_task_created': 'Separação criada',
  'order.picking_assigned': 'Separador atribuído',
  'order.picking_started': 'Separação iniciada',
  'order.picking_pending': 'Aguardando separação',
  'order.picking_completed': 'Separação concluída',
  'order.picking_finished': 'Separação concluída',
  'order.conference_pending': 'Aguardando conferência',
  'order.conference_completed': 'Conferência concluída',
  'order.picking_conferenced': 'Conferência registrada',
  'order.packed': 'Pedido embalado',
  'order.packing_completed': 'Embalagem concluída',
  'order.item_picked': 'Item separado',
  'order.item_cancelled': 'Item cancelado',
  'order.item_missing': 'Item em falta',
  'order.item_substituted': 'Item substituído',
  'order.item_added_by_picker': 'Item incluído pelo separador',
  'order.item_reset_by_picker': 'Item reaberto pelo separador',
  'order.added_item_removed': 'Item incluído removido',
  'order.substitution_accepted': 'Cliente aceitou a troca',
  'order.waiting_customer_substitution': 'Aguardando cliente aprovar troca',
  'order.ready_for_pickup': 'Pronto para retirada',
  'order.ready_for_delivery': 'Pronto para entrega',
  'order.out_for_delivery': 'Saiu para entrega',
  'order.delivered': 'Entregue',
  'order.delivery_failed': 'Falha na entrega',
  'order.failed_sync': 'Falha ao enviar ao ERP',
  'order.business_approved': 'Aprovado (conta PJ)',
}
const ACTOR_LABEL: Record<string, string> = { SYSTEM: 'sistema', ADMIN: 'admin', PICKER: 'separador', DRIVER: 'entregador', CUSTOMER: 'cliente' }
const ITEM_STATUS: Record<string, string> = {
  PENDING: 'Aguardando', ACTIVE: 'Reaberto', PICKED: 'Separado', MISSING: 'Em falta', SUBSTITUTED: 'Substituído', CANCELLED: 'Cancelado',
}
const PAYMENT_METHOD: Record<string, string> = { CASH: 'Dinheiro', PIX: 'PIX', CARD: 'Cartão na entrega', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', VOUCHER: 'Vale-alimentação' }
const PAYMENT_STATUS: Record<string, string> = { UNPAID: 'Não pago', PENDING: 'Pendente', PAID: 'Pago', FAILED: 'Falhou', REFUNDED: 'Estornado' }

type Tab = 'active' | 'scheduled' | 'done' | 'cancelled' | 'all'
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'active', label: 'Em andamento' },
  { key: 'scheduled', label: 'Agendados' },
  { key: 'done', label: 'Concluídos' },
  { key: 'cancelled', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
]

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const code = (id: string) => id.slice(-8).toUpperCase()
const firstName = (name?: string | null) => String(name || '').trim().split(/\s+/)[0] || ''
const num = (v?: number | string | null) => (v === null || v === undefined || v === '' ? undefined : Number(v))
const qty = (v?: number | string | null) => {
  const n = num(v)
  return n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
const minutesSince = (iso?: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0)
function duration(min: number) {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(min / 1440)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
function whenLabel(o: { createdAt: string; scheduledFor?: string | null }) {
  if (o.scheduledFor && new Date(o.scheduledFor).getTime() > Date.now()) {
    const d = new Date(o.scheduledFor)
    const today = new Date()
    const tomorrow = new Date(Date.now() + 86400000)
    const day = d.toDateString() === today.toDateString() ? 'hoje' : d.toDateString() === tomorrow.toDateString() ? 'amanhã' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `agendado ${day} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return `há ${duration(minutesSince(o.createdAt))}`
}
const isScheduledAhead = (o: { scheduledFor?: string | null }) => !!o.scheduledFor && new Date(o.scheduledFor).getTime() - Date.now() > 60 * 60000
function isLate(o: AdminOrderSummary) {
  if (CANCELLED.includes(o.status) || DONE.includes(o.status) || isScheduledAhead(o)) return false
  const limit = LATE_AFTER[o.status]
  return limit !== undefined && minutesSince(o.updatedAt) >= limit
}
function changeFor(notes?: string | null) {
  const m = String(notes || '').match(/Troco\s+para:\s*([0-9]+(?:[.,][0-9]{1,2})?)/i)
  return m ? Number(m[1].replace('.', '').replace(',', '.')) : null
}
function whatsappUrl(phone: string | null | undefined, text: string) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}?text=${encodeURIComponent(text)}`
}
function whatsappText(o: AdminOrder) {
  const ref = `#${code(o.id)}${o.erpDav ? ` (DAV ${o.erpDav})` : ''}`
  const base = `Olá, ${firstName(o.customer?.name)}! Aqui é da Antenor & Filhos, sobre o seu pedido ${ref}.`
  const extra: Record<string, string> = {
    WAITING_CUSTOMER_SUBSTITUTION: ' Um item está em falta e precisamos saber se podemos substituir.',
    READY_FOR_PICKUP: ' Ele já está pronto para retirada.',
    OUT_FOR_DELIVERY: ' Ele saiu para entrega e chega em breve.',
  }
  return base + (extra[o.status] || '')
}

function printOrder(o: AdminOrder) {
  const a = o.addressSnapshot
  const addr = a
    ? `${escapeHtml(a.street || '')}${a.number ? ', ' + escapeHtml(a.number) : ''}${a.complement ? ' - ' + escapeHtml(a.complement) : ''}<br>${escapeHtml([a.neighborhood, a.city].filter(Boolean).join(' - '))}${a.reference ? '<br>Ref: ' + escapeHtml(a.reference) : ''}`
    : 'Retirada na loja'
  const rows = (o.items || [])
    .map((i) => `<tr><td>${escapeHtml(i.product?.name || i.productId)}</td><td>${qty(i.requestedQuantity ?? i.quantity)}</td><td>${qty(i.fulfilledQuantity)}</td><td>${i.substitutionPolicy === 'DENY' ? 'Não trocar' : 'Pode trocar'}</td><td>${brl(num(i.finalSubtotal) ?? i.subtotal)}</td></tr>`)
    .join('')
  const troco = changeFor(o.notes)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${code(o.id)}</title><style>body{font-family:Arial,sans-serif;padding:16px;font-size:12px;color:#222}h1{font-size:18px;margin:0}h2{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #ccc}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f4f4f4}.dav{font-size:22px;font-weight:bold}.meta span{margin-right:16px}</style></head><body>
<h1>Pedido #${code(o.id)}</h1>${o.erpDav ? `<div class="dav">DAV ${escapeHtml(o.erpDav)}</div>` : ''}
<p class="meta"><span><b>Cliente:</b> ${escapeHtml(o.customer?.name || '-')}</span><span><b>WhatsApp:</b> ${escapeHtml(o.customer?.whatsapp || '-')}</span><span><b>Feito em:</b> ${new Date(o.createdAt).toLocaleString('pt-BR')}</span>${o.scheduledFor ? `<span><b>Agendado:</b> ${new Date(o.scheduledFor).toLocaleString('pt-BR')}</span>` : ''}</p>
<h2>${o.fulfillmentType === 'PICKUP' ? 'Retirada' : 'Entrega'}</h2><p>${addr}</p>
${o.notes ? `<h2>Observações</h2><p>${escapeHtml(o.notes)}</p>` : ''}
<h2>Itens</h2><table><thead><tr><th>Produto</th><th>Pedido</th><th>Separado</th><th>Troca</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>
<p style="text-align:right;margin-top:8px">Subtotal ${brl(o.subtotal)}${o.discount > 0 ? ` · Desconto -${brl(o.discount)}` : ''}${o.delivery > 0 ? ` · Frete ${brl(o.delivery)}` : ''} · <b>Total ${brl(o.total)}</b></p>
<p><b>Pagamento:</b> ${escapeHtml(PAYMENT_METHOD[String(o.paymentMethod || '').toUpperCase()] || o.paymentMethod || '-')}${troco != null ? ` · troco para ${brl(troco)}` : ''}</p></body></html>`
  // 29/09/2026: com 'noopener' o navegador devolve null e nada era impresso.
  // Abre normal e corta o vinculo com esta aba logo em seguida.
  const w = window.open('', '_blank')
  if (!w) return
  w.opener = null
  w.document.write(html)
  w.document.close()
  w.print()
}

function Block({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  )
}

export default function OrdersSection({ openOrderId, onOpenOrderConsumed }: { openOrderId?: string | null; onOpenOrderConsumed?: () => void }) {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await ordersAPI.listSummary()
      setOrders(res.data)
      setListError(false)
    } catch {
      setListError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = window.setInterval(load, 60_000)
    return () => window.clearInterval(t)
  }, [load])

  // Vindo da Visao geral (clique num alerta): abre o pedido direto.
  useEffect(() => {
    if (openOrderId) {
      setSelectedId(openOrderId)
      onOpenOrderConsumed?.()
    }
  }, [openOrderId, onOpenOrderConsumed])

  const inTab = useCallback((o: AdminOrderSummary, t: Tab) => {
    if (t === 'all') return true
    if (t === 'cancelled') return CANCELLED.includes(o.status)
    if (t === 'done') return DONE.includes(o.status)
    const open = !CANCELLED.includes(o.status) && !DONE.includes(o.status)
    return t === 'scheduled' ? open && isScheduledAhead(o) : open && !isScheduledAhead(o)
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    const now = Date.now()
    return orders.filter((o) => {
      if (term) {
        const hay = `${o.customer?.name || ''} ${code(o.id)} ${o.id}`.toLowerCase()
        const byDigits = digits.length >= 3 && (String(o.erpDav || '').includes(digits) || String(o.customer?.whatsapp || '').replace(/\D/g, '').includes(digits))
        if (!hay.includes(term) && !byDigits) return false
      }
      if (paymentFilter && String(o.paymentMethod || '').toUpperCase() !== paymentFilter) return false
      if (dateFilter !== 'all') {
        const t = new Date(o.createdAt).getTime()
        if (dateFilter === 'today' && new Date(t).toDateString() !== new Date().toDateString()) return false
        if (dateFilter === '7d' && now - t > 7 * 86400000) return false
        if (dateFilter === '30d' && now - t > 30 * 86400000) return false
      }
      return true
    })
  }, [orders, search, paymentFilter, dateFilter])

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, filtered.filter((o) => inTab(o, t.key)).length])) as Record<Tab, number>, [filtered, inTab])
  const rows = useMemo(() => {
    const list = filtered.filter((o) => inTab(o, tab))
    // Mais recente no topo (pedido do Jonathan, 29/09/2026); atrasado segue marcado.
    // Agendados: o mais proximo primeiro.
    if (tab === 'scheduled') return [...list].sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filtered, tab, inTab])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Abas + busca */}
      <div className="space-y-3">
        <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm transition-colors ${tab === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:text-gray-900'}`}
            >
              {t.label}
              <span className={`ml-1.5 tabular-nums ${tab === t.key ? 'text-white/70' : 'text-gray-400'}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, código, DAV ou telefone"
              className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400"
            />
          </label>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700">
            <option value="all">Qualquer data</option>
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700">
            <option value="">Todo pagamento</option>
            <option value="PIX">PIX</option>
            <option value="CARD">Cartão na entrega</option>
            <option value="CASH">Dinheiro</option>
          </select>
          <button type="button" onClick={load} aria-label="Atualizar lista" className="rounded-xl border border-black/[0.06] bg-white p-2.5 text-gray-500 hover:text-gray-900">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {listError && !orders.length && (
        <p className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 text-sm text-gray-600">
          <AlertCircle size={16} className="text-rose-700" /> Não foi possível carregar os pedidos.
          <button type="button" onClick={load} className="font-medium underline underline-offset-2">Tentar de novo</button>
        </p>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nenhum pedido aqui.</p>
      ) : (
        <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {rows.map((o) => {
            const late = isLate(o)
            const troco = changeFor(o.notes)
            const where = o.fulfillmentType === 'PICKUP' ? 'Retirada' : o.addressSnapshot?.neighborhood || 'Entrega'
            return (
              <li key={o.id}>
                <button type="button" onClick={() => setSelectedId(o.id)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-gray-50 md:grid-cols-[150px_1fr_150px_120px_120px_20px]">
                  {/* codigo + DAV */}
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-gray-500">#{code(o.id)}</span>
                    <span className="block text-sm tabular-nums text-gray-900">{o.erpDav ? `DAV ${o.erpDav}` : <span className="text-amber-700">sem DAV</span>}</span>
                  </span>
                  {/* cliente + etapa (no celular, fica ao lado do valor) */}
                  <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                    <span className="block truncate text-sm text-gray-900">{o.customer?.name || '—'}</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      {late && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="atrasado" />}
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </span>
                  <span className="order-4 col-span-2 text-xs text-gray-500 md:order-none md:col-span-1">
                    {whenLabel(o)}
                    <span className="block truncate">{where}</span>
                  </span>
                  <span className="text-right text-sm tabular-nums text-gray-900 md:text-left">
                    {brl(o.total)}
                    <span className="block text-xs text-gray-500">{PAYMENT_METHOD[String(o.paymentMethod || '').toUpperCase()] || '—'}{troco != null ? ` · troco ${brl(troco)}` : ''}</span>
                  </span>
                  <span className="hidden text-xs text-gray-500 md:block">{o._count?.items ?? 0} itens</span>
                  <ChevronRight size={16} className="hidden text-gray-300 group-hover:text-gray-500 md:block" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selectedId && (
        <OrderDetail
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

export function OrderDetail({ orderId, onClose, onChanged }: { orderId: string; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<AdminOrder | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [fixStatus, setFixStatus] = useState('')

  const reload = useCallback(async () => {
    try {
      const res = await ordersAPI.getOne(orderId)
      setOrder(res.data)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível abrir o pedido.'))
    }
  }, [orderId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
      onChanged()
      return true
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível concluir a ação.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const status = order?.status || ''
  const terminal = CANCELLED.includes(status)
  // Acao principal conforme o momento (a separacao e a entrega andam pelos apps).
  const next: { label: string; status: string } | null =
    status === 'READY_FOR_DELIVERY' || status === 'OUT_FOR_DELIVERY'
      ? { label: 'Marcar como entregue', status: 'DELIVERED' }
      : status === 'READY_FOR_PICKUP' || status === 'DELIVERED'
        ? { label: 'Concluir pedido', status: 'COMPLETED' }
        : null
  const troco = order ? changeFor(order.notes) : null
  const addr = order?.addressSnapshot
  const mapsUrl = addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addr.street, addr.number, addr.neighborhood, addr.city].filter(Boolean).join(', '))}` : ''
  const wa = order ? whatsappUrl(order.customer?.whatsapp, whatsappText(order)) : ''

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <aside role="dialog" aria-modal="true" aria-label="Pedido" className="fixed inset-0 z-50 flex flex-col bg-gray-50 sm:inset-y-0 sm:left-auto sm:w-full sm:max-w-2xl sm:border-l sm:border-black/[0.06] sm:shadow-xl">
        {/* Topo */}
        <header className="border-b border-black/[0.06] bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-gray-500">#{code(orderId)}</p>
              {order && (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    {order.erpDav ? (
                      <>
                        <span className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">DAV {order.erpDav}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(String(order.erpDav))
                            setCopied(true)
                            window.setTimeout(() => setCopied(false), 1500)
                          }}
                          aria-label="Copiar DAV"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          {copied ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
                        </button>
                      </>
                    ) : (
                      <span className="text-lg text-amber-700">Sem DAV — não dá para puxar no caixa</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {STATUS_LABEL[order.status] || order.status} · {whenLabel(order)} · {order.fulfillmentType === 'PICKUP' ? 'Retirada' : `Entrega${addr?.neighborhood ? ` · ${addr.neighborhood}` : ''}`}
                  </p>
                </>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          {order && (
            <div className="mt-4 flex flex-wrap gap-2">
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              <button type="button" onClick={() => printOrder(order)} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
                <Printer size={15} /> Imprimir
              </button>
              {next && (
                <button type="button" disabled={busy} onClick={() => run(() => ordersAPI.updateStatus(order.id, next.status))} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
                  <Check size={15} /> {next.label}
                </button>
              )}
              {!terminal && (
                <button type="button" onClick={() => setCancelOpen(true)} className="ml-auto rounded-xl px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">
                  Cancelar pedido
                </button>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {!order && !error && <div className="h-40 animate-pulse rounded-2xl bg-white" />}

          {order && (
            <>
              {order.cancellationReason && CANCELLED.includes(order.status) && (
                <p className="rounded-xl border border-black/[0.06] bg-white p-3 text-sm text-gray-700"><span className="text-gray-500">Motivo do cancelamento:</span> {order.cancellationReason}</p>
              )}

              <Block title="Itens" aside={<span className="text-xs text-gray-400">{order.items?.length || 0}</span>}>
                <ul className="divide-y divide-black/[0.05]">
                  {order.items?.map((item) => {
                    const final = num(item.finalSubtotal)
                    return (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900">{item.product?.name || item.productId}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Pedido {qty(item.requestedQuantity ?? item.quantity)}
                            {item.fulfilledQuantity != null && ` · separado ${qty(item.fulfilledQuantity)}`}
                            {' · '}{ITEM_STATUS[item.status || 'PENDING'] || item.status}
                            {' · '}<span className={item.substitutionPolicy === 'DENY' ? 'text-gray-700' : ''}>{item.substitutionPolicy === 'DENY' ? 'cliente não quer troca' : 'aceita troca'}</span>
                          </p>
                          {item.cutReason && <p className="mt-0.5 text-xs text-rose-700">{item.cutReason}</p>}
                          {item.pickerNotes && <p className="mt-0.5 text-xs text-gray-500">Separador: {item.pickerNotes}</p>}
                        </div>
                        <span className="shrink-0 text-right text-sm tabular-nums text-gray-900">
                          {brl(final ?? item.subtotal)}
                          {final !== undefined && Math.abs(final - item.subtotal) > 0.009 && <span className="block text-xs text-gray-400 line-through">{brl(item.subtotal)}</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-black/[0.05] pt-3 text-sm">
                  <div className="flex justify-between text-gray-600"><dt>Subtotal</dt><dd className="tabular-nums">{brl(order.subtotal)}</dd></div>
                  {order.discount > 0 && <div className="flex justify-between text-gray-600"><dt>Desconto</dt><dd className="tabular-nums">−{brl(order.discount)}</dd></div>}
                  <div className="flex justify-between text-gray-600"><dt>Frete</dt><dd className="tabular-nums">{order.delivery > 0 ? brl(order.delivery) : 'grátis'}</dd></div>
                  <div className="flex justify-between font-semibold text-gray-900"><dt>Total</dt><dd className="tabular-nums">{brl(order.total)}</dd></div>
                </dl>
              </Block>

              <div className="grid gap-3 sm:grid-cols-2">
                <Block title="Cliente">
                  <p className="text-sm text-gray-900">{order.customer?.name || '—'}</p>
                  {order.customer?.whatsapp && <p className="text-sm tabular-nums text-gray-600">{order.customer.whatsapp}</p>}
                  {order.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700"><span className="text-gray-500">Observações:</span> {order.notes}</p>}
                </Block>
                <Block title={order.fulfillmentType === 'PICKUP' ? 'Retirada' : 'Entrega'} aside={mapsUrl && order.fulfillmentType !== 'PICKUP' ? <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">mapa <ExternalLink size={12} /></a> : undefined}>
                  {order.fulfillmentType === 'PICKUP' || !addr ? (
                    <p className="text-sm text-gray-700">Na loja</p>
                  ) : (
                    <div className="space-y-0.5 text-sm text-gray-700">
                      <p>{addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.complement ? ` · ${addr.complement}` : ''}</p>
                      <p className="text-gray-500">{[addr.neighborhood, addr.city].filter(Boolean).join(' · ')}</p>
                      {addr.reference && <p className="text-gray-500">Ref.: {addr.reference}</p>}
                    </div>
                  )}
                  {order.scheduledFor && <p className="mt-2 text-sm text-gray-700"><span className="text-gray-500">Agendado:</span> {new Date(order.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>}
                  {order.deliveryInstructions && <p className="mt-2 text-sm text-gray-700"><span className="text-gray-500">Instruções:</span> {order.deliveryInstructions}</p>}
                </Block>
              </div>

              <Block title="Pagamento">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-gray-500">
                    Forma
                    <select
                      value={String(order.paymentMethod || 'CASH').toUpperCase()}
                      disabled={busy || terminal}
                      onChange={(e) => run(() => ordersAPI.update(order.id, { paymentMethod: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900"
                    >
                      <option value="CASH">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CARD">Cartão na entrega</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">
                    Situação
                    <select
                      value={String(order.paymentStatus || 'UNPAID').toUpperCase()}
                      disabled={busy || terminal}
                      onChange={(e) => run(() => ordersAPI.update(order.id, { paymentStatus: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900"
                    >
                      {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                </div>
                {troco != null && <p className="mt-3 text-sm text-gray-700">Troco para <span className="tabular-nums">{brl(troco)}</span> · levar <span className="tabular-nums">{brl(Math.max(0, troco - order.total))}</span></p>}
              </Block>

              <Block title="Linha do tempo">
                {(order.events || []).length === 0 ? (
                  <p className="text-sm text-gray-400">Sem registros.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {(order.events || []).slice().reverse().map((ev) => {
                      const reason = (ev.payload as { reason?: string } | undefined)?.reason
                      return (
                        <li key={ev.id} className="flex gap-3 text-sm">
                          <span className="w-24 shrink-0 text-xs tabular-nums text-gray-400">{new Date(ev.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="min-w-0 text-gray-800">
                            {EVENT_LABEL[ev.type] || ev.type}
                            <span className="text-gray-400"> · {ACTOR_LABEL[ev.actorType] || ev.actorType}</span>
                            {reason && <span className="block text-xs text-gray-500">{reason}</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </Block>

              {!terminal && (
                <details className="rounded-2xl border border-black/[0.06] bg-white p-4 text-sm">
                  <summary className="cursor-pointer text-gray-500">Avançado: corrigir etapa manualmente</summary>
                  <p className="mt-2 text-xs text-gray-500">Só para corrigir erro. A separação e a entrega atualizam a etapa sozinhas pelos apps, e o cliente é avisado da mudança.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select value={fixStatus} onChange={(e) => setFixStatus(e.target.value)} className="h-10 flex-1 rounded-xl border border-black/[0.08] bg-white px-3 text-sm">
                      <option value="">Escolha a etapa correta…</option>
                      {ALL_STATUSES.filter((s) => s !== order.status && !CANCELLED.includes(s)).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={!fixStatus || busy}
                      onClick={async () => {
                        if (!window.confirm(`Mudar o pedido #${code(order.id)} de "${STATUS_LABEL[order.status]}" para "${STATUS_LABEL[fixStatus]}"?`)) return
                        if (await run(() => ordersAPI.updateStatus(order.id, fixStatus))) setFixStatus('')
                      }}
                      className="rounded-xl border border-black/[0.08] px-3 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Aplicar
                    </button>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </aside>

      {cancelOpen && order && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-base font-semibold text-gray-900">Cancelar pedido #{code(order.id)}?</h3>
            <p className="mt-1 text-sm text-gray-500">O pedido é cancelado também no ERP, e o estoque e o horário reservados são liberados.</p>
            {PAST_CHECKOUT.includes(order.status) && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Este pedido já passou pelo caixa. Cancelar aqui não estorna a venda no PDV: o estorno tem que ser feito no caixa.
              </p>
            )}
            <label className="mt-4 block text-xs text-gray-500">
              Motivo (obrigatório)
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Ex.: cliente desistiu; produto indisponível"
                className="mt-1 w-full rounded-xl border border-black/[0.08] p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelOpen(false)} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Voltar</button>
              <button
                type="button"
                disabled={busy || cancelReason.trim().length < 3}
                onClick={async () => {
                  if (await run(() => ordersAPI.updateStatus(order.id, 'CANCELLED', cancelReason.trim()))) {
                    setCancelOpen(false)
                    setCancelReason('')
                  }
                }}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm text-white hover:bg-rose-800 disabled:opacity-40"
              >
                {busy ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
