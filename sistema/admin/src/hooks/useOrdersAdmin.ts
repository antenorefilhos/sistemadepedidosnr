import { useCallback, useEffect, useMemo, useState } from 'react'
import { ordersAPI, getApiErrorMessage, type AdminOrder } from '../services/api'

export type OrderFeedback = {
  tone: 'error'
  title: string
}

export const ORDER_STATUS_OPTIONS = [
  'PENDING',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'PICKING_PENDING',
  'PICKING',
  'WAITING_CUSTOMER_SUBSTITUTION',
  'CONFERENCE_PENDING',
  'PACKING',
  'READY_FOR_CHECKOUT',
  'READY_FOR_PICKUP',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'PARTIALLY_CANCELLED',
  'CANCELLED',
  'REFUNDED',
  'FAILED_SYNC',
] as const

export const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUS_OPTIONS)[number], string> = {
  PENDING: 'Pendente',
  PAYMENT_PENDING: 'Pagamento pendente',
  CONFIRMED: 'Confirmado',
  PICKING_PENDING: 'Separação pendente',
  PICKING: 'Em separação',
  WAITING_CUSTOMER_SUBSTITUTION: 'Aguardando substituição',
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
  FAILED_SYNC: 'Falha de sincronização',
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Não pago',
  PENDING: 'Pendente',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Estornado',
}
export const getPaymentStatusClassName = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-800'
    case 'FAILED':
      return 'bg-red-100 text-red-800'
    case 'REFUNDED':
      return 'bg-slate-200 text-slate-800'
    case 'PENDING':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

/** Todo o estado e logica de negocio da aba Pedidos do admin -- extraido de
 * AdminDashboard (JON-65, Auditoria 360) pra tirar o arquivo de 1147 linhas. */
export function useOrdersAdmin(activeSection: string) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('')
  const [ordersDateFilter, setOrdersDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [ordersPaymentFilter, setOrdersPaymentFilter] = useState('')
  const [ordersChangeFilter, setOrdersChangeFilter] = useState<'ALL' | 'WITH_CHANGE' | 'WITHOUT_CHANGE'>('ALL')
  const [ordersViewMode, setOrdersViewMode] = useState<'list' | 'kanban'>('list')
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false)
  const [orderFeedback, setOrderFeedback] = useState<OrderFeedback | null>(null)
  const [ordersAutoRefresh, setOrdersAutoRefresh] = useState(false)

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true)
      const res = await ordersAPI.getAll()
      setOrders(res.data)
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSection === 'orders') loadOrders()
  }, [activeSection, loadOrders])

  useEffect(() => {
    if (!ordersAutoRefresh || activeSection !== 'orders') return
    const id = setInterval(loadOrders, 30_000)
    return () => clearInterval(id)
  }, [ordersAutoRefresh, activeSection, loadOrders])

  const handleUpdateOrderStatus = async (orderId: string, status: string, reason?: string) => {
    try {
      setOrderFeedback(null)
      setUpdatingOrderStatus(true)
      await ordersAPI.updateStatus(orderId, status, reason)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status, ...(reason && { cancellationReason: reason }) } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder((prev) => prev ? { ...prev, status, ...(reason && { cancellationReason: reason }) } : prev)
    } catch (error: any) {
      setOrderFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar status'),
      })
    } finally {
      setUpdatingOrderStatus(false)
    }
  }

  const handleUpdateOrder = async (orderId: string, data: { paymentStatus?: string; paymentMethod?: string }) => {
    try {
      setOrderFeedback(null)
      setUpdatingOrderStatus(true)
      await ordersAPI.update(orderId, data)
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...data } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder((prev) => prev ? { ...prev, ...data } : prev)
    } catch (error: any) {
      setOrderFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar dados do pedido'),
      })
    } finally {
      setUpdatingOrderStatus(false)
    }
  }

  const openOrderDetails = async (order: AdminOrder | null) => {
    if (!order) {
      setSelectedOrder(null)
      setOrderFeedback(null)
      return
    }

    setOrderFeedback(null)
    try {
      const response = await ordersAPI.getOne(order.id)
      setSelectedOrder(response.data)
    } catch {
      setSelectedOrder(order)
    }
  }

  const filteredOrders = useMemo(() => {
    const now = Date.now()
    return orders.filter((order) => {
      const haystack = `${order.customer?.name || ''} ${order.id}`.toLowerCase()
      const matchesSearch = !ordersSearch.trim() || haystack.includes(ordersSearch.toLowerCase())
      if (!matchesSearch) return false

      const matchesStatus = !ordersStatusFilter || order.status === ordersStatusFilter
      if (!matchesStatus) return false

      const payment = (order.paymentMethod || '').toUpperCase()
      const paymentFilter = ordersPaymentFilter.toUpperCase()
      const matchesPayment = !paymentFilter || payment === paymentFilter
      if (!matchesPayment) return false

      const hasChange = /Troco\s+para:/i.test(String(order.notes || ''))
      if (ordersChangeFilter === 'WITH_CHANGE' && !hasChange) return false
      if (ordersChangeFilter === 'WITHOUT_CHANGE' && hasChange) return false

      if (ordersDateFilter === 'all') return true
      const orderTime = new Date(order.createdAt).getTime()
      if (Number.isNaN(orderTime)) return false
      if (ordersDateFilter === 'today') {
        const date = new Date(orderTime)
        const current = new Date()
        return date.toDateString() === current.toDateString()
      }
      if (ordersDateFilter === '7d') return now - orderTime <= 7 * 24 * 60 * 60 * 1000
      if (ordersDateFilter === '30d') return now - orderTime <= 30 * 24 * 60 * 60 * 1000
      return true
    })
  }, [orders, ordersSearch, ordersStatusFilter, ordersDateFilter, ordersPaymentFilter, ordersChangeFilter])

  return {
    orders, ordersLoading, ordersSearch, setOrdersSearch,
    ordersStatusFilter, setOrdersStatusFilter,
    ordersDateFilter, setOrdersDateFilter,
    ordersPaymentFilter, setOrdersPaymentFilter,
    ordersChangeFilter, setOrdersChangeFilter,
    ordersViewMode, setOrdersViewMode,
    draggingOrderId, setDraggingOrderId,
    selectedOrder, setSelectedOrder,
    updatingOrderStatus, orderFeedback, setOrderFeedback,
    ordersAutoRefresh, setOrdersAutoRefresh,
    loadOrders, handleUpdateOrderStatus, handleUpdateOrder, openOrderDetails,
    filteredOrders,
  }
}
