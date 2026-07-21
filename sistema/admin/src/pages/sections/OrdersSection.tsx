import { Columns, Download, Eye, LayoutList, RefreshCw, Search, X, Filter, Banknote, QrCode, CreditCard, ChevronDown, AlertTriangle } from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminOrder } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

function exportOrdersCSV(orders: AdminOrder[]) {
  const header = ['ID', 'Cliente', 'WhatsApp', 'Data', 'Status', 'Pagamento', 'Total']
  const rows = orders.map((o) => [
    o.id.slice(-8).toUpperCase(),
    o.customer?.name ?? '',
    o.customer?.whatsapp ?? '',
    new Date(o.createdAt).toLocaleDateString('pt-BR'),
    o.status,
    o.paymentMethod ?? '',
    o.total.toFixed(2).replace('.', ','),
  ])
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_TIMELINE = ['PENDING', 'CONFIRMED', 'PICKING', 'CONFERENCE_PENDING', 'PACKING', 'READY_FOR_DELIVERY', 'COMPLETED'] as const
const STATUS_TIMELINE_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PICKING: 'Separacao',
  CONFERENCE_PENDING: 'Conferencia',
  PACKING: 'Embalagem',
  READY_FOR_PICKUP: 'Pronto retirada',
  READY_FOR_DELIVERY: 'Pronto entrega',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

function OrderStatusTimeline({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
        <span className="text-sm font-semibold text-red-700">Cancelado</span>
      </div>
    )
  }
  const currentIdx = STATUS_TIMELINE.indexOf(currentStatus as typeof STATUS_TIMELINE[number])
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STATUS_TIMELINE.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${
              active ? 'bg-[#5D082A] text-white' : done ? 'bg-[#F8F0DC] text-[#5D082A]' : 'bg-gray-100 text-gray-400'
            }`}>
              {done && <span>✓</span>}
              {STATUS_TIMELINE_LABEL[step]}
            </div>
            {i < STATUS_TIMELINE.length - 1 && <span className={`text-xs ${done ? 'text-[#5D082A]' : 'text-gray-300'}`}>→</span>}
          </div>
        )
      })}
    </div>
  )
}

type OrdersDateFilter = 'all' | 'today' | '7d' | '30d'
type OrdersChangeFilter = 'ALL' | 'WITH_CHANGE' | 'WITHOUT_CHANGE'
type OrderFeedback = {
  tone: 'error'
  title: string
}

function parseChangeForFromNotes(notes?: string | null): number | null {
  const text = String(notes || '')
  const match = text.match(/Troco\s+para:\s*([0-9]+(?:[.,][0-9]{1,2})?)/i)
  if (!match) return null
  const normalized = match[1].replace('.', '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getOrderAgeMinutes(order: AdminOrder) {
  return Math.max(0, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000))
}

function getOrderSlaView(order: AdminOrder) {
  const age = getOrderAgeMinutes(order)
  const status = String(order.status || '').toUpperCase()
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(status)) {
    return { label: 'Encerrado', className: 'border-slate-200 bg-slate-50 text-slate-600' }
  }
  if (status === 'FAILED_SYNC' || age >= 90) {
    return { label: age >= 90 ? `Critico ${age} min` : 'Falha integracao', className: 'border-red-200 bg-red-50 text-red-800' }
  }
  if (status === 'WAITING_CUSTOMER_SUBSTITUTION' || age >= 45) {
    return { label: age >= 45 ? `Atencao ${age} min` : 'Substituicao', className: 'border-amber-200 bg-amber-50 text-amber-800' }
  }
  return { label: `${age} min`, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
}

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatQuantity(value?: number | string | null) {
  const parsed = toNumber(value)
  if (parsed === undefined) return '-'
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function getItemStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    PICKED: 'Separado',
    MISSING: 'Faltante',
    SUBSTITUTED: 'Substituido',
    CANCELLED: 'Cancelado',
  }
  return labels[status || ''] || status || 'Pendente'
}

function getPaymentMethodLabel(method?: string | null) {
  const key = String(method || '').toUpperCase()
  if (key === 'PIX') return 'PIX'
  if (['CARD', 'CARD_ON_DELIVERY', 'CARTAO', 'CARTAO_ENTREGA'].includes(key)) return 'Cartão (na entrega)'
  if (['CASH', 'DINHEIRO', 'MONEY'].includes(key)) return 'Dinheiro'
  return method || '—'
}

function getPaymentMethodIcon(method?: string | null) {
  const key = String(method || '').toUpperCase()
  if (key === 'PIX') return <QrCode size={13} className="text-[#5D082A] shrink-0" />
  if (['CARD', 'CARD_ON_DELIVERY', 'CARTAO', 'CARTAO_ENTREGA'].includes(key)) return <CreditCard size={13} className="text-[#5D082A] shrink-0" />
  return <Banknote size={13} className="text-[#5D082A] shrink-0" />
}

type Props = {
  ordersSearch: string
  onOrdersSearchChange: (value: string) => void
  ordersStatusFilter: string
  onOrdersStatusFilterChange: (value: string) => void
  ordersDateFilter: OrdersDateFilter
  onOrdersDateFilterChange: (value: OrdersDateFilter) => void
  ordersPaymentFilter: string
  onOrdersPaymentFilterChange: (value: string) => void
  ordersChangeFilter: OrdersChangeFilter
  onOrdersChangeFilterChange: (value: OrdersChangeFilter) => void
  ordersViewMode: 'list' | 'kanban'
  onOrdersViewModeChange: (value: 'list' | 'kanban') => void
  onReloadOrders: () => void
  ordersLoading: boolean
  filteredOrders: AdminOrder[]
  orderStatusOptions: readonly string[]
  orderStatusLabels: Record<string, string>
  updatingOrderStatus: boolean
  onUpdateOrderStatus: (orderId: string, status: string, reason?: string) => Promise<void>
  onUpdateOrder: (orderId: string, data: { paymentStatus?: string; paymentMethod?: string }) => Promise<void>
  orderFeedback: OrderFeedback | null
  onDismissOrderFeedback: () => void
  onSelectOrder: (order: AdminOrder | null) => void | Promise<void>
  draggingOrderId: string | null
  onDraggingOrderIdChange: (value: string | null) => void
  selectedOrder: AdminOrder | null
  paymentStatusLabels: Record<string, string>
  getPaymentStatusClassName: (status?: string) => string
  renderWhatsAppBadge: (phone?: string, compact?: boolean) => ReactNode
}

export default function OrdersSection({
  ordersSearch,
  onOrdersSearchChange,
  ordersStatusFilter,
  onOrdersStatusFilterChange,
  ordersDateFilter,
  onOrdersDateFilterChange,
  ordersPaymentFilter,
  onOrdersPaymentFilterChange,
  ordersChangeFilter,
  onOrdersChangeFilterChange,
  ordersViewMode,
  onOrdersViewModeChange,
  onReloadOrders,
  ordersLoading,
  filteredOrders,
  orderStatusOptions,
  orderStatusLabels,
  updatingOrderStatus,
  onUpdateOrderStatus,
  onUpdateOrder,
  orderFeedback,
  onDismissOrderFeedback,
  onSelectOrder,
  draggingOrderId,
  onDraggingOrderIdChange,
  selectedOrder,
  paymentStatusLabels,
  getPaymentStatusClassName,
  renderWhatsAppBadge,
}: Props) {
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [showCancellationReason, setShowCancellationReason] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectOrder(null)
    }
    if (selectedOrder) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedOrder, onSelectOrder])

  useEffect(() => {
    setCancellationReason('')
    setShowCancellationReason(false)
  }, [selectedOrder?.id])

  // Calculations for KPIs
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0)
  const avgTicket = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0
  const withChangeOrders = filteredOrders.filter((order) => parseChangeForFromNotes(order.notes) != null).length

  const activeFilterCount = [
    ordersStatusFilter,
    ordersDateFilter !== 'all' ? ordersDateFilter : '',
    ordersPaymentFilter,
    ordersChangeFilter !== 'ALL' ? ordersChangeFilter : '',
  ].filter(Boolean).length

  const getStatusSelectClassName = (status: string) => {
    const base = "px-2.5 py-1.5 rounded-xl text-xs font-bold border-0 outline-none cursor-pointer transition-colors duration-150 "
    switch (status) {
      case 'PENDING':
        return base + "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
      case 'CONFIRMED':
        return base + "bg-blue-50 text-blue-700 hover:bg-blue-100"
      case 'DELIVERED':
        return base + "bg-purple-50 text-purple-700 hover:bg-purple-100"
      case 'COMPLETED':
        return base + "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      case 'CANCELLED':
        return base + "bg-red-50 text-red-700 hover:bg-red-100"
      default:
        return base + "bg-gray-50 text-gray-700 hover:bg-gray-100"
    }
  }

  return (
    <>
      <div className="space-y-6">
      {orderFeedback && !selectedOrder && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-700" />
            <p className="font-bold">{orderFeedback.title}</p>
          </div>
          <Button
            type="button"
            onClick={onDismissOrderFeedback}
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-red-700 hover:bg-red-100"
            aria-label="Dispensar aviso de pedidos"
          >
            <X size={15} />
          </Button>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SectionMetric label="Pedidos filtrados" value={filteredOrders.length} tone="brand" />
        <SectionMetric label="Faturamento" value={formatMoney(totalRevenue)} tone="success" />
        <SectionMetric label="Ticket Médio" value={formatMoney(avgTicket)} tone="neutral" />
        <SectionMetric label="Com troco" value={withChangeOrders} tone="neutral" />
      </div>

      {/* Toolbar */}
      <SectionToolbar>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente ou ID..."
                  value={ordersSearch}
                  onChange={(e) => onOrdersSearchChange(e.target.value)}
                  className="h-11 rounded-xl border-[#ead7df] bg-white pl-10 pr-4 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
                />
              </div>

              {/* Botão de Filtrar */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilterBar(!showFilterBar)}
                className={`min-h-11 rounded-xl px-4 text-sm ${
                  showFilterBar || activeFilterCount > 0
                    ? 'border-[#5d082a] bg-[#fff7fa] text-[#5d082a]'
                    : 'border-[#ead7df] bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter size={16} />
                <span>Filtrar</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#5d082a] text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* Modo de visualização */}
              <div className="flex overflow-hidden rounded-xl border border-[#ead7df] bg-white p-1">
                <Button
                  type="button"
                  onClick={() => onOrdersViewModeChange('list')}
                  variant={ordersViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={`min-h-[36px] rounded-lg px-3 text-xs ${
                    ordersViewMode === 'list' ? 'bg-[#5d082a] text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <LayoutList size={14} />
                  Lista
                </Button>
                <Button
                  type="button"
                  onClick={() => onOrdersViewModeChange('kanban')}
                  variant={ordersViewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className={`min-h-[36px] rounded-lg px-3 text-xs ${
                    ordersViewMode === 'kanban' ? 'bg-[#5d082a] text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Columns size={14} />
                  Kanban
                </Button>
              </div>

              {/* Ações */}
              <Button type="button" onClick={onReloadOrders} variant="outline" className="min-h-11 rounded-xl border-[#ead7df] bg-white px-4 text-sm text-gray-700 hover:bg-gray-50">
                <RefreshCw size={14} />
                <span>Atualizar</span>
              </Button>
              {filteredOrders.length > 0 && (
                <Button
                  type="button"
                  onClick={() => exportOrdersCSV(filteredOrders)}
                  variant="outline"
                  className="min-h-11 rounded-xl border-[#ead7df] bg-white px-4 text-sm text-gray-700 hover:bg-gray-50"
                  title="Exportar pedidos filtrados como CSV"
                >
                  <Download size={14} />
                  <span>CSV</span>
                </Button>
              )}
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f1dbe3]/60">
              {ordersStatusFilter && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Status: {orderStatusLabels[ordersStatusFilter] || ordersStatusFilter}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onOrdersStatusFilterChange('')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de status"><X size={12} /></Button>
                </Badge>
              )}
              {ordersDateFilter !== 'all' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Data: {ordersDateFilter === 'today' ? 'Hoje' : ordersDateFilter === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onOrdersDateFilterChange('all')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de data"><X size={12} /></Button>
                </Badge>
              )}
              {ordersPaymentFilter && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Pagamento: {getPaymentMethodLabel(ordersPaymentFilter)}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onOrdersPaymentFilterChange('')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de pagamento"><X size={12} /></Button>
                </Badge>
              )}
              {ordersChangeFilter !== 'ALL' && (
                <Badge variant="outline" className="rounded-lg border-[#f1dbe3] bg-[#fff7fa] px-2.5 py-1 text-xs font-semibold text-[#5d082a]">
                  Troco: {ordersChangeFilter === 'WITH_CHANGE' ? 'Com troco' : 'Sem troco'}
                  <Button type="button" variant="ghost" size="icon" onClick={() => onOrdersChangeFilterChange('ALL')} className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10 hover:text-[#3d041a]" aria-label="Limpar filtro de troco"><X size={12} /></Button>
                </Badge>
              )}
            </div>
          )}

          {/* Collapsible Advanced Filters Drawer */}
          {showFilterBar && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 border-t border-[#f1dbe3] pt-4 mt-4 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Status</label>
                <Select value={ordersStatusFilter} onChange={(e) => onOrdersStatusFilterChange(e.target.value)} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="">Todos os status</option>
                  {orderStatusOptions.map((status) => (
                    <option key={status} value={status}>{orderStatusLabels[status]}</option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Data do Pedido</label>
                <Select value={ordersDateFilter} onChange={(e) => onOrdersDateFilterChange(e.target.value as OrdersDateFilter)} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="all">Qualquer data</option>
                  <option value="today">Hoje</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Forma de Pagamento</label>
                <Select value={ordersPaymentFilter} onChange={(e) => onOrdersPaymentFilterChange(e.target.value)} className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20">
                  <option value="">Todas as formas</option>
                  <option value="PIX">PIX</option>
                  <option value="CARD">Cartão (na entrega)</option>
                  <option value="CASH">Dinheiro</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Troco</label>
                <Select
                  value={ordersChangeFilter}
                  onChange={(e) => onOrdersChangeFilterChange(e.target.value as OrdersChangeFilter)}
                  className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
                >
                  <option value="ALL">Todos</option>
                  <option value="WITH_CHANGE">Com troco</option>
                  <option value="WITHOUT_CHANGE">Sem troco</option>
                </Select>
              </div>
            </div>
          )}
        </div>
      </SectionToolbar>

      {/* Content View Mode */}
      {ordersViewMode === 'list' ? (
        <SectionPanel>
          {ordersLoading ? (
            <div className="p-6 text-gray-500">Carregando pedidos...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-6">
              <SectionEmptyState title="Nenhum pedido encontrado" description="Refine a busca ou ajuste os filtros para encontrar pedidos específicos." />
            </div>
          ) : (
            <Table className="min-w-full text-sm">
              <TableHeader className="border-b border-[#f1dbe3] bg-[#fff7fa] text-gray-600">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4 text-[#9e7080]">ID</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Cliente</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">WhatsApp</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Data</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">SLA</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Total</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Pagamento</TableHead>
                  <TableHead className="px-6 py-4 text-[#9e7080]">Status</TableHead>
                  <TableHead className="px-6 py-4 text-right text-[#9e7080]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#f3e4ea]">
                {filteredOrders.map((order) => {
                  const sla = getOrderSlaView(order)
                  return (
                  <TableRow key={order.id} className="group border-[#f3e4ea] transition-colors duration-150 hover:bg-[#fff8fb]">
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className="rounded-md border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs font-medium text-gray-600">
                        #{order.id.slice(-8).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 font-semibold text-gray-800">{order.customer?.name ?? '—'}</TableCell>
                    <TableCell className="px-6 py-4">{renderWhatsAppBadge(order.customer?.whatsapp)}</TableCell>
                    <TableCell className="px-6 py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[11px] font-black ${sla.className}`}>
                        {sla.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 font-bold text-[#5d082a]">R$ {order.total.toFixed(2)}</TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="flex flex-col gap-1.5">
                         <div className="flex items-center gap-1.5">
                           {getPaymentMethodIcon(order.paymentMethod)}
                           <span className="text-xs font-semibold text-gray-800">{getPaymentMethodLabel(order.paymentMethod)}</span>
                         </div>
                         <div className="flex flex-wrap gap-1">
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${getPaymentStatusClassName(order.paymentStatus)}`}>
                             {paymentStatusLabels[(order.paymentStatus || 'UNPAID').toUpperCase()] || order.paymentStatus || 'Não pago'}
                           </span>
                           {(() => {
                             const changeFor = parseChangeForFromNotes(order.notes)
                             if (changeFor == null) return null
                             return (
                               <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                 <Banknote size={10} className="mr-0.5 text-amber-700" />
                                 Troco: {formatMoney(changeFor)}
                                </Badge>
                             )
                           })()}
                         </div>
                       </div>
                     </TableCell>
                    <TableCell className="px-6 py-4">
                      <Select
                        value={order.status}
                        onChange={(e) => onUpdateOrderStatus(order.id, e.target.value)}
                        disabled={updatingOrderStatus}
                        className={getStatusSelectClassName(order.status)}
                      >
                        {orderStatusOptions.map((status) => (
                          <option key={status} value={status}>{orderStatusLabels[status]}</option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        variant="outline"
                        size="icon"
                        className="rounded-xl border-[#ead7df] text-gray-400 transition hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]"
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </SectionPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {orderStatusOptions.map((columnStatus) => {
            const columnOrders = filteredOrders.filter((order) => order.status === columnStatus)
            return (
              <div
                key={columnStatus}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  if (!draggingOrderId) return
                  const dragged = filteredOrders.find((order) => order.id === draggingOrderId)
                  if (!dragged || dragged.status === columnStatus) return
                  await onUpdateOrderStatus(draggingOrderId, columnStatus)
                  onDraggingOrderIdChange(null)
                }}
                className="min-h-[360px] rounded-[16px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] p-3 shadow-[0_18px_32px_rgba(93,8,42,0.08)] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3 border-b border-[#f1dbe3] pb-2">
                  <h3 className="text-sm font-bold text-gray-700">{orderStatusLabels[columnStatus]}</h3>
                  <Badge variant="secondary" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{columnOrders.length}</Badge>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
                  {columnOrders.map((order) => (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => onDraggingOrderIdChange(order.id)}
                      className="cursor-grab rounded-xl border border-[#f1dbe3] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge variant="outline" className="rounded-md border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500">
                            #{order.id.slice(-8).toUpperCase()}
                          </Badge>
                          <p className="text-xs font-bold text-gray-800 mt-1 truncate">{order.customer?.name || 'Sem cliente'}</p>
                        </div>
                        <Button type="button" onClick={() => onSelectOrder(order)} variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-lg border-[#ead7df] text-gray-400 hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]">
                          <Eye size={12} />
                        </Button>
                      </div>
                      <div className="mt-3 text-[11px] text-gray-500 space-y-1.5">
                        <p>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                        <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-black ${getOrderSlaView(order).className}`}>
                          {getOrderSlaView(order).label}
                        </Badge>
                        <p className="font-bold text-sm text-[#5d082a]">R$ {order.total.toFixed(2)}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${getPaymentStatusClassName(order.paymentStatus)}`}>
                            {paymentStatusLabels[(order.paymentStatus || 'UNPAID').toUpperCase()] || order.paymentStatus || 'Não pago'}
                          </span>
                          {order.paymentMethod && (
                            <Badge variant="secondary" className="gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {getPaymentMethodIcon(order.paymentMethod)}
                              {getPaymentMethodLabel(order.paymentMethod)}
                            </Badge>
                          )}
                          {(() => {
                            const changeFor = parseChangeForFromNotes(order.notes)
                            if (changeFor == null) return null
                            return (
                              <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                <Banknote size={10} className="mr-0.5 text-amber-700" />
                                Troco: {formatMoney(changeFor)}
                              </Badge>
                            )
                          })()}
                        </div>
                      </div>
                      {order.customer?.whatsapp && <div className="mt-2.5">{renderWhatsAppBadge(order.customer.whatsapp, true)}</div>}
                    </div>
                  ))}
                  {columnOrders.length === 0 && <p className="py-6 text-center text-xs text-gray-400">Sem pedidos</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      </div>

      {/* Slide-Over de Detalhes do Pedido */}
      {selectedOrder && (
        <>
          {/* Overlay */}
          <div
            onClick={() => onSelectOrder(null)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[6px] transition-opacity duration-300 opacity-100 pointer-events-auto"
          />

          {/* Centered Premium Modal Panel */}
          <div
            className="fixed left-1/2 top-1/2 z-50 flex w-[94vw] max-w-5xl h-[90vh] max-h-[800px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-[0_24px_60px_rgba(93,8,42,0.18)] border border-[#f1dbe3]/65 transition-all duration-300 ease-out scale-100 opacity-100 pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f1dbe3] bg-[linear-gradient(135deg,#fff7fa_0%,#fff_100%)] px-6 py-5 rounded-t-2xl">
              <div>
                <Badge variant="secondary" className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-600">
                  #{selectedOrder.id.slice(-8).toUpperCase()}
                </Badge>
                <h2 className="text-lg font-bold text-gray-900 mt-1">Detalhes do Pedido</h2>
              </div>
              <Button
                type="button"
                onClick={() => onSelectOrder(null)}
                variant="outline"
                size="icon"
                className="rounded-xl border-[#ead7df] text-gray-400 transition hover:border-[#5d082a] hover:bg-[#fff7fa] hover:text-[#5d082a]"
              >
                <X size={18} />
              </Button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              {orderFeedback && (
                <div role="alert" className="sticky top-0 z-30 mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-700" />
                    <p className="font-bold">{orderFeedback.title}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={onDismissOrderFeedback}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg text-red-700 hover:bg-red-100"
                    aria-label="Dispensar aviso de pedidos"
                  >
                    <X size={15} />
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Coluna Esquerda: Informações do Pedido (span 3) */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Timeline do Status */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Progresso do Status
                    </span>
                    <div className="pt-2">
                      <OrderStatusTimeline currentStatus={selectedOrder.status} />
                    </div>
                  </div>

                  {/* Ações Rápidas de Status */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Gerenciar Status
                    </span>
                    <div className="pt-2">
                      <Select
                        value={selectedOrder.status}
                        onChange={(e) => {
                          if (e.target.value === 'CANCELLED') {
                            setShowCancellationReason(true)
                          } else {
                            setShowCancellationReason(false)
                            setCancellationReason('')
                            onUpdateOrderStatus(selectedOrder.id, e.target.value)
                          }
                        }}
                        disabled={updatingOrderStatus}
                        className="h-11 rounded-xl border-[#ead7df] bg-white px-3 text-sm font-semibold text-gray-800 shadow-none focus-visible:ring-[#5d082a]/20"
                      >
                        {orderStatusOptions.map((status) => (
                          <option key={status} value={status}>{orderStatusLabels[status]}</option>
                        ))}
                      </Select>
                      {showCancellationReason && (
                        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3">
                          <label htmlFor="order-cancellation-reason" className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Motivo do cancelamento
                          </label>
                          <Input
                            id="order-cancellation-reason"
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            placeholder="Opcional"
                            className="mt-2 h-10 rounded-xl border-red-200 bg-white text-sm text-red-900 focus-visible:ring-red-200"
                          />
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCancellationReason('')
                                setShowCancellationReason(false)
                              }}
                              disabled={updatingOrderStatus}
                              className="rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                await onUpdateOrderStatus(selectedOrder.id, 'CANCELLED', cancellationReason.trim() || undefined)
                                setCancellationReason('')
                                setShowCancellationReason(false)
                              }}
                              disabled={updatingOrderStatus}
                              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
                            >
                              {updatingOrderStatus ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {(selectedOrder as AdminOrder & { cancellationReason?: string }).cancellationReason && (
                      <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-red-800 text-xs">
                        <span className="font-bold">Motivo do Cancelamento:</span> {(selectedOrder as AdminOrder & { cancellationReason?: string }).cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Itens do Pedido */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Itens Comprados
                    </span>
                    <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3.5 text-sm hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 pr-4">
                            <p className="font-semibold text-gray-800 truncate">{item.product?.name ?? item.productId}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="font-mono">Pedida: {formatQuantity(item.requestedQuantity ?? item.quantity)}</span>
                              <span className="font-mono">Final: {formatQuantity(item.fulfilledQuantity ?? item.quantity)}</span>
                              <Badge variant="secondary" className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">{getItemStatusLabel(item.status)}</Badge>
                            </div>
                            {item.cutReason && <p className="mt-1 text-xs text-red-700">{item.cutReason}</p>}
                          </div>
                          <span className="font-bold text-gray-700 shrink-0">
                            {formatMoney(toNumber(item.finalSubtotal) ?? item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Historico Operacional
                    </span>
                    <div className="space-y-3">
                      {(selectedOrder.events || []).slice().reverse().slice(0, 8).map((event) => (
                        <div key={event.id} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold text-gray-800">{event.type}</span>
                            <span className="text-gray-500">{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="mt-1 text-gray-500">{event.actorType}{event.actorId ? ` - ${event.actorId}` : ''}</div>
                        </div>
                      ))}
                      {(!selectedOrder.events || selectedOrder.events.length === 0) && (
                        <p className="text-xs text-gray-400">Sem eventos registrados.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Dados Financeiros, Pagamento e Cliente (span 2) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Cliente */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Dados do Cliente
                    </span>
                    <div className="text-sm pt-2">
                      <p className="font-bold text-gray-800">{selectedOrder.customer?.name ?? '—'}</p>
                      {selectedOrder.customer?.whatsapp && (
                        <div className="mt-2">
                          {renderWhatsAppBadge(selectedOrder.customer.whatsapp)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-3 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Resumo do Faturamento
                    </span>
                    <div className="space-y-2.5 text-sm pt-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span className="font-medium">R$ {selectedOrder.subtotal.toFixed(2)}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-red-600 font-medium">
                          <span>Desconto</span>
                          <span>-R$ {selectedOrder.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.delivery > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Frete</span>
                          <span className="font-medium">R$ {selectedOrder.delivery.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold text-gray-900 border-t border-slate-200/60 pt-2.5">
                        <span>Total</span>
                        <span className="text-[#5d082a]">{formatMoney(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pagamento */}
                  <div className="bg-white border border-[#ead7df] rounded-2xl p-5 space-y-4 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5d082a] block border-b border-[#f1dbe3]/60 pb-2">
                      Dados de Pagamento
                    </span>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Forma de Pagamento</label>
                        <div className="relative">
                          <Select
                            value={selectedOrder.paymentMethod || 'CASH'}
                            onChange={(e) => onUpdateOrder(selectedOrder.id, { paymentMethod: e.target.value })}
                            disabled={updatingOrderStatus}
                            className="h-11 rounded-xl border-[#ead7df] bg-white pl-3 pr-8 text-sm font-semibold text-gray-800 shadow-none focus-visible:ring-[#5d082a]/20"
                          >
                            <option value="CASH">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="CARD">Cartão na entrega</option>
                          </Select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                            <ChevronDown size={16} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Status do Pagamento</label>
                        <div className="relative">
                          <Select
                            value={selectedOrder.paymentStatus || 'UNPAID'}
                            onChange={(e) => onUpdateOrder(selectedOrder.id, { paymentStatus: e.target.value })}
                            disabled={updatingOrderStatus}
                            className="h-11 rounded-xl border-[#ead7df] bg-white pl-3 pr-8 text-sm font-semibold text-gray-800 shadow-none focus-visible:ring-[#5d082a]/20"
                          >
                            <option value="UNPAID">Não pago</option>
                            <option value="PENDING">Pendente</option>
                            <option value="PAID">Pago</option>
                            <option value="FAILED">Falhou</option>
                            <option value="REFUNDED">Estornado</option>
                          </Select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                            <ChevronDown size={16} />
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const changeFor = parseChangeForFromNotes(selectedOrder.notes)
                        if (changeFor == null) return null
                        return (
                          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 border border-amber-200">
                            <Banknote size={15} className="text-amber-700 shrink-0" />
                            <span>Troco para: <strong className="font-bold text-amber-900">{formatMoney(changeFor)}</strong></span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#f1dbe3] bg-white px-6 py-4 flex justify-end rounded-b-2xl">
              <Button
                type="button"
                onClick={() => onSelectOrder(null)}
                variant="outline"
                className="min-h-11 rounded-xl border-[#ead7df] px-6 text-sm text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
