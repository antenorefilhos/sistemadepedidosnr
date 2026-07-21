import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ordersAPI,
  customersAPI,
  productsAPI,
  integrationsAPI,
  getApiErrorMessage,
  type AdminProduct,
  type AdminOrder,
  type AdminCustomer,
  type ProductPayload,
  type SalesAnalyticsPoint,
  type StatusAnalyticsResponse,
  type RevenueAnalyticsResponse,
  type TopProductAnalyticsItem,
  type SolidcomStatusResponse,
  type MercadologicalTreeLevel1,
  type ProductAvailabilityMetricsResponse,
} from '../services/api'
import { BarChart3, Bot, Package, ShoppingCart, Users, LogOut, Menu, Sparkles, MessageCircle, Workflow, Tag, Truck, Image, Palette, Clock3, ShieldAlert, BellRing, ChefHat, ClipboardCheck, Briefcase, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DashboardAnalytics } from './types'

export type Section =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'picking'
  | 'businessAccounts'
  | 'customers'
  | 'layout'
  | 'categories'
  | 'deliveryZones'
  | 'businessHours'
  | 'fraudAudit'
  | 'notifications'
  | 'recipes'
  | 'storeBanners'
  | 'brandIdentity'
  | 'intelligence'
  | 'integrations'
  | 'payments'

type ProductFormState = {
  ean: string
  name: string
  titleMask: string
  titleMaskShort: string
  alternativeDescription: string
  classification01: string
  classification02: string
  classification03: string
  classification04: string
  price: string
  promotionalPrice: string
  stock: string
  unit: string
  badges: string
  origin: string
  videoUrl: string
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>
type ProductFeedback = {
  tone: 'success' | 'error'
  title: string
  description?: string
}
type OrderFeedback = {
  tone: 'error'
  title: string
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  ean: '',
  name: '',
  titleMask: '',
  titleMaskShort: '',
  alternativeDescription: '',
  classification01: '',
  classification02: '',
  classification03: '',
  classification04: '',
  price: '',
  promotionalPrice: '',
  stock: '',
  unit: 'un',
  badges: '',
  origin: '',
  videoUrl: '',
}

const ORDER_STATUS_OPTIONS = [
  'PENDING',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'PICKING_PENDING',
  'PICKING',
  'WAITING_CUSTOMER_SUBSTITUTION',
  'CONFERENCE_PENDING',
  'PACKING',
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

const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUS_OPTIONS)[number], string> = {
  PENDING: 'Pendente',
  PAYMENT_PENDING: 'Pagamento pendente',
  CONFIRMED: 'Confirmado',
  PICKING_PENDING: 'Separacao pendente',
  PICKING: 'Em separacao',
  WAITING_CUSTOMER_SUBSTITUTION: 'Aguardando substituicao',
  CONFERENCE_PENDING: 'Aguardando conferencia',
  PACKING: 'Embalando',
  READY_FOR_PICKUP: 'Pronto para retirada',
  READY_FOR_DELIVERY: 'Pronto para entrega',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluido',
  PARTIALLY_CANCELLED: 'Parcialmente cancelado',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Estornado',
  FAILED_SYNC: 'Falha de sincronizacao',
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Nao pago',
  PENDING: 'Pendente',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Estornado',
}
const getPaymentStatusClassName = (status?: string) => {
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

const normalizePhone = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  return `55${digits}`
}

const buildWhatsAppUrl = (whatsapp?: string, text?: string) => {
  const phone = normalizePhone(whatsapp)
  if (!phone) return ''
  if (!text) return `https://wa.me/${phone}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

const formatWhatsappDisplay = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '')
  const raw = digits.startsWith('55') ? digits.slice(2) : digits
  if (raw.length === 11) {
    return raw.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (raw.length === 10) {
    return raw.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return value || '-'
}

const splitClassificationParts = (value?: string | null) =>
  (value || '')
    .split(/\s*[|｜]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)

const getClassificationPrimary = (value?: string | null) => {
  const parts = splitClassificationParts(value)
  if (parts.length === 0) return ''
  return parts[0]
}

const formatClassificationLabel = (value?: string | null) => {
  const normalizedValue = getClassificationPrimary(value) || value || ''
  const match = normalizedValue.match(/^(\d+)\s*-\s*(.+)$/)

  if (!match) return normalizedValue

  const [, code, label] = match
  return `${code} - ${label.trim()}`
}

const formatClassificationOptionLabel = (value: string) => formatClassificationLabel(value)

const formatClassificationPath = (values: Array<string | null | undefined>) =>
  values
    .map((value) => formatClassificationLabel(value))
    .filter(Boolean)
    .join(' > ')

type GroupedLevel4 = { value: string }
type GroupedLevel3 = { value: string; children: GroupedLevel4[] }
type GroupedLevel2 = { value: string; children: GroupedLevel3[] }
type GroupedLevel1 = { value: string; children: GroupedLevel2[] }

function WhatsAppBadge({ phone, compact = false }: { phone?: string; compact?: boolean }) {
  if (!phone) {
    return <span className="text-xs text-gray-400">-</span>
  }

  return (
    <a
      href={buildWhatsAppUrl(phone)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#1fae56] bg-[#25D366] text-white font-medium shadow-sm transition hover:bg-[#1fae56] ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'}`}
      title="Abrir WhatsApp"
    >
      <MessageCircle size={compact ? 12 : 13} />
      {formatWhatsappDisplay(phone)}
    </a>
  )
}

const LayoutManager = lazy(() => import('../components/LayoutManager'))
const Intelligence = lazy(() => import('./Intelligence'))
const Integrations = lazy(() => import('./Integrations'))
const CategoriesManager = lazy(() => import('./CategoriesManager'))
const DeliveryZones = lazy(() => import('./DeliveryZones'))
const BusinessHours = lazy(() => import('./BusinessHours'))
const FraudAudit = lazy(() => import('./FraudAudit'))
const NotificationsBroadcast = lazy(() => import('./NotificationsBroadcast'))
const Recipes = lazy(() => import('./Recipes'))
const StoreBannersManager = lazy(() => import('./StoreBannersManager'))
const BrandIdentity = lazy(() => import('./BrandIdentity'))
const DashboardSection = lazy(() => import('./sections/DashboardSection').then((module) => ({ default: module.DashboardSection })))
const ProductsSection = lazy(() => import('./sections/ProductsSection'))
const OrdersSection = lazy(() => import('./sections/OrdersSection'))
const PickingSection = lazy(() => import('./sections/PickingSection'))
const BusinessAccountsSection = lazy(() => import('./sections/BusinessAccountsSection'))
const CustomersSection = lazy(() => import('./sections/CustomersSection'))
const PaymentEventsSection = lazy(() => import('./sections/PaymentEventsSection'))

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { logout, getAdminData } = useAuth()
  const admin = getAdminData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('dashboard')
  const [stats, setStats] = useState({
    orders: 0,
    customers: 0,
    products: 0,
    revenue: 0,
  })
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsSearch, setProductsSearch] = useState('')
  const [productsFilterOutOfStock, setProductsFilterOutOfStock] = useState(false)
  const [productsFilterInactive, setProductsFilterInactive] = useState(false)
  const [productsFilterUncategorized, setProductsFilterUncategorized] = useState(false)
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(1)
  const [mercadologicalTree, setMercadologicalTree] = useState<MercadologicalTreeLevel1[]>([])
  const [classification01Filter, setClassification01Filter] = useState('')
  const [classification02Filter, setClassification02Filter] = useState('')
  const [classification03Filter, setClassification03Filter] = useState('')
  const [classification04Filter, setClassification04Filter] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [syncingTaxonomy, setSyncingTaxonomy] = useState(false)
  const [solidcomStatus, setSolidcomStatus] = useState<SolidcomStatusResponse | null>(null)
  const [solidcomStatusLoading, setSolidcomStatusLoading] = useState(false)
  const [solidcomStatusExpanded, setSolidcomStatusExpanded] = useState(true)
  const [availabilityMetrics, setAvailabilityMetrics] = useState<ProductAvailabilityMetricsResponse | null>(null)
  const [salesPeriod, setSalesPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [salesSeries, setSalesSeries] = useState<SalesAnalyticsPoint[]>([])
  const [statusAnalytics, setStatusAnalytics] = useState<StatusAnalyticsResponse | null>(null)
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalyticsResponse | null>(null)
  const [topProducts, setTopProducts] = useState<TopProductAnalyticsItem[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [productFormErrors, setProductFormErrors] = useState<ProductFormErrors>({})
  const [productFeedback, setProductFeedback] = useState<ProductFeedback | null>(null)

  // Orders state
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

  // Customers state
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customersSearch, setCustomersSearch] = useState('')
  const [customersViewMode, setCustomersViewMode] = useState<'list' | 'kanban'>('list')
  const [customersEmailFilter, setCustomersEmailFilter] = useState<'all' | 'with' | 'without'>('all')
  const [customersAddressFilter, setCustomersAddressFilter] = useState<'all' | 'with' | 'without'>('all')
  const [customersDateFilter, setCustomersDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all')
  const [customersOrderFilter, setCustomersOrderFilter] = useState<'all' | 'with-orders' | 'without-orders'>('all')
  const [customerOrderCountMap, setCustomerOrderCountMap] = useState<Record<string, number>>({})
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null)

  const lazySectionFallback = (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando secao...</div>
  )

  const loadStats = useCallback(async () => {
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        ordersAPI.getAll(),
        customersAPI.getAll(),
        productsAPI.getAll(),
      ])

      const totalRevenue = ordersRes.data.reduce(
        (sum: number, order: { total: number }) => sum + order.total,
        0,
      )

      setStats({
        orders: ordersRes.data.length,
        customers: customersRes.data.length,
        products: productsRes.data.length,
        revenue: totalRevenue,
      })
    } catch {
      setStats({
        orders: 0,
        customers: 0,
        products: 0,
        revenue: 0,
      })
    }
  }, [])

  const loadProducts = useCallback(async (
    page = 1,
    search = productsSearch,
    outOfStock = productsFilterOutOfStock,
    inactive = productsFilterInactive,
    uncategorized = productsFilterUncategorized
  ) => {
    try {
      setProductsLoading(true)
      setProductsError('')

      const response = await productsAPI.getAdmin({
        page,
        limit: 10,
        search: search || undefined,
        classification01: classification01Filter || undefined,
        classification02: classification02Filter || undefined,
        classification03: classification03Filter || undefined,
        classification04: classification04Filter || undefined,
        outOfStock: outOfStock || undefined,
        inactive: inactive || undefined,
        uncategorized: uncategorized || undefined,
      })

      setProducts(response.data.data)
      setProductsPage(response.data.page)
      setProductsTotalPages(response.data.totalPages)
    } catch (error: any) {
      setProductsError(getApiErrorMessage(error, 'Erro ao carregar produtos'))
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }, [productsSearch, classification01Filter, classification02Filter, classification03Filter, classification04Filter, productsFilterOutOfStock, productsFilterInactive, productsFilterUncategorized])

  const loadMercadologicalTree = useCallback(async () => {
    try {
      const response = await productsAPI.getMercadologicalTree()
      setMercadologicalTree(response.data.data || [])
    } catch {
      setMercadologicalTree([])
    }
  }, [])

  const loadSolidcomStatus = useCallback(async () => {
    try {
      setSolidcomStatusLoading(true)
      const response = await integrationsAPI.getSolidcomStatus()
      setSolidcomStatus(response.data)
    } catch {
      setSolidcomStatus(null)
    } finally {
      setSolidcomStatusLoading(false)
    }
  }, [])

  const loadAvailabilityMetrics = useCallback(async () => {
    try {
      const response = await productsAPI.getAvailabilityMetrics()
      setAvailabilityMetrics(response.data)
    } catch {
      setAvailabilityMetrics(null)
    }
  }, [])

  const loadDashboardAnalytics = useCallback(async () => {
    try {
      setDashboardLoading(true)
      const [salesRes, statusRes, revenueRes, topRes] = await Promise.all([
        ordersAPI.getSalesAnalytics(salesPeriod),
        ordersAPI.getStatusAnalytics(),
        ordersAPI.getRevenueAnalytics(),
        productsAPI.getTopAnalytics(5),
      ])

      setSalesSeries(salesRes.data.data)
      setStatusAnalytics(statusRes.data)
      setRevenueAnalytics(revenueRes.data)
      setTopProducts(topRes.data)
    } finally {
      setDashboardLoading(false)
    }
  }, [salesPeriod])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (activeSection === 'products') {
      loadProducts(
        1,
        productsSearch,
        productsFilterOutOfStock,
        productsFilterInactive,
        productsFilterUncategorized
      )
      loadSolidcomStatus()
      loadMercadologicalTree()
      loadAvailabilityMetrics()
    }
  }, [
    activeSection,
    loadProducts,
    loadSolidcomStatus,
    loadMercadologicalTree,
    loadAvailabilityMetrics,
    productsSearch,
    productsFilterOutOfStock,
    productsFilterInactive,
    productsFilterUncategorized
  ])

  const groupedMercadologicalTree = useMemo<GroupedLevel1[]>(() => {
    const level1Map = new Map<string, Map<string, Map<string, Set<string>>>>()

    const addPath = (values: Array<string | null | undefined>) => {
      const parts = values.flatMap((value) => splitClassificationParts(value)).filter(Boolean)
      const [level1, level2, level3, level4] = parts
      if (!level1) return

      if (!level1Map.has(level1)) {
        level1Map.set(level1, new Map<string, Map<string, Set<string>>>())
      }
      const level2Map = level1Map.get(level1)!

      if (!level2) return
      if (!level2Map.has(level2)) {
        level2Map.set(level2, new Map<string, Set<string>>())
      }
      const level3Map = level2Map.get(level2)!

      if (!level3) return
      if (!level3Map.has(level3)) {
        level3Map.set(level3, new Set<string>())
      }
      const level4Set = level3Map.get(level3)!

      if (level4) {
        level4Set.add(level4)
      }
    }

    for (const level1 of mercadologicalTree) {
      if (level1.children.length === 0) {
        addPath([level1.value])
        continue
      }

      for (const level2 of level1.children) {
        if (level2.children.length === 0) {
          addPath([level1.value, level2.value])
          continue
        }

        for (const level3 of level2.children) {
          if (level3.children.length === 0) {
            addPath([level1.value, level2.value, level3.value])
            continue
          }

          for (const level4 of level3.children) {
            addPath([level1.value, level2.value, level3.value, level4.value])
          }
        }
      }
    }

    return Array.from(level1Map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([level1, level2Map]) => ({
        value: level1,
        children: Array.from(level2Map.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([level2, level3Map]) => ({
            value: level2,
            children: Array.from(level3Map.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([level3, level4Set]) => ({
                value: level3,
                children: Array.from(level4Set.values())
                  .sort((a, b) => a.localeCompare(b))
                  .map((level4) => ({ value: level4 })),
              })),
          })),
      }))
  }, [mercadologicalTree])

  const level2Options = useMemo(() => {
    const level1 = groupedMercadologicalTree.find((item) => item.value === classification01Filter)
    return level1?.children || []
  }, [groupedMercadologicalTree, classification01Filter])

  const level3Options = useMemo(() => {
    const level2 = level2Options.find((item) => item.value === classification02Filter)
    return level2?.children || []
  }, [level2Options, classification02Filter])

  const level4Options = useMemo(() => {
    const level3 = level3Options.find((item) => item.value === classification03Filter)
    return level3?.children || []
  }, [level3Options, classification03Filter])

  const formLevel2Options = useMemo(() => {
    const level1 = mercadologicalTree.find((item) => item.value === productForm.classification01)
    return level1?.children || []
  }, [mercadologicalTree, productForm.classification01])

  const formLevel3Options = useMemo(() => {
    const level2 = formLevel2Options.find((item) => item.value === productForm.classification02)
    return level2?.children || []
  }, [formLevel2Options, productForm.classification02])

  const formLevel4Options = useMemo(() => {
    const level3 = formLevel3Options.find((item) => item.value === productForm.classification03)
    return level3?.children || []
  }, [formLevel3Options, productForm.classification03])

  useEffect(() => {
    if (activeSection === 'dashboard') {
      loadDashboardAnalytics()
    }
  }, [activeSection, loadDashboardAnalytics])

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

  const loadCustomers = useCallback(async (search = customersSearch) => {
    try {
      setCustomersLoading(true)
      const [customersRes, ordersRes] = await Promise.all([
        customersAPI.getAll(search || undefined),
        ordersAPI.getAll(),
      ])
      setCustomers(customersRes.data)

      const counts = ordersRes.data.reduce<Record<string, number>>((acc, order) => {
        if (!order.customerId) return acc
        acc[order.customerId] = (acc[order.customerId] || 0) + 1
        return acc
      }, {})
      setCustomerOrderCountMap(counts)
    } catch {
      setCustomers([])
      setCustomerOrderCountMap({})
    } finally {
      setCustomersLoading(false)
    }
  }, [customersSearch])

  useEffect(() => {
    if (activeSection === 'orders') loadOrders()
  }, [activeSection, loadOrders])

  useEffect(() => {
    if (activeSection === 'customers') loadCustomers()
  }, [activeSection, loadCustomers])

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

  const openCustomerDetails = async (customer: AdminCustomer) => {
    try {
      const response = await customersAPI.getOne(customer.id)
      setSelectedCustomer(response.data)
    } catch {
      setSelectedCustomer(customer)
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

  const filteredCustomers = useMemo(() => {
    const now = Date.now()
    return customers.filter((customer) => {
      const haystack = `${customer.name || ''} ${customer.cpf || ''} ${customer.whatsapp || ''} ${customer.email || ''}`.toLowerCase()
      const matchesSearch = !customersSearch.trim() || haystack.includes(customersSearch.toLowerCase())
      if (!matchesSearch) return false

      const hasEmail = Boolean(customer.email)
      if (customersEmailFilter === 'with' && !hasEmail) return false
      if (customersEmailFilter === 'without' && hasEmail) return false

      const hasAddress = Boolean(customer.addresses && customer.addresses.length > 0)
      if (customersAddressFilter === 'with' && !hasAddress) return false
      if (customersAddressFilter === 'without' && hasAddress) return false

      const totalOrders = customerOrderCountMap[customer.id] || 0
      if (customersOrderFilter === 'with-orders' && totalOrders === 0) return false
      if (customersOrderFilter === 'without-orders' && totalOrders > 0) return false

      if (customersDateFilter !== 'all' && customer.createdAt) {
        const createdAt = new Date(customer.createdAt).getTime()
        if (Number.isNaN(createdAt)) return false
        if (customersDateFilter === '7d' && now - createdAt > 7 * 24 * 60 * 60 * 1000) return false
        if (customersDateFilter === '30d' && now - createdAt > 30 * 24 * 60 * 60 * 1000) return false
        if (customersDateFilter === '90d' && now - createdAt > 90 * 24 * 60 * 60 * 1000) return false
      }

      return true
    })
  }, [customers, customersSearch, customersEmailFilter, customersAddressFilter, customersDateFilter, customersOrderFilter, customerOrderCountMap])

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setProductFormErrors({})
    setEditingProductId(null)
    setIsProductFormOpen(false)
  }

  const openCreateProductForm = () => {
    setProductFeedback(null)
    setEditingProductId(null)
    setProductForm(EMPTY_PRODUCT_FORM)
    setIsProductFormOpen(true)
  }

  const openEditProductForm = (product: AdminProduct) => {
    setProductFeedback(null)
    setEditingProductId(product.id)
    setProductForm({
      ean: product.ean || '',
      name: product.name || '',
      titleMask: product.titleMask || '',
      titleMaskShort: product.titleMaskShort || '',
      alternativeDescription: product.alternativeDescription || '',
      classification01: product.classification01 || '',
      classification02: product.classification02 || '',
      classification03: product.classification03 || '',
      classification04: product.classification04 || '',
      price: String(product.price ?? ''),
      promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : '',
      stock: product.stock != null ? String(product.stock) : '',
      unit: product.unit || 'un',
      badges: product.badges || '',
      origin: product.origin || '',
      videoUrl: product.videoUrl || '',
    })
    setIsProductFormOpen(true)
  }

  const buildProductPayload = (): ProductPayload => {
    if (editingProductId) {
      const payload: Partial<ProductPayload> = {}
      payload.titleMask = productForm.titleMask.trim() || null
      payload.titleMaskShort = productForm.titleMaskShort.trim() || null
      payload.videoUrl = productForm.videoUrl.trim() || null
      payload.badges = productForm.badges.trim() || null
      payload.promotionalPrice = productForm.promotionalPrice.trim() ? Number(productForm.promotionalPrice) : null
      return payload as ProductPayload
    }

    const payload: ProductPayload = {
      ean: productForm.ean.trim(),
      name: productForm.name.trim(),
      price: Number(productForm.price),
      unit: productForm.unit.trim() || 'un',
    }

    if (productForm.alternativeDescription.trim()) {
      payload.alternativeDescription = productForm.alternativeDescription.trim()
    }
    if (productForm.promotionalPrice.trim()) {
      payload.promotionalPrice = Number(productForm.promotionalPrice)
    }
    if (productForm.stock.trim()) {
      payload.stock = Number(productForm.stock)
    }
    if (productForm.badges.trim()) {
      payload.badges = productForm.badges.trim()
    }
    if (productForm.origin.trim()) {
      payload.origin = productForm.origin.trim()
    }
    if (productForm.classification01.trim()) {
      payload.classification01 = productForm.classification01.trim()
    }
    if (productForm.classification02.trim()) {
      payload.classification02 = productForm.classification02.trim()
    }
    if (productForm.classification03.trim()) {
      payload.classification03 = productForm.classification03.trim()
    }
    if (productForm.classification04.trim()) {
      payload.classification04 = productForm.classification04.trim()
    }

    return payload as ProductPayload
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setProductFeedback(null)

    const errors: ProductFormErrors = {}
    if (!editingProductId) {
      if (!productForm.ean.trim()) errors.ean = 'EAN obrigatorio'
      if (!productForm.name.trim()) errors.name = 'Nome obrigatorio'
      if (!productForm.price.trim()) {
        errors.price = 'Preco obrigatorio'
      } else if (Number(productForm.price) <= 0) {
        errors.price = 'Preco deve ser maior que zero'
      }
    }

    setProductFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    try {
      setSavingProduct(true)
      const payload = buildProductPayload()

      if (editingProductId) {
        await productsAPI.update(editingProductId, payload)
      } else {
        await productsAPI.createAdmin(payload)
      }

      resetProductForm()
      await loadProducts(productsPage, productsSearch)
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao salvar produto'),
      })
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      setProductFeedback(null)
      await productsAPI.delete(id)
      await loadProducts(productsPage, productsSearch)
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao remover produto'),
      })
      throw error
    }
  }

  const handleBulkUpdateStatus = async (ids: string[], active: boolean) => {
    try {
      setProductFeedback(null)
      await productsAPI.bulkUpdateStatus(ids, active)
      await loadProducts(productsPage, productsSearch)
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar produtos em lote'),
      })
      throw error
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setProductFeedback(null)
      await productsAPI.bulkDelete(ids)
      await loadProducts(1, productsSearch)
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao excluir produtos em lote'),
      })
      throw error
    }
  }

  const handleUpdateProductFields = async (id: string, updates: any) => {
    try {
      setProductFeedback(null)
      await productsAPI.update(id, updates)
      await loadProducts(productsPage, productsSearch)
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar campo do produto'),
      })
      throw error
    }
  }

  const handleSyncProducts = async () => {
    try {
      setProductFeedback(null)
      setSyncingProducts(true)
      const response = await productsAPI.sync()
      const taxonomy = response.data?.taxonomy
      if (taxonomy) {
        setProductFeedback({
          tone: 'success',
          title: 'Sincronizacao executada',
          description: `Produtos sincronizados: ${response.data?.synced ?? 0}; erros: ${response.data?.errors ?? 0}; produtos processados: ${taxonomy.productsProcessed}; produtos recategorizados: ${taxonomy.productsRecategorized}; categorias detectadas: ${taxonomy.categoriesDetected}; categorias criadas: ${taxonomy.categoriesCreated}; raizes mercadologicas: ${taxonomy.mercadologicalRoots}.`,
        })
      } else {
        setProductFeedback({
          tone: 'success',
          title: response.data?.message || 'Sincronizacao executada',
        })
      }
      await loadProducts(productsPage, productsSearch)
      await loadSolidcomStatus()
      await loadMercadologicalTree()
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro na sincronizacao'),
      })
    } finally {
      setSyncingProducts(false)
    }
  }

  const handleSyncTaxonomy = async () => {
    try {
      setProductFeedback(null)
      setSyncingTaxonomy(true)
      const response = await productsAPI.syncTaxonomy()
      const result = response.data
      setProductFeedback({
        tone: 'success',
        title: 'Taxonomia atualizada',
        description: `Produtos processados: ${result.productsProcessed}; produtos recategorizados: ${result.productsRecategorized}; mantidos por categoria de cadastro: ${result.productsKeptByRegisteredCategory ?? 0}; inferidos por classificacao: ${result.productsInferredFromClassification ?? 0}; categorias detectadas: ${result.categoriesDetected}; categorias criadas: ${result.categoriesCreated}; categorias atualizadas: ${result.categoriesUpdated ?? 0}; categorias semeadas para futuro: ${result.categoriesSeededForFuture ?? 0}; raizes mercadologicas: ${result.mercadologicalRoots}.`,
      })

      await loadProducts(1, productsSearch)
      await loadMercadologicalTree()
      await loadStats()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao sincronizar taxonomia'),
      })
    } finally {
      setSyncingTaxonomy(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarNavButtonClass =
    'block w-full min-h-[44px] px-6 py-3 text-left transition-colors duration-150 flex items-center gap-3 focus:outline-none focus-visible:bg-[#5d082a] focus-visible:shadow-[inset_3px_0_0_#d2bb8a]'

  const sidebarNavActiveClass = 'bg-[#5d082a] font-semibold shadow-[inset_3px_0_0_#d2bb8a]'
  const sidebarSecondaryButtonClass =
    'block w-full min-h-[44px] rounded-xl px-4 py-3 text-left transition-all duration-150 flex items-center gap-3 focus:outline-none focus-visible:bg-[#7a1038] focus-visible:shadow-[inset_3px_0_0_#d2bb8a]'

  const handleAnalyticsChange = useCallback((updates: Partial<DashboardAnalytics>) => {
    if (updates.salesPeriod !== undefined) setSalesPeriod(updates.salesPeriod)
    if (updates.salesSeries !== undefined) setSalesSeries(updates.salesSeries)
    if (updates.statusAnalytics !== undefined) setStatusAnalytics(updates.statusAnalytics)
    if (updates.revenueAnalytics !== undefined) setRevenueAnalytics(updates.revenueAnalytics)
    if (updates.topProducts !== undefined) setTopProducts(updates.topProducts)
    if (updates.dashboardLoading !== undefined) setDashboardLoading(updates.dashboardLoading)
  }, [])

  // const formatDelta = (value: number) => {
  //   const isUp = value >= 0
  //   return (
  //     <span className={`inline-flex items-center text-xs font-medium ${isUp ? 'text-[#5d082a]' : 'text-red-500'}`}>
  //       {isUp ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
  //       {Math.abs(value)}%
  //     </span>
  //   )
  // }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Overlay para mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`${
          sidebarOpen ? 'fixed md:relative' : 'hidden'
        } md:flex flex-col w-64 h-screen bg-[#4a0622] text-white shadow-lg z-40 transition-all duration-300 ease-out`}
        role="navigation"
        aria-label="Menu Principal"
      >
        <div className="p-6 border-b border-[#5d082a]">
          <img
            src="/branding/logo-horizontal-branco.png"
            alt="Logo Antenor & Filhos"
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('dashboard')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'dashboard' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'dashboard' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Dashboard"
          >
            <BarChart3 className="flex-shrink-0" size={20} />
            <span>Dashboard</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('products')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'products' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'products' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Produtos"
          >
            <Package className="flex-shrink-0" size={20} />
            <span>Produtos</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('orders')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'orders' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'orders' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Pedidos"
          >
            <ShoppingCart className="flex-shrink-0" size={20} />
            <span>Pedidos</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('picking')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'picking' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'picking' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Separacao"
          >
            <ClipboardCheck className="flex-shrink-0" size={20} />
            <span>Separacao</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('businessAccounts')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'businessAccounts' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'businessAccounts' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Contas B2B"
          >
            <Briefcase className="flex-shrink-0" size={20} />
            <span>Contas B2B</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('customers')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'customers' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'customers' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Clientes"
          >
            <Users className="flex-shrink-0" size={20} />
            <span>Clientes</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('layout')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'layout' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'layout' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Layout do Site"
          >
            <Sparkles className="flex-shrink-0" size={20} />
            <span>Layout do Site</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setActiveSection('categories')
              setSidebarOpen(false)
            }}
            aria-current={activeSection === 'categories' ? 'page' : undefined}
            className={`${sidebarNavButtonClass} text-[#fde8ef] hover:bg-[#5d082a] ${
              activeSection === 'categories' ? sidebarNavActiveClass : ''
            }`}
            aria-label="Categorias"
          >
            <Tag className="flex-shrink-0" size={20} />
            <span>Categorias</span>
          </Button>
          <div className="mt-6 px-3 pt-4 border-t border-[#6f1737]">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c992a8]">
              Ferramentas
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('intelligence')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'intelligence' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'intelligence'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Inteligencia IA"
            >
              <Bot className="flex-shrink-0" size={18} />
              <span>Inteligencia IA</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('integrations')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'integrations' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'integrations'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Integracoes"
            >
              <Workflow className="flex-shrink-0" size={18} />
              <span>Integracoes</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('payments')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'payments' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'payments'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Pagamentos"
            >
              <CreditCard className="flex-shrink-0" size={18} />
              <span>Pagamentos</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('deliveryZones')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'deliveryZones' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'deliveryZones'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Taxas de Entrega"
            >
              <Truck className="flex-shrink-0" size={18} />
              <span>Taxas de Entrega</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('businessHours')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'businessHours' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'businessHours'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Horarios de Funcionamento"
            >
              <Clock3 className="flex-shrink-0" size={18} />
              <span>Horarios</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('fraudAudit')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'fraudAudit' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'fraudAudit'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Anti-fraude"
            >
              <ShieldAlert className="flex-shrink-0" size={18} />
              <span>Anti-fraude</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('notifications')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'notifications' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'notifications'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Notificacoes"
            >
              <BellRing className="flex-shrink-0" size={18} />
              <span>Notificacoes</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('recipes')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'recipes' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'recipes'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Receitas"
            >
              <ChefHat className="flex-shrink-0" size={18} />
              <span>Receitas</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('storeBanners')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'storeBanners' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'storeBanners'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Banners da Loja"
            >
              <Image className="flex-shrink-0" size={18} />
              <span>Banners da Loja</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveSection('brandIdentity')
                setSidebarOpen(false)
              }}
              aria-current={activeSection === 'brandIdentity' ? 'page' : undefined}
              className={`${sidebarSecondaryButtonClass} mt-2 text-[#fff4f8] bg-[#6a0d31] hover:bg-[#7a1038] ${
                activeSection === 'brandIdentity'
                  ? 'bg-[#7a1038] font-semibold shadow-[inset_3px_0_0_#d2bb8a,0_10px_30px_rgba(0,0,0,0.18)]'
                  : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
              }`}
              aria-label="Identidade Visual"
            >
              <Palette className="flex-shrink-0" size={18} />
              <span>Identidade Visual</span>
            </Button>
          </div>
        </nav>

        <div className="p-6 border-t border-[#5d082a]">
          <Button
            type="button"
            variant="destructive"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white text-white px-4 py-2 rounded transition-colors duration-150 min-h-[44px]"
            aria-label="Sair da conta"
          >
            <LogOut size={18} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col" role="main">
        {/* Header */}
        <header className="bg-white shadow sticky top-0 z-20">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5d082a] rounded transition-colors duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                aria-label="Abrir menu principal"
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
              >
                <Menu size={24} />
              </Button>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">
                {activeSection === 'dashboard' && 'Dashboard'}
                {activeSection === 'products' && 'Produtos'}
                {activeSection === 'orders' && 'Pedidos'}
                {activeSection === 'picking' && 'Separacao'}
                {activeSection === 'businessAccounts' && 'Contas B2B'}
                {activeSection === 'customers' && 'Clientes'}
                {activeSection === 'layout' && 'Layout do Site'}
                {activeSection === 'categories' && 'Categorias'}
                {activeSection === 'deliveryZones' && 'Taxas de Entrega'}
                {activeSection === 'businessHours' && 'Horarios de Funcionamento'}
                {activeSection === 'fraudAudit' && 'Anti-fraude'}
                {activeSection === 'notifications' && 'Notificacoes'}
                {activeSection === 'recipes' && 'Receitas'}
                {activeSection === 'storeBanners' && 'Banners da Loja'}
                {activeSection === 'brandIdentity' && 'Identidade Visual'}
                {activeSection === 'intelligence' && 'Inteligencia (IA)'}
                {activeSection === 'integrations' && 'Integracoes'}
                {activeSection === 'payments' && 'Pagamentos'}
              </h2>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 ml-auto flex-shrink-0">
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">{admin?.name}</span>
              <div className="w-10 h-10 bg-[#fdf0f4] rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200" aria-label="Foto do perfil">
                AF
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 animate-in fade-in duration-300">
          {activeSection === 'dashboard' && (
            <Suspense fallback={lazySectionFallback}>
              <DashboardSection
                stats={stats}
                analytics={{
                  salesPeriod,
                  salesSeries,
                  statusAnalytics,
                  revenueAnalytics,
                  topProducts,
                  dashboardLoading,
                }}
                onAnalyticsChange={handleAnalyticsChange}
                onNavigate={setActiveSection}
              />
            </Suspense>
          )}

          {activeSection === 'products' && (
            <Suspense fallback={lazySectionFallback}>
              <ProductsSection
                productsSearch={productsSearch}
                onProductsSearchChange={setProductsSearch}
                onSearch={() => loadProducts(1, productsSearch, productsFilterOutOfStock, productsFilterInactive, productsFilterUncategorized)}
                productsFilterOutOfStock={productsFilterOutOfStock}
                onProductsFilterOutOfStockChange={(value) => {
                  setProductsFilterOutOfStock(value)
                  setProductsPage(1)
                }}
                productsFilterInactive={productsFilterInactive}
                onProductsFilterInactiveChange={(value) => {
                  setProductsFilterInactive(value)
                  setProductsPage(1)
                }}
                productsFilterUncategorized={productsFilterUncategorized}
                onProductsFilterUncategorizedChange={(value) => {
                  setProductsFilterUncategorized(value)
                  setProductsPage(1)
                }}
                onBulkUpdateStatus={handleBulkUpdateStatus}
                onBulkDelete={handleBulkDelete}
                onUpdateProductFields={handleUpdateProductFields}
                productFeedback={productFeedback}
                onDismissProductFeedback={() => setProductFeedback(null)}
                onSyncProducts={handleSyncProducts}
                syncingProducts={syncingProducts}
                onSyncTaxonomy={handleSyncTaxonomy}
                syncingTaxonomy={syncingTaxonomy}
                onCreateProduct={openCreateProductForm}
                classification01Filter={classification01Filter}
                classification02Filter={classification02Filter}
                classification03Filter={classification03Filter}
                classification04Filter={classification04Filter}
                onClassification01FilterChange={(value) => {
                  setClassification01Filter(value)
                  setClassification02Filter('')
                  setClassification03Filter('')
                  setClassification04Filter('')
                  setProductsPage(1)
                }}
                onClassification02FilterChange={(value) => {
                  setClassification02Filter(value)
                  setClassification03Filter('')
                  setClassification04Filter('')
                  setProductsPage(1)
                }}
                onClassification03FilterChange={(value) => {
                  setClassification03Filter(value)
                  setClassification04Filter('')
                  setProductsPage(1)
                }}
                onClassification04FilterChange={(value) => {
                  setClassification04Filter(value)
                  setProductsPage(1)
                }}
                groupedMercadologicalTree={groupedMercadologicalTree}
                level2Options={level2Options}
                level3Options={level3Options}
                level4Options={level4Options}
                formatClassificationOptionLabel={formatClassificationOptionLabel}
                isProductFormOpen={isProductFormOpen}
                editingProductId={editingProductId}
                onSaveProduct={handleSaveProduct}
                productForm={productForm}
                productFormErrors={productFormErrors}
                onProductFormChange={(updates) => setProductForm((prev) => ({ ...prev, ...updates }))}
                formLevel2Options={formLevel2Options}
                formLevel3Options={formLevel3Options}
                formLevel4Options={formLevel4Options}
                onResetProductForm={resetProductForm}
                savingProduct={savingProduct}
                productsLoading={productsLoading}
                productsError={productsError}
                products={products}
                formatClassificationPath={formatClassificationPath}
                onEditProduct={openEditProductForm}
                onDeleteProduct={handleDeleteProduct}
                productsPage={productsPage}
                productsTotalPages={productsTotalPages}
                onPreviousPage={() => loadProducts(productsPage - 1, productsSearch)}
                onNextPage={() => loadProducts(productsPage + 1, productsSearch)}
                solidcomStatusLoading={solidcomStatusLoading}
                solidcomStatus={solidcomStatus}
                onReloadSolidcomStatus={loadSolidcomStatus}
                solidcomStatusExpanded={solidcomStatusExpanded}
                onToggleSolidcomStatusExpanded={() => setSolidcomStatusExpanded(!solidcomStatusExpanded)}
                availabilityMetrics={availabilityMetrics}
              />
            </Suspense>
          )}

          {activeSection === 'orders' && (
            <Suspense fallback={lazySectionFallback}>
              <OrdersSection
                ordersSearch={ordersSearch}
                onOrdersSearchChange={setOrdersSearch}
                ordersStatusFilter={ordersStatusFilter}
                onOrdersStatusFilterChange={setOrdersStatusFilter}
                ordersDateFilter={ordersDateFilter}
                onOrdersDateFilterChange={setOrdersDateFilter}
                ordersPaymentFilter={ordersPaymentFilter}
                onOrdersPaymentFilterChange={setOrdersPaymentFilter}
                ordersChangeFilter={ordersChangeFilter}
                onOrdersChangeFilterChange={setOrdersChangeFilter}
                ordersViewMode={ordersViewMode}
                onOrdersViewModeChange={setOrdersViewMode}
                onReloadOrders={loadOrders}
                ordersLoading={ordersLoading}
                filteredOrders={filteredOrders}
                orderStatusOptions={ORDER_STATUS_OPTIONS}
                orderStatusLabels={ORDER_STATUS_LABELS}
                updatingOrderStatus={updatingOrderStatus}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onUpdateOrder={handleUpdateOrder}
                orderFeedback={orderFeedback}
                onDismissOrderFeedback={() => setOrderFeedback(null)}
                onSelectOrder={openOrderDetails}
                draggingOrderId={draggingOrderId}
                onDraggingOrderIdChange={setDraggingOrderId}
                selectedOrder={selectedOrder}
                paymentStatusLabels={PAYMENT_STATUS_LABELS}
                getPaymentStatusClassName={getPaymentStatusClassName}
                renderWhatsAppBadge={(phone, compact) => <WhatsAppBadge phone={phone} compact={compact} />}
              />
            </Suspense>
          )}

          {activeSection === 'picking' && (
            <Suspense fallback={lazySectionFallback}>
              <PickingSection />
            </Suspense>
          )}

          {activeSection === 'businessAccounts' && (
            <Suspense fallback={lazySectionFallback}>
              <BusinessAccountsSection />
            </Suspense>
          )}

          {activeSection === 'customers' && (
            <Suspense fallback={lazySectionFallback}>
              <CustomersSection
                customersSearch={customersSearch}
                onCustomersSearchChange={setCustomersSearch}
                customersEmailFilter={customersEmailFilter}
                onCustomersEmailFilterChange={setCustomersEmailFilter}
                customersAddressFilter={customersAddressFilter}
                onCustomersAddressFilterChange={setCustomersAddressFilter}
                customersOrderFilter={customersOrderFilter}
                onCustomersOrderFilterChange={setCustomersOrderFilter}
                customersDateFilter={customersDateFilter}
                onCustomersDateFilterChange={setCustomersDateFilter}
                customersViewMode={customersViewMode}
                onCustomersViewModeChange={setCustomersViewMode}
                onReloadCustomers={() => loadCustomers(customersSearch)}
                customersLoading={customersLoading}
                filteredCustomers={filteredCustomers}
                customerOrderCountMap={customerOrderCountMap}
                onOpenCustomerDetails={openCustomerDetails}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                renderWhatsAppBadge={(phone, compact) => <WhatsAppBadge phone={phone} compact={compact} />}
              />
            </Suspense>
          )}

          {activeSection === 'layout' && (
            <Suspense fallback={lazySectionFallback}>
              <LayoutManager />
            </Suspense>
          )}

          {activeSection === 'categories' && (
            <Suspense fallback={lazySectionFallback}>
              <CategoriesManager />
            </Suspense>
          )}

          {activeSection === 'deliveryZones' && (
            <Suspense fallback={lazySectionFallback}>
              <DeliveryZones />
            </Suspense>
          )}

          {activeSection === 'businessHours' && (
            <Suspense fallback={lazySectionFallback}>
              <BusinessHours />
            </Suspense>
          )}

          {activeSection === 'fraudAudit' && (
            <Suspense fallback={lazySectionFallback}>
              <FraudAudit />
            </Suspense>
          )}

          {activeSection === 'notifications' && (
            <Suspense fallback={lazySectionFallback}>
              <NotificationsBroadcast />
            </Suspense>
          )}

          {activeSection === 'recipes' && (
            <Suspense fallback={lazySectionFallback}>
              <Recipes />
            </Suspense>
          )}

          {activeSection === 'storeBanners' && (
            <Suspense fallback={lazySectionFallback}>
              <StoreBannersManager />
            </Suspense>
          )}

          {activeSection === 'brandIdentity' && (
            <Suspense fallback={lazySectionFallback}>
              <BrandIdentity />
            </Suspense>
          )}

          {activeSection === 'intelligence' && (
            <Suspense fallback={lazySectionFallback}>
              <Intelligence />
            </Suspense>
          )}

          {activeSection === 'integrations' && (
            <Suspense fallback={lazySectionFallback}>
              <Integrations />
            </Suspense>
          )}

          {activeSection === 'payments' && (
            <Suspense fallback={lazySectionFallback}>
              <PaymentEventsSection />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  )
}

