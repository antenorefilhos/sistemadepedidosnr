import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, LogOut, Filter, X, Inbox, Package, ChevronRight, Clock } from 'lucide-react'
import { pickerApi, Order } from '../services/api'
import { getOrderPdvCode, hasPdvCode } from '../utils/orderCode'
import { AvisoPush } from '../components/AvisoPush'
import toast from 'react-hot-toast'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PICKING_PENDING: 'Aguardando',
  PICKING: 'Separando',
  CONFERENCE_PENDING: 'Separado',
  PACKING: 'Embalando',
  READY_FOR_CHECKOUT: 'No Caixa',
  READY_FOR_DELIVERY: 'Pronto Entrega',
  READY_FOR_PICKUP: 'Pronto Retirada',
  OUT_FOR_DELIVERY: 'Em Entrega',
  DELIVERED: 'Entregue',
  FAILED_DELIVERY: 'Entrega Falhou',
  COMPLETED: 'Concluido',
  CANCELLED: 'Cancelado',
  // Faltavam: sem eles a tela mostrava o valor cru do banco em ingles
  // (o uso e `STATUS_LABEL[status] || status`).
  PENDING_APPROVAL: 'Aguardando aprovacao',
  REFUNDED: 'Reembolsado',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PICKING_PENDING: 'bg-amber-100 text-amber-800',
  PICKING: 'bg-orange-100 text-orange-800',
  CONFERENCE_PENDING: 'bg-purple-100 text-purple-800',
  READY_FOR_CHECKOUT: 'bg-green-100 text-green-800',
  READY_FOR_DELIVERY: 'bg-teal-100 text-teal-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-700',
  FAILED_DELIVERY: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const FILTER_STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PICKING_PENDING', label: 'Aguardando' },
  { value: 'PICKING', label: 'Separando' },
  { value: 'CONFERENCE_PENDING', label: 'Separado' },
  { value: 'READY_FOR_CHECKOUT', label: 'No Caixa' },
]

export default function OrderList({
  userName,
  onSelectOrder,
  onLogout,
}: {
  userName: string
  onSelectOrder: (id: string) => void
  onLogout: () => void
}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await pickerApi.searchOrders({
        q: search || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setOrders(data)
    } catch {
      toast.error('Erro ao buscar pedidos')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    const timer = setTimeout(fetchOrders, 300)
    return () => clearTimeout(timer)
  }, [fetchOrders])

  const hasActiveFilters = statusFilter || dateFrom || dateTo

  return (
    <div className="flex flex-col h-full">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p className="text-white/60 text-xs">Separador</p>
            <p className="font-semibold truncate">{userName}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchOrders} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Codigo, nome, CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:border-white/50 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border border-white/20 active:bg-white/10 ${hasActiveFilters ? 'bg-white/20' : ''}`}
          >
            <Filter size={16} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === s.value
                      ? 'bg-white text-brand-600'
                      : 'bg-white/10 text-white/80 active:bg-white/20'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg bg-white/10 text-white text-xs border border-white/20 focus:outline-none"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg bg-white/10 text-white text-xs border border-white/20 focus:outline-none"
              />
              {hasActiveFilters && (
                <button
                  onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 active:bg-white/20"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <AvisoPush />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw size={24} className="animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Inbox size={32} />
            <p className="text-sm">Nenhum pedido encontrado</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onTap={() => onSelectOrder(order.id)} />
          ))
        )}
      </div>
    </div>
  )
}

function OrderCard({ order, onTap }: { order: Order; onTap: () => void }) {
  const itemCount = order.items.length
  const pickedCount = order.items.filter((i) => ['PICKED', 'SUBSTITUTED'].includes(i.status)).length
  const isInProgress = ['PICKING', 'PICKING_PENDING'].includes(order.status)
  const isSeparated = ['CONFERENCE_PENDING', 'PACKING', 'READY_FOR_CHECKOUT'].includes(order.status)

  return (
    <button
      onClick={onTap}
      className="w-full bg-white rounded-xl p-4 text-left active:scale-[0.99] transition-transform shadow-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{order.customer?.name || 'Cliente'}</p>
          <p className="text-xs font-mono">
            {hasPdvCode(order) ? (
              <span className="text-gray-900 font-semibold">DAV {getOrderPdvCode(order)}</span>
            ) : (
              <span className="text-gray-500">#{getOrderPdvCode(order)} · sem DAV</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Package size={12} />
          {isInProgress || isSeparated ? `${pickedCount}/${itemCount}` : `${itemCount} itens`}
        </span>
        <span>R$ {order.total?.toFixed(2)}</span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {isInProgress && (
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${itemCount > 0 ? (pickedCount / itemCount) * 100 : 0}%` }}
          />
        </div>
      )}
    </button>
  )
}
