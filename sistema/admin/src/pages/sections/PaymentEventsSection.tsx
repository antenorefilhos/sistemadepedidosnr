import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  CreditCard,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  Webhook,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  integrationsAPI,
  getApiErrorMessage,
  type PaymentTransactionLedgerItem,
  type PaymentEventLedgerItem,
  type PaymentsHealthResponse,
  type WebhookEvent,
} from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  CAPTURED: 'Capturado',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Reembolsado',
  CHARGEBACK: 'Chargeback',
  CANCELLED: 'Cancelado',
}

const TX_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-transparent',
  AUTHORIZED: 'bg-blue-50 text-blue-700 border-transparent',
  CAPTURED: 'bg-sky-50 text-sky-700 border-transparent',
  PAID: 'bg-emerald-50 text-emerald-700 border-transparent',
  FAILED: 'bg-red-50 text-red-700 border-transparent',
  REFUNDED: 'bg-slate-100 text-slate-600 border-transparent',
  CHARGEBACK: 'bg-orange-50 text-orange-700 border-transparent',
  CANCELLED: 'bg-slate-100 text-slate-500 border-transparent',
}

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'charge.authorized': 'Cobranca autorizada',
  'payment.authorized': 'Pagamento autorizado',
  'charge.captured': 'Cobranca capturada',
  'payment.captured': 'Pagamento capturado',
  'charge.paid': 'Cobranca paga',
  'payment.paid': 'Pagamento confirmado',
  'charge.failed': 'Cobranca falhou',
  'payment.failed': 'Pagamento falhou',
  'charge.refunded': 'Cobranca reembolsada',
  'payment.refunded': 'Pagamento reembolsado',
  'charge.chargeback': 'Chargeback',
  'payment.chargeback': 'Chargeback de pagamento',
}

const METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartao de Credito',
  DEBIT_CARD: 'Cartao de Debito',
  CASH: 'Dinheiro',
  BOLETO: 'Boleto',
  MANUAL: 'Manual',
}

const PROVIDER_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  MERCADO_PAGO: 'Mercado Pago',
  STRIPE: 'Stripe',
  PAGSEGURO: 'PagSeguro',
}

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function HealthStatusCard({ health }: { health: PaymentsHealthResponse }) {
  const isReady = health.status === 'ready'
  const isPartial = health.status === 'partial'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Saude da Integracao</h3>
        <Badge
          variant="secondary"
          className={`text-[10px] font-bold uppercase tracking-wide ${
            isReady
              ? 'bg-emerald-50 text-emerald-700'
              : isPartial
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
          }`}
        >
          {isReady ? 'Pronto' : isPartial ? 'Parcial' : 'Nao configurado'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {Object.entries(health.checks).map(([key, ok]) => (
          <div
            key={key}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${
              ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {ok ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
            <span className="font-medium capitalize">
              {key === 'providerName'
                ? 'Provider'
                : key === 'providerUrl'
                  ? 'URL'
                  : key === 'webhookSecret'
                    ? 'Webhook'
                    : key === 'pixKey'
                      ? 'Chave PIX'
                      : key === 'manualPixFallback'
                        ? 'Fallback PIX'
                        : key}
            </span>
          </div>
        ))}
      </div>
      {health.notes && <p className="text-xs text-gray-500">{health.notes}</p>}
    </div>
  )
}

function EventRow({ event }: { event: PaymentEventLedgerItem }) {
  return (
    <TableRow className="text-xs">
      <TableCell className="font-mono text-[11px] text-gray-500">{event.id.slice(-8)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {event.signatureOk ? (
            <BadgeCheck size={13} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={13} className="text-amber-500" />
          )}
          <span className="font-medium">{event.type}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-[10px] ${
            event.signatureOk
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {event.signatureOk ? 'Assinatura OK' : 'Sem assinatura'}
        </Badge>
      </TableCell>
      <TableCell className="text-gray-500">
        {event.providerEventId ?? '-'}
      </TableCell>
      <TableCell className="text-gray-500 text-right">
        {new Date(event.receivedAt).toLocaleString('pt-BR')}
      </TableCell>
    </TableRow>
  )
}

function TransactionRow({
  tx,
  expanded,
  onToggle,
}: {
  tx: PaymentTransactionLedgerItem
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-[#fffafc] transition-colors"
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
      >
        <TableCell className="w-8">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </TableCell>
        <TableCell className="font-mono text-xs">{tx.id.slice(-8).toUpperCase()}</TableCell>
        <TableCell className="font-mono text-xs text-gray-500">{tx.orderId.slice(-8).toUpperCase()}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-700">
            {PROVIDER_LABELS[tx.provider] ?? tx.provider}
          </Badge>
        </TableCell>
        <TableCell>{METHOD_LABELS[tx.method] ?? tx.method}</TableCell>
        <TableCell>
          <Badge variant="secondary" className={`text-[10px] font-bold ${TX_STATUS_CLASSES[tx.status] ?? ''}`}>
            {TX_STATUS_LABELS[tx.status] ?? tx.status}
          </Badge>
        </TableCell>
        <TableCell className="font-semibold text-right">{formatCurrency(tx.amount)}</TableCell>
        <TableCell className="text-xs text-gray-500 text-right">
          {new Date(tx.createdAt).toLocaleString('pt-BR')}
        </TableCell>
      </TableRow>
      {expanded && tx.events && tx.events.length > 0 && (
        <TableRow>
          <TableCell colSpan={8} className="bg-gray-50 p-0">
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                Eventos da transacao ({tx.events.length})
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Assinatura</TableHead>
                    <TableHead>Provider Event</TableHead>
                    <TableHead className="text-right">Recebido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tx.events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </TableBody>
              </Table>
              {tx.refunds && tx.refunds.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Reembolsos ({tx.refunds.length})
                  </p>
                  {tx.refunds.map((refund) => (
                    <div key={refund.id} className="flex items-center gap-3 text-xs py-1">
                      <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                        {refund.status}
                      </Badge>
                      <span className="font-semibold">{formatCurrency(refund.amount)}</span>
                      <span className="text-gray-500">{refund.reason}</span>
                      <span className="text-gray-400 ml-auto">
                        {new Date(refund.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {expanded && (!tx.events || tx.events.length === 0) && (
        <TableRow>
          <TableCell colSpan={8} className="bg-gray-50 text-center text-xs text-gray-500 py-4">
            Nenhum evento registrado para esta transacao.
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function WebhookEventRow({ event }: { event: WebhookEvent }) {
  return (
    <TableRow className="text-xs">
      <TableCell className="font-mono text-[11px] text-gray-500">{event.id.slice(-8)}</TableCell>
      <TableCell className="font-mono text-[11px]">{event.chargeId?.slice(-8) ?? '-'}</TableCell>
      <TableCell>
        <span className="font-medium">
          {WEBHOOK_EVENT_LABELS[event.event ?? ''] ?? event.event ?? '-'}
        </span>
      </TableCell>
      <TableCell className="font-mono text-[11px] text-gray-500">
        {event.orderId?.slice(-8) ?? '-'}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={`text-[10px] font-bold ${TX_STATUS_CLASSES[event.mappedStatus ?? event.status ?? ''] ?? ''}`}>
          {TX_STATUS_LABELS[event.mappedStatus ?? event.status ?? ''] ?? event.mappedStatus ?? event.status ?? '-'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {event.amount != null ? formatCurrency(event.amount) : '-'}
      </TableCell>
      <TableCell className="text-gray-500 text-right">
        {event.paidAt ? new Date(event.paidAt).toLocaleString('pt-BR') : '-'}
      </TableCell>
      <TableCell className="text-gray-400 text-right">
        {new Date(event.createdAt).toLocaleString('pt-BR')}
      </TableCell>
    </TableRow>
  )
}

export default function PaymentEventsSection() {
  const [health, setHealth] = useState<PaymentsHealthResponse | null>(null)
  const [transactions, setTransactions] = useState<PaymentTransactionLedgerItem[]>([])
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [orderFilter, setOrderFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'transactions' | 'webhooks'>('transactions')

  const loadHealth = useCallback(async () => {
    try {
      const res = await integrationsAPI.getPaymentsHealth()
      setHealth(res.data)
    } catch {
      setHealth(null)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: 50 }
      if (statusFilter) params.status = statusFilter
      if (orderFilter) params.orderId = orderFilter
      const res = await integrationsAPI.listPaymentTransactions(params as { orderId?: string; status?: string; limit?: number })
      setTransactions(res.data.items)
      setTxTotal(res.data.total)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }, [statusFilter, orderFilter])

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await integrationsAPI.listWebhookEvents(50)
      setWebhookEvents(res.data.items)
    } catch {
      setWebhookEvents([])
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    await Promise.all([loadHealth(), loadTransactions(), loadWebhooks()])
    setLoading(false)
  }, [loadHealth, loadTransactions, loadWebhooks])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const metrics = useMemo(() => {
    const paid = transactions.filter((t) => t.status === 'PAID').length
    const pending = transactions.filter((t) => t.status === 'PENDING' || t.status === 'AUTHORIZED').length
    const failed = transactions.filter((t) => t.status === 'FAILED').length
    const refunded = transactions.filter((t) => t.status === 'REFUNDED' || t.status === 'CHARGEBACK').length
    return { paid, pending, failed, refunded }
  }, [transactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Carregando eventos de pagamento...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="bg-gradient-to-r from-[#4a0622] via-[#5D082A] to-[#7b1240] text-white rounded-lg p-5 shadow-[0_18px_55px_rgba(74,6,34,0.25)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#f4d8e4] font-semibold">
              Eventos de Pagamento
            </p>
            <h2 className="text-2xl md:text-3xl font-black leading-tight">Pagamentos</h2>
            <p className="text-sm text-[#fdebf2] max-w-2xl">
              Transacoes, webhooks e eventos do gateway de pagamento com trilha completa de auditoria.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={loadAll}
              className="text-white hover:bg-white/10"
              aria-label="Atualizar"
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SectionMetric label="Pagos" value={metrics.paid} tone="success" />
        <SectionMetric label="Pendentes" value={metrics.pending} tone="brand" />
        <SectionMetric label="Falhos" value={metrics.failed} />
        <SectionMetric label="Reembolsados" value={metrics.refunded} tone="neutral" />
      </div>

      {health && <HealthStatusCard health={health} />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('transactions')}
          aria-pressed={activeTab === 'transactions'}
          className={`h-auto gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'bg-white text-[#5D082A] shadow-sm hover:bg-white hover:text-[#5D082A]'
              : 'text-gray-600 hover:bg-transparent hover:text-gray-800'
          }`}
        >
          <CreditCard size={15} />
          Transacoes
          <Badge variant="secondary" className="ml-1 text-[10px] bg-gray-200 text-gray-700">
            {txTotal}
          </Badge>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('webhooks')}
          aria-pressed={activeTab === 'webhooks'}
          className={`h-auto gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'bg-white text-[#5D082A] shadow-sm hover:bg-white hover:text-[#5D082A]'
              : 'text-gray-600 hover:bg-transparent hover:text-gray-800'
          }`}
        >
          <Webhook size={15} />
          Webhooks
          <Badge variant="secondary" className="ml-1 text-[10px] bg-gray-200 text-gray-700">
            {webhookEvents.length}
          </Badge>
        </Button>
      </div>

      {activeTab === 'transactions' && (
        <>
          <SectionToolbar>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Filtrar por ID do pedido..."
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="max-w-xs"
                  aria-label="Filtrar por ID do pedido"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                <option value="PENDING">Pendente</option>
                <option value="AUTHORIZED">Autorizado</option>
                <option value="PAID">Pago</option>
                <option value="FAILED">Falhou</option>
                <option value="REFUNDED">Reembolsado</option>
                <option value="CHARGEBACK">Chargeback</option>
              </Select>
            </div>
          </SectionToolbar>

          <SectionPanel bodyClassName="overflow-x-auto">
            {transactions.length === 0 ? (
              <SectionEmptyState
                title="Nenhuma transacao encontrada"
                description="As transacoes de pagamento aparecerao aqui quando o gateway estiver ativo e processando pedidos."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-8" />
                    <TableHead>ID</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      expanded={expandedTxId === tx.id}
                      onToggle={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionPanel>
        </>
      )}

      {activeTab === 'webhooks' && (
        <SectionPanel bodyClassName="overflow-x-auto">
          {webhookEvents.length === 0 ? (
            <SectionEmptyState
              title="Nenhum webhook recebido"
              description="Os eventos de webhook do gateway de pagamento aparecerao aqui quando forem recebidos."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>ID</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Pago em</TableHead>
                  <TableHead className="text-right">Recebido em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhookEvents.map((event) => (
                  <WebhookEventRow key={event.id} event={event} />
                ))}
              </TableBody>
            </Table>
          )}
        </SectionPanel>
      )}
    </div>
  )
}
