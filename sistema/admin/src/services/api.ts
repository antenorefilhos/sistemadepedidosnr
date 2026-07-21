import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const resolveApiUrl = (value?: string | null) => {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/branding/')) return value
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export interface AdminProduct {
  id: string
  ean: string
  name: string
  alternativeDescription?: string | null
  classification01?: string | null
  classification02?: string | null
  classification03?: string | null
  classification04?: string | null
  price: number
  promotionalPrice?: number | null
  stock?: number | null
  unit?: string
  badges?: string | null
  titleMask?: string | null
  titleMaskShort?: string | null
  videoUrl?: string | null
  syncOption?: 'ESTOQUE' | 'SEMPRE' | 'NUNCA' | null
  origin?: string | null
  active: boolean
}

export interface AdminProductsResponse {
  data: AdminProduct[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface CmsCategory {
  id: string
  name: string
  parentId: string | null
  priority: number
  active: boolean
  children?: CmsCategory[]
}

export interface CmsProductCategoryMapping {
  id: string
  ean: string
  categoryId: string
  category: { id: string; name: string; parentId: string | null }
  subCategoryId: string | null
  subCategory: { id: string; name: string } | null
  source: string
  priority: number
}

export interface PendingCategoryMappingItem {
  id: string
  ean: string
  productName: string
  suggestedCategoryN1: string | null
  suggestedCategoryN2: string | null
  suggestedCategory?: { id: string; name: string } | null
  reason: string
  notes?: string | null
  createdAt: string
}

export interface ProductPayload {
  ean: string
  name: string
  alternativeDescription?: string | null
  classification01?: string | null
  classification02?: string | null
  classification03?: string | null
  classification04?: string | null
  price: number
  promotionalPrice?: number | null
  stock?: number | null
  unit?: string | null
  badges?: string | null
  titleMask?: string | null
  titleMaskShort?: string | null
  videoUrl?: string | null
  syncOption?: 'ESTOQUE' | 'SEMPRE' | 'NUNCA' | null
  origin?: string | null
}

export interface MercadologicalTreeLeaf {
  value: string
}

export interface MercadologicalTreeLevel3 {
  value: string
  children: MercadologicalTreeLeaf[]
}

export interface MercadologicalTreeLevel2 {
  value: string
  children: MercadologicalTreeLevel3[]
}

export interface MercadologicalTreeLevel1 {
  value: string
  children: MercadologicalTreeLevel2[]
}

export interface MercadologicalTreeResponse {
  data: MercadologicalTreeLevel1[]
}

export interface TaxonomySyncResponse {
  success: true
  productsProcessed: number
  productsRecategorized: number
  productsKeptByRegisteredCategory?: number
  productsInferredFromClassification?: number
  categoriesDetected: number
  categoriesCreated: number
  categoriesUpdated?: number
  categoriesSeededForFuture?: number
  mercadologicalRoots: number
}

export interface ProductAvailabilityMetricsResponse {
  lowStockProducts: number
  alwaysEnabledWithZeroStock: number
  inactiveWithStock: number
}

export interface SolidcomSyncHistoryItem {
  id: string
  at: string
  products: number
  synced: number
  errors: number
}

export interface SystemServiceStatus {
  status: 'ok' | 'degraded' | 'down'
  latencyMs?: number
  detail?: string
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    database: SystemServiceStatus
    redis: SystemServiceStatus
    meilisearch: SystemServiceStatus
    solidcom: SystemServiceStatus
  }
}

export interface SolidcomStatusResponse {
  integration: 'solidcom'
  enabled?: boolean
  removable?: boolean
  note?: string
  productsCount: number
  lastSync: SolidcomSyncHistoryItem | null
  history: SolidcomSyncHistoryItem[]
}

export interface IntegrationModuleDescriptor {
  key: 'solidcom' | 'hubspot' | 'rdstation' | 'meta-pixel' | 'nfe' | 'payments'
  name: string
  enabled: boolean
  removable: boolean
  notes?: string
}

export interface SolidcomOrderSyncFailureItem {
  id: string
  orderId: string
  action: 'SYNC_ORDER_FAILED' | 'SYNC_ORDER_RETRY_FAILED'
  createdAt: string
  details: Record<string, unknown>
}

export interface SolidcomOrderSyncFailuresResponse {
  total: number
  items: SolidcomOrderSyncFailureItem[]
}

export interface SolidcomOrderSyncFailureDetailResponse {
  found: boolean
  orderId: string
  action?: 'SYNC_ORDER_FAILED' | 'SYNC_ORDER_RETRY_FAILED'
  createdAt?: string
  details?: Record<string, unknown>
}

export interface InternalOrderCustomerContractResponse {
  id: string
  cpf?: string | null
  name: string | null
  whatsapp: string
  email: string | null
}

export interface InternalOrderItemContractResponse {
  productId: string
  productName: string | null
  ean: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  scannedCode?: string | null
}

export interface InternalOrderContractResponse {
  orderId: string
  customerId: string
  fulfillmentType?: string
  fulfillmentSlotId?: string | null
  deliveryAreaId?: string | null
  status: string
  paymentStatus?: string
  paymentMethod: string
  subtotal: number
  delivery: number
  discount: number
  total: number
  notes: string | null
  customer: InternalOrderCustomerContractResponse
  items: InternalOrderItemContractResponse[]
}

export interface SolidcomOrderContractPreviewResponse {
  found: boolean
  orderId: string
  source?: 'snapshot' | 'live'
  contract?: InternalOrderContractResponse
  externalPreview?: Record<string, unknown>
}

export interface SolidcomOrderContractHistoryItem {
  id: string
  action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT' | 'INTERNAL_ORDER_CANCELLATION_SNAPSHOT'
  createdAt: string
  contract: InternalOrderContractResponse | null
  externalPreview: Record<string, unknown> | null
  externalOrderNumber: number | null
  reason: string | null
}

export interface SolidcomOrderContractHistoryResponse {
  orderId: string
  total: number
  items: SolidcomOrderContractHistoryItem[]
}

export interface PaymentsHealthResponse {
  integration: 'payments'
  status: 'ready' | 'partial' | 'not_configured'
  configured: boolean
  provider: string
  checks: {
    providerName: boolean
    providerUrl: boolean
    webhookSecret: boolean
    pixKey: boolean
    manualPixFallback: boolean
  }
  notes: string
}

export interface SolidcomRemoteOrderResponse {
  found: boolean
  orderId: string
  externalOrderNumber: number
  remoteOrder: Record<string, unknown>
}

export interface SolidcomReconcileItem {
  orderId: string
  externalOrderNumber: number | null
  status: 'matched' | 'local_only' | 'remote_only'
  localSnapshot: Record<string, unknown> | null
  remoteOrder: Record<string, unknown> | null
}

export interface SolidcomReconcileResponse {
  period: { from: string; to: string }
  summary: { total: number; matched: number; localOnly: number; remoteOnly: number }
  items: SolidcomReconcileItem[]
}

export interface CrmHealthResponse {
  integration: 'crm'
  provider: 'HubSpot'
  status: 'ready' | 'partial' | 'not_configured'
  configured: boolean
  portalId: string | null
  checks: {
    apiKey: boolean
    portalId: boolean
    defaultOwner: boolean
  }
  notes: string
}

export interface FiscalHealthResponse {
  integration: 'fiscal'
  provider: string
  status: 'ready' | 'partial' | 'not_configured'
  configured: boolean
  checks: {
    providerName: boolean
    providerUrl: boolean
    apiKey: boolean
    cnpjEmitente: boolean
    certPath: boolean
  }
  notes: string
}

export interface CrmContactContract {
  customerId: string
  email: string | null
  firstName: string
  lastName: string
  phone: string
  cpf: string
  lifecycleStage: 'customer'
  eventType: 'customer_registered'
  registeredAt: string
  properties: {
    email: string | null
    firstname: string
    lastname: string
    phone: string
    cpf_documento: string
    lifecyclestage: string
  }
}

export interface CrmContactPreviewResponse {
  found: boolean
  customerId: string
  source?: 'live'
  contract?: CrmContactContract
}

export interface FiscalDocumentItemContract {
  productId: string
  ean: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  ncm: string
  cfop: string
  cst: string
  unidade: string
}

export interface FiscalDocumentContract {
  orderId: string
  naturezaOperacao: string
  dataEmissao: string
  emitenteCnpj: string
  destinatarioNome: string
  destinatarioCpf: string
  valorSubtotal: number
  valorDesconto: number
  valorFrete: number
  valorTotal: number
  observacoes: string | null
  itens: FiscalDocumentItemContract[]
}

export interface FiscalDocumentPreviewResponse {
  found: boolean
  orderId: string
  source?: 'live'
  contract?: FiscalDocumentContract
}

export interface ChargeContract {
  orderId: string
  customerId: string
  customerName: string
  customerPhone: string
  amount: number
  method: string
  description: string
  pixKey: string | null
  expiresInSeconds: number
  metadata: { orderId: string; customerId: string; paymentMethod: string }
}

export interface ChargePreviewResponse {
  found: boolean
  orderId: string
  source?: 'live'
  contract?: ChargeContract
}

export interface IntegrationSnapshotHistoryItem {
  id: string
  action: string
  createdAt: string
  contract: Record<string, unknown> | null
}

export interface CrmContactHistoryResponse {
  customerId: string
  total: number
  items: IntegrationSnapshotHistoryItem[]
}

export interface CrmSyncResult {
  success: boolean
  hubspotId?: string
  action?: 'created' | 'updated'
  error?: string
  contract?: CrmContactContract
}

export interface FiscalEmitResult {
  success: boolean
  ref?: string
  chaveNfe?: string
  numeroNfe?: string
  error?: string
  contract?: FiscalDocumentContract
}

export interface ChargeResult {
  success: boolean
  chargeId?: string
  paymentTransactionId?: string
  paymentUrl?: string
  pixCopiaECola?: string
  error?: string
  contract?: ChargeContract
}

export interface PaymentEventLedgerItem {
  id: string
  transactionId: string
  type: string
  signatureOk: boolean
  providerEventId?: string | null
  receivedAt: string
}

export interface RefundLedgerItem {
  id: string
  orderId: string
  transactionId?: string | null
  status: string
  amount: number | string
  reason: string
  providerRef?: string | null
  createdAt: string
}

export interface PaymentTransactionLedgerItem {
  id: string
  orderId: string
  provider: string
  method: string
  status: string
  amount: number | string
  currency: string
  providerRef?: string | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  events?: PaymentEventLedgerItem[]
  refunds?: RefundLedgerItem[]
}

export interface PaymentTransactionsResponse {
  total: number
  items: PaymentTransactionLedgerItem[]
}

export interface PaymentReconciliationResponse {
  run: Record<string, unknown>
  summary: {
    matched: number
    missingProvider: number
    missingLocal: number
    amountMismatch: number
    totalDifference: number
  }
  report: {
    matched: Array<Record<string, unknown>>
    missingProvider: Array<Record<string, unknown>>
    missingLocal: Array<Record<string, unknown>>
    amountMismatch: Array<Record<string, unknown>>
    generatedAt: string
  }
}

export interface IntegrationConnectorItem {
  id: string
  tenantId: string
  storeId: string
  type: string
  provider: string
  status: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
  health?: {
    pending: number
    failed: number
    dead: number
    lastJobStatus?: string | null
    lastJobAt?: string | null
  }
}

export interface OutboxEventItem {
  id: string
  tenantId: string
  storeId: string
  connectorId?: string | null
  aggregate: string
  aggregateId: string
  type: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  maxAttempts: number
  idempotencyKey?: string | null
  nextRetryAt?: string | null
  lockedAt?: string | null
  processedAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
  connector?: IntegrationConnectorItem | null
}

export interface IntegrationJobItem {
  id: string
  connectorId: string
  outboxEventId?: string | null
  type: string
  status: string
  payload: Record<string, unknown>
  result?: Record<string, unknown> | null
  attempts: number
  error?: string | null
  idempotencyKey?: string | null
  nextRetryAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
  connector?: IntegrationConnectorItem
  attemptLogs?: Array<Record<string, unknown>>
}

export interface IntegrationDeadLetterItem {
  id: string
  connectorId?: string | null
  outboxEventId?: string | null
  jobId?: string | null
  reason: string
  payload: Record<string, unknown>
  lastError?: string | null
  replayCount: number
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
  connector?: IntegrationConnectorItem | null
}

export interface IntegrationListResponse<T> {
  total: number
  items: T[]
}

export interface IntegrationOperationsPanel {
  connectors: number
  outbox: Record<string, number>
  jobs: Record<string, number>
  deadLetters: number
  recentAttempts: Array<Record<string, unknown>>
}

export interface WebhookEvent {
  id: string
  chargeId: string
  event?: string
  orderId?: string
  status?: string
  mappedStatus?: string
  amount?: number
  paidAt?: string
  createdAt: string
}

export interface WebhookEventsResponse {
  total: number
  items: WebhookEvent[]
}

export interface FiscalDocumentHistoryResponse {
  orderId: string
  total: number
  items: IntegrationSnapshotHistoryItem[]
}

export interface ChargeHistoryResponse {
  orderId: string
  total: number
  items: IntegrationSnapshotHistoryItem[]
}

export interface SalesAnalyticsPoint {
  date: string
  total: number
  orders: number
}

export interface SalesAnalyticsResponse {
  period: string
  data: SalesAnalyticsPoint[]
}

export interface StatusAnalyticsResponse {
  total: number
  data: Array<{ status: string; count: number }>
}

export interface RevenueAnalyticsResponse {
  today: number
  week: number
  month: number
  delta: {
    todayVsYesterday: number
    weekVsPreviousWeek: number
    monthVsPreviousMonth: number
  }
}

export interface TopProductAnalyticsItem {
  productId: string
  name: string
  ean: string
  quantity: number
  revenue: number
  orders: number
}

// Phase 17 — Analytics Pro
export interface CustomerOriginItem {
  origin: string
  count: number
}

export interface CategoryRevenueItem {
  category: string
  revenue: number
  orders: number
}

export interface RevenueHeatmapPoint {
  dayOfWeek: number
  hourOfDay: number
  total: number
}

export interface ConversionFunnelResponse {
  views: number
  addedToCart: number
  checkoutStarted: number
  purchased: number
}

export interface SearchInsightTerm {
  query: string
  count: number
  noResults: number
  noResultRate: number
  suggestionUsage: number
  correctedCount: number
  suggestionRate: number
  correctedRate: number
  addToCartCount: number
  conversionRate: number
  adDemandScore: number
  lastAt: string
}

export interface SearchCorrectionInsight {
  originalQuery: string
  correctedQuery: string
  count: number
  lastAt: string
}

export interface SearchInsightsResponse {
  totals: {
    searches: number
    uniqueTerms: number
    noResultSearches: number
    noResultRate: number
    suggestionUsage: number
    correctedSearches: number
    correctionRate: number
    avgResults: number
    searchesWithKnownResultCount: number
    searchAddToCart: number
    searchConversionRate: number
  }
  topTerms: SearchInsightTerm[]
  noResultTerms: SearchInsightTerm[]
  topConvertingTerms: Array<{
    query: string
    searches: number
    addToCartCount: number
    conversionRate: number
  }>
  adOpportunities: Array<{
    query: string
    searches: number
    noResultRate: number
    suggestionRate: number
    correctedRate: number
    adDemandScore: number
    adTier: 'ouro' | 'prata' | 'bronze'
  }>
  topCorrections: SearchCorrectionInsight[]
  topCorrectedIntentTargets: Array<{
    query: string
    count: number
  }>
}

export interface AdminOrderItem {
  id: string
  productId: string
  product?: { name: string; ean: string }
  quantity: number
  unitPrice: number
  subtotal: number
  requestedQuantity?: number | string | null
  fulfilledQuantity?: number | string | null
  finalUnitPrice?: number | string | null
  finalSubtotal?: number | string | null
  status?: string
  substitutionPolicy?: string
  substitutedByItemId?: string | null
  cutReason?: string | null
  pickerNotes?: string | null
}

export interface AdminOrderEvent {
  id: string
  orderId: string
  type: string
  payload: Record<string, unknown>
  actorType: string
  actorId?: string | null
  createdAt: string
}

export interface AdminOrder {
  id: string
  customerId: string
  customer?: { id: string; name: string; whatsapp: string; email?: string }
  businessAccountId?: string | null
  businessAccount?: { id: string; name: string; document: string } | null
  businessApprovalStatus?: string
  businessPaymentTerms?: string | null
  items: AdminOrderItem[]
  subtotal: number
  discount: number
  delivery: number
  total: number
  status: string
  paymentStatus?: string
  paymentMethod?: string
  notes?: string | null
  cancellationReason?: string | null
  channel?: string
  fulfillmentType?: string
  createdAt: string
  events?: AdminOrderEvent[]
}

export interface PickingTaskItem {
  id: string
  taskId: string
  orderItemId: string
  productId: string
  requestedQuantity: number | string
  pickedQuantity?: number | string | null
  finalWeight?: number | string | null
  status: string
  barcode?: string | null
  notes?: string | null
}

export interface PackingChecklist {
  id: string
  orderId: string
  taskId?: string | null
  status: string
  items: Array<Record<string, unknown>>
  checkedById?: string | null
  notes?: string | null
  createdAt: string
}

export interface PickingTask {
  id: string
  tenantId: string
  storeId: string
  orderId: string
  status: string
  priority: number
  slaDueAt?: string | null
  assignedToId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  items: PickingTaskItem[]
  order?: AdminOrder | null
  checklist?: PackingChecklist | null
}

export interface PickingPerformanceResponse {
  period: { from: string; to: string }
  totals: { tasks: number; completed: number; delayed: number }
  delayedByStage: Record<string, number>
  pickers: Array<{
    pickerId: string
    tasksCompleted: number
    itemsPicked: number
    itemsMissing: number
    substitutions: number
    pickingSeconds: number
    avgStartDelaySeconds: number
    itemsPerMinute: number
  }>
  snapshots: Array<Record<string, unknown>>
}

export interface AdminCustomer {
  id: string
  name: string
  cpf: string
  whatsapp: string
  email?: string
  createdAt: string
  addresses?: Array<{
    id: string
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
    isDefault: boolean
  }>
}

export interface BusinessAccount {
  id: string
  tenantId: string
  storeId: string
  name: string
  document: string
  status: string
  creditLimit?: number | string | null
  minimumOrder?: number | string | null
  paymentTerms?: string | null
  invoiceProfile?: Record<string, unknown> | null
  recurringRules?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: {
    users: number
    priceLists: number
    orders: number
    shoppingLists?: number
  }
}

export interface BusinessFinancialSummary {
  accountId: string
  name: string
  document: string
  status: string
  activeUsers: number
  orderCount: number
  usedCredit: number
  creditLimit: number | null
  availableCredit: number | null
  minimumOrder?: number | null
  paymentTerms?: string | null
  pendingApprovals: number
}

export interface CreateBusinessAccountPayload {
  name: string
  document: string
  creditLimit?: number | null
  minimumOrder?: number | null
  paymentTerms?: string
  invoiceProfile?: Record<string, unknown>
  recurringRules?: Record<string, unknown>
}

export interface BusinessShoppingList {
  id: string
  tenantId: string
  storeId: string
  customerId: string
  businessAccountId?: string | null
  name: string
  source: string
  status: string
  createdAt: string
  updatedAt: string
  customer?: AdminCustomer
  items: Array<{
    id: string
    productId: string
    quantity: number | string
    sortOrder: number
  }>
}

export interface BusinessPriceListPayload {
  name: string
  channel?: string
  items: Array<{
    productId: string
    price: number
    cost?: number | null
  }>
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetryableConfig = {
  _retryCount?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getApiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  const err = error as Record<string, unknown> | null | undefined
  
  if (typeof err?.userMessage === 'string' && err.userMessage.trim()) {
    return err.userMessage
  }

  const data = (err?.response as Record<string, unknown>)?.data
  const msg = (data as Record<string, unknown>)?.message

  if (Array.isArray(msg)) {
    return msg.join('\n')
  }

  if (typeof msg === 'string' && msg.trim()) {
    return msg
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message
  }

  return fallback
}

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = (error.config || {}) as RetryableConfig
    const status = error.response?.status
    const requestUrl = String(error.config?.url || '')
    const isAuthEndpoint = requestUrl.includes('/auth/login')
    const hasResponse = !!error.response
    const shouldRetryNetworkOrServer = !hasResponse || (status >= 500 && status < 600)

    if (shouldRetryNetworkOrServer) {
      const retryCount = config._retryCount || 0
      if (retryCount < 2) {
        config._retryCount = retryCount + 1
        const delayMs = 300 * Math.pow(2, retryCount)
        await sleep(delayMs)
        return api.request({ ...(error.config || {}), ...config })
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminData')

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      error.userMessage = 'Sessao expirada. Faca login novamente.'
    }

    if (status === 403) {
      if (window.location.pathname !== '/forbidden') {
        window.location.href = '/forbidden'
      }
      error.userMessage = 'Acesso negado para este recurso.'
    }

    if (status === 404) {
      error.userMessage = 'Recurso nao encontrado.'
    }

    if (status === 429) {
      error.userMessage = 'Muitas tentativas de login. Aguarde 1 minuto e tente novamente.'
    }

    if (status === 500) {
      error.userMessage = 'Erro interno do servidor. Tente novamente.'
    }

    if (!hasResponse) {
      error.userMessage = 'Sem conexao com o servidor. Verifique sua internet e tente novamente.'
    }

    return Promise.reject(error)
  },
)

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
}

export const productsAPI = {
  getAll: () => api.get('/products'),
  getAdmin: (params: {
    page?: number
    limit?: number
    search?: string
    classification01?: string
    classification02?: string
    classification03?: string
    classification04?: string
    outOfStock?: boolean
    inactive?: boolean
    uncategorized?: boolean
  }) =>
    api.get<AdminProductsResponse>('/products/admin', { params }),
  getMercadologicalTree: () => api.get<MercadologicalTreeResponse>('/products/admin/mercadological-tree'),
  getAvailabilityMetrics: () => api.get<ProductAvailabilityMetricsResponse>('/products/admin/availability-metrics'),
  syncTaxonomy: () => api.post<TaxonomySyncResponse>('/products/admin/taxonomy/sync'),
  createAdmin: (data: ProductPayload) => api.post('/products/admin', data),
  create: (data: ProductPayload) => api.post('/products', data),
  update: (id: string, data: Partial<ProductPayload>) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  bulkUpdateStatus: (ids: string[], active: boolean) => api.patch('/products/admin/bulk-status', { ids, active }),
  bulkDelete: (ids: string[]) => api.post('/products/admin/bulk-delete', { ids }),
  sync: () => api.get('/products/sync'),
  getTopAnalytics: (limit = 5) => api.get<TopProductAnalyticsItem[]>('/products/analytics/top', { params: { limit } }),
  uploadImage: (ean: string, file: File, slot: '1' | '2' = '1') => {
    const formData = new FormData()
    formData.append('file', file)
    const url = slot === '2' ? `/uploads/product/${ean}/2` : `/uploads/product/${ean}`
    return api.post<{ success: boolean; url: string }>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export const ordersAPI = {
  getAll: (params?: { status?: string; search?: string }) => api.get<AdminOrder[]>('/admin/orders', { params }),
  getOne: (id: string) => api.get<AdminOrder>(`/admin/orders/${id}`),
  updateStatus: (id: string, status: string, reason?: string) =>
    status === 'CANCELLED'
      ? api.post<AdminOrder>(`/admin/orders/${id}/cancel`, { ...(reason && { reason }) })
      : api.post<{ order: AdminOrder; event: AdminOrderEvent }>(`/admin/orders/${id}/events`, {
          type: orderEventTypeForStatus(status),
          status,
          payload: { ...(reason && { reason }) },
        }),
  update: (id: string, data: { paymentStatus?: string; paymentMethod?: string }) => api.put(`/orders/${id}`, data),
  cancelItem: (orderId: string, itemId: string, data?: { reason?: string; pickerNotes?: string }) =>
    api.post(`/admin/orders/${orderId}/items/${itemId}/cancel`, data ?? {}),
  substituteItem: (orderId: string, itemId: string, data: { substituteProductId: string; quantity?: number; reason?: string; pickerNotes?: string }) =>
    api.post(`/admin/orders/${orderId}/items/${itemId}/substitute`, data),
  recalculate: (id: string) => api.post<AdminOrder>(`/admin/orders/${id}/recalculate`),
  getSalesAnalytics: (period = 'week') => api.get<SalesAnalyticsResponse>('/orders/analytics/sales', { params: { period } }),
  getStatusAnalytics: () => api.get<StatusAnalyticsResponse>('/orders/analytics/status'),
  getRevenueAnalytics: () => api.get<RevenueAnalyticsResponse>('/orders/analytics/revenue'),
  // Phase 17
  getCategoryRevenue: () => api.get<CategoryRevenueItem[]>('/orders/analytics/category-revenue'),
  getRevenueHeatmap: () => api.get<RevenueHeatmapPoint[]>('/orders/analytics/heatmap'),
}

function orderEventTypeForStatus(status: string) {
  const eventByStatus: Record<string, string> = {
    CREATED: 'order.created',
    PAYMENT_PENDING: 'order.payment_pending',
    CONFIRMED: 'order.confirmed',
    PICKING_PENDING: 'order.picking_pending',
    PICKING: 'order.picking_started',
    WAITING_CUSTOMER_SUBSTITUTION: 'order.waiting_customer_substitution',
    CONFERENCE_PENDING: 'order.conference_pending',
    PACKING: 'order.packed',
    READY_FOR_PICKUP: 'order.ready_for_pickup',
    READY_FOR_DELIVERY: 'order.ready_for_delivery',
    OUT_FOR_DELIVERY: 'order.out_for_delivery',
    DELIVERED: 'order.delivered',
    COMPLETED: 'order.completed',
    PARTIALLY_CANCELLED: 'order.partially_cancelled',
    REFUNDED: 'order.refunded',
    FAILED_SYNC: 'order.failed_sync',
  }
  return eventByStatus[status] || 'order.status_updated'
}

export const pickingAPI = {
  getEligibleOrders: (limit = 50) => api.get<AdminOrder[]>('/admin/picking/eligible-orders', { params: { limit } }),
  getTasks: (params?: { status?: string; assignedToId?: string; limit?: number }) =>
    api.get<PickingTask[]>('/admin/picking/tasks', { params }),
  getTask: (id: string) => api.get<PickingTask>(`/admin/picking/tasks/${id}`),
  createTask: (data: { orderId: string; assignedToId?: string; slaDueAt?: string; priority?: number }) =>
    api.post<PickingTask>('/admin/picking/tasks', data),
  createTaskFromOrder: (orderId: string, data?: { assignedToId?: string; slaDueAt?: string; priority?: number }) =>
    api.post<PickingTask>(`/admin/picking/tasks/from-order/${orderId}`, data ?? {}),
  assignTask: (id: string, pickerId: string) =>
    api.post<PickingTask>(`/admin/picking/tasks/${id}/assign`, { pickerId }),
  startTask: (id: string) => api.post<PickingTask>(`/admin/picking/tasks/${id}/start`),
  pickItem: (taskId: string, itemId: string, data: { quantity: number; finalWeight?: number; barcode?: string; notes?: string }) =>
    api.post<PickingTask>(`/admin/picking/tasks/${taskId}/items/${itemId}/pick`, data),
  markMissing: (taskId: string, itemId: string, data: { reason: string; requestSubstitution?: boolean; notes?: string }) =>
    api.post<{ task: PickingTask; suggestions: AdminProduct[] }>(`/admin/picking/tasks/${taskId}/items/${itemId}/missing`, data),
  substituteItem: (taskId: string, itemId: string, data: { substituteProductId: string; quantity?: number; reason?: string; notes?: string }) =>
    api.post<PickingTask>(`/admin/picking/tasks/${taskId}/items/${itemId}/substitute`, data),
  finishTask: (id: string, data?: { notes?: string }) =>
    api.post<PickingTask>(`/admin/picking/tasks/${id}/finish`, data ?? {}),
  conferenceTask: (id: string, data?: { justification?: string; notes?: string }) =>
    api.post<PickingTask>(`/admin/picking/tasks/${id}/conference`, data ?? {}),
  completePackingChecklist: (id: string, data?: { notes?: string; items?: Array<Record<string, unknown>>; metadata?: Record<string, unknown> }) =>
    api.post<PickingTask>(`/admin/picking/tasks/${id}/packing-checklist`, data ?? {}),
  getPerformance: (params?: { from?: string; to?: string }) =>
    api.get<PickingPerformanceResponse>('/admin/picking/performance', { params }),
}

export const customersAPI = {
  getAll: (search?: string) => api.get<AdminCustomer[]>('/customers', { params: search ? { search } : undefined }),
  getOne: (id: string) => api.get<AdminCustomer>(`/customers/${id}`),
  // Phase 17
  getOriginAnalytics: () => api.get<CustomerOriginItem[]>('/customers/analytics/origin'),
}

export const businessAccountsAPI = {
  list: () => api.get<BusinessAccount[]>('/admin/business-accounts'),
  create: (data: CreateBusinessAccountPayload) => api.post<BusinessAccount>('/admin/business-accounts', data),
  addUser: (accountId: string, data: { customerId: string; role?: string }) =>
    api.post(`/admin/business-accounts/${accountId}/users`, data),
  getFinancial: (accountId: string) =>
    api.get<BusinessFinancialSummary>(`/admin/business-accounts/${accountId}/financial`),
  createPriceList: (accountId: string, data: BusinessPriceListPayload) =>
    api.post(`/admin/business-accounts/${accountId}/price-list`, data),
  listShoppingLists: (accountId: string) =>
    api.get<BusinessShoppingList[]>(`/admin/business-accounts/${accountId}/shopping-lists`),
  createShoppingList: (accountId: string, data: { name: string; customerId?: string; items: Array<{ productId: string; quantity?: number }> }) =>
    api.post<BusinessShoppingList>(`/admin/business-accounts/${accountId}/shopping-lists`, data),
  createRecurringOrder: (accountId: string, data?: { shoppingListId?: string; requiresApproval?: boolean; force?: boolean }) =>
    api.post(`/admin/business-accounts/${accountId}/recurring-orders`, data ?? {}),
  runBillingForAccount: (accountId: string, data?: { limit?: number }) =>
    api.post(`/admin/business-accounts/${accountId}/billing/run`, data ?? {}),
  billOrder: (orderId: string) =>
    api.post(`/admin/business-accounts/orders/${orderId}/billing`),
  listPendingApprovals: () => api.get<AdminOrder[]>('/admin/business-accounts/approvals/pending'),
  approveOrder: (orderId: string) => api.post<AdminOrder>(`/admin/business-accounts/orders/${orderId}/approve`),
}

export const integrationsAPI = {
  getSystemHealth: () => api.get<SystemHealthResponse>('/health/detail', { params: { t: Date.now() } }),
  getModules: () => api.get<{ items: IntegrationModuleDescriptor[] }>('/integrations/modules'),
  setModuleEnabled: (key: IntegrationModuleDescriptor['key'], enabled: boolean) =>
    api.patch<IntegrationModuleDescriptor>(`/integrations/modules/${key}`, { enabled }),
  getOperationsPanel: () => api.get<IntegrationOperationsPanel>('/integrations/operations/panel'),
  listConnectors: (params?: { type?: string; provider?: string; status?: string }) =>
    api.get<IntegrationListResponse<IntegrationConnectorItem>>('/integrations/connectors', { params }),
  createConnector: (data: { type: string; provider: string; status?: string; config?: Record<string, unknown> }) =>
    api.post<IntegrationConnectorItem>('/integrations/connectors', data),
  listOutboxEvents: (params?: { status?: string; connectorId?: string; aggregate?: string; aggregateId?: string; limit?: number }) =>
    api.get<IntegrationListResponse<OutboxEventItem>>('/integrations/outbox/events', { params }),
  enqueueOutboxEvent: (data: {
    connectorId?: string
    connectorType?: string
    provider?: string
    aggregate: string
    aggregateId: string
    type: string
    payload: Record<string, unknown>
    idempotencyKey?: string
    maxAttempts?: number
  }) => api.post<{ event: OutboxEventItem; duplicate: boolean }>('/integrations/outbox/events', data),
  replayOutboxEvent: (eventId: string) => api.post<OutboxEventItem>(`/integrations/outbox/events/${eventId}/replay`),
  runOutboxWorker: (limit = 10) => api.post('/integrations/outbox/worker/run', { limit }),
  listIntegrationJobs: (params?: { status?: string; connectorId?: string; limit?: number }) =>
    api.get<IntegrationListResponse<IntegrationJobItem>>('/integrations/jobs', { params }),
  listDeadLetters: (params?: { connectorId?: string; unresolvedOnly?: boolean; limit?: number }) =>
    api.get<IntegrationListResponse<IntegrationDeadLetterItem>>('/integrations/dead-letters', { params }),
  replayDeadLetter: (deadLetterId: string) =>
    api.post<{ deadLetterId: string; replayEventId: string }>(`/integrations/dead-letters/${deadLetterId}/replay`),
  getSolidcomStatus: () => api.get<SolidcomStatusResponse>('/integrations/solidcom/status'),
  getOrderSyncFailures: (params?: {
    limit?: number
    action?: 'SYNC_ORDER_FAILED' | 'SYNC_ORDER_RETRY_FAILED'
    from?: string
    to?: string
  }) => api.get<SolidcomOrderSyncFailuresResponse>('/integrations/solidcom/orders/failures', { params }),
  getOrderSyncFailure: (orderId: string) =>
    api.get<SolidcomOrderSyncFailureDetailResponse>(`/integrations/solidcom/orders/${orderId}/failure`),
  getOrderContract: (orderId: string) =>
    api.get<SolidcomOrderContractPreviewResponse>(`/integrations/solidcom/orders/${orderId}/contract`),
  getOrderContractHistory: (orderId: string, limit = 10) =>
    api.get<SolidcomOrderContractHistoryResponse>(`/integrations/solidcom/orders/${orderId}/contracts`, { params: { limit } }),
  getRemoteOrder: (orderId: string) =>
    api.get<SolidcomRemoteOrderResponse>(`/integrations/solidcom/orders/${orderId}/remote`),
  reconcileOrdersByPeriod: (from: string, to: string) =>
    api.get<SolidcomReconcileResponse>('/integrations/solidcom/orders/period', { params: { from, to } }),
  retryOrderSync: (orderId: string) => api.post(`/integrations/solidcom/orders/${orderId}/retry`),

  getPaymentsHealth: () => api.get<PaymentsHealthResponse>('/integrations/payments/health'),
  listPaymentTransactions: (params?: { orderId?: string; status?: string; provider?: string; limit?: number }) =>
    api.get<PaymentTransactionsResponse>('/integrations/payments/transactions', { params }),
  getCrmHealth: () => api.get<CrmHealthResponse>('/integrations/crm/health'),
  getFiscalHealth: () => api.get<FiscalHealthResponse>('/integrations/fiscal/health'),
  getCrmContactPreview: (customerId: string) =>
    api.get<CrmContactPreviewResponse>(`/integrations/crm/contact-preview/${customerId}`),
  getCrmContactHistory: (customerId: string, limit = 8) =>
    api.get<CrmContactHistoryResponse>(`/integrations/crm/contact-preview/${customerId}/history`, { params: { limit } }),
  syncCrmContact: (customerId: string) =>
    api.post<CrmSyncResult>(`/integrations/crm/contact-sync/${customerId}`),
  replayCrmContact: (snapshotId: string) =>
    api.post<CrmSyncResult>(`/integrations/crm/contact-replay/${snapshotId}`),
  getFiscalDocumentPreview: (orderId: string) =>
    api.get<FiscalDocumentPreviewResponse>(`/integrations/fiscal/document-preview/${orderId}`),
  getFiscalDocumentHistory: (orderId: string, limit = 8) =>
    api.get<FiscalDocumentHistoryResponse>(`/integrations/fiscal/document-preview/${orderId}/history`, { params: { limit } }),
  emitFiscalDocument: (orderId: string) =>
    api.post<FiscalEmitResult>(`/integrations/fiscal/document-emit/${orderId}`),
  replayFiscalDocument: (snapshotId: string) =>
    api.post<FiscalEmitResult>(`/integrations/fiscal/document-replay/${snapshotId}`),
  getChargePreview: (orderId: string) =>
    api.get<ChargePreviewResponse>(`/integrations/payments/charge-preview/${orderId}`),
  getChargeHistory: (orderId: string, limit = 8) =>
    api.get<ChargeHistoryResponse>(`/integrations/payments/charge-preview/${orderId}/history`, { params: { limit } }),
  chargePayment: (orderId: string) =>
    api.post<ChargeResult>(`/integrations/payments/charge/${orderId}`),
  createPaymentTransaction: (orderId: string, data: {
    provider?: string
    method?: string
    status?: string
    amount?: number
    providerRef?: string
    idempotencyKey?: string
    metadata?: Record<string, unknown>
  }) => api.post<PaymentTransactionLedgerItem>(`/integrations/payments/orders/${orderId}/transaction`, data),
  createPaymentRefund: (data: { orderId: string; transactionId?: string; amount: number; reason: string; providerRef?: string }) =>
    api.post<RefundLedgerItem>('/integrations/payments/refunds', data),
  registerPaymentChargeback: (data: { orderId?: string; transactionId?: string; providerRef?: string; amount: number; reason: string }) =>
    api.post('/integrations/payments/chargebacks', data),
  reconcilePayments: (data: {
    provider?: string
    from: string
    to: string
    dryRun?: boolean
    providerRows?: Array<{ providerRef: string; amount: number; status?: string; metadata?: Record<string, unknown> }>
  }) => api.post<PaymentReconciliationResponse>('/integrations/payments/reconciliation', data),
  replayCharge: (snapshotId: string) =>
    api.post<ChargeResult>(`/integrations/payments/charge-replay/${snapshotId}`),
  listWebhookEvents: (limit = 30) =>
    api.get<WebhookEventsResponse>(`/integrations/payments/webhook/events`, { params: { limit } }),
}

export const cmsAPI = {
  categories: {
    getAll: () => api.get('/cms/categories'),
    getMappingStats: () => api.get('/api/categories/stats/mapping'),
    getPendingMappings: (params?: { limit?: number; offset?: number }) =>
      api.get<{ success: boolean; data: PendingCategoryMappingItem[]; pagination: { limit: number; offset: number; total: number } }>(
        '/api/categories/pending/list',
        { params },
      ),
    create: (data: { name: string; priority?: number; limit?: number }) =>
      api.post('/cms/categories', data),
    update: (id: string, data: any) => api.patch(`/cms/categories/${id}`, data),
    remove: (id: string) => api.delete(`/cms/categories/${id}`),
    approvePendingMapping: (id: string, data: { categoryId: string; subcategoryId?: string; notes?: string }) =>
      api.post(`/api/admin/categories/pending/${id}/approve`, data),
    rejectPendingMapping: (id: string, data?: { notes?: string }) =>
      api.post(`/api/admin/categories/pending/${id}/reject`, data ?? {}),
    getMappingByEan: (ean: string) =>
      api.get<{ success: boolean; found: boolean; data: CmsProductCategoryMapping | null }>(
        `/api/admin/categories/mappings/by-ean/${ean}`,
      ),
    upsertMapping: (ean: string, data: { categoryId: string; subcategoryId?: string | null }) =>
      api.post<{ success: boolean; data: CmsProductCategoryMapping }>(
        '/api/admin/categories/mappings/create',
        { ean, ...data },
      ).catch(() =>
        // fallback: se já existe, atualiza
        api.put<{ success: boolean; data: CmsProductCategoryMapping }>(
          `/api/admin/categories/mappings/${ean}`,
          { categoryId: data.categoryId, subcategoryId: data.subcategoryId ?? null },
        )
      ),
    getMappingSuggestions: (params?: { limit?: number; onlyUnmapped?: boolean }) =>
      api.get('/api/admin/categories/mappings/suggestions', { params }),
    applyMappingSuggestions: (data?: { dryRun?: boolean; limit?: number }) =>
      api.post('/api/admin/categories/mappings/apply-suggestions', data ?? {}),
  },
  classificationMappings: {
    getAll: () => api.get('/cms/categories/classification-mappings'),
    add: (data: { categoryId: string; classificationLevel: number; classificationValue: string }) =>
      api.post('/cms/categories/classification-mappings', data),
    remove: (id: string) => api.delete(`/cms/categories/classification-mappings/${id}`),
  },
  heroSlides: {
    getAll: () => api.get('/cms/hero-slides'),
    create: (data: any) => api.post('/cms/hero-slides', data),
    update: (id: string, data: any) => api.patch(`/cms/hero-slides/${id}`, data),
    remove: (id: string) => api.delete(`/cms/hero-slides/${id}`),
  },
  promoBanners: {
    getAll: () => api.get('/cms/promo-banners/all'),
    create: (data: any) => api.post('/cms/promo-banners', data),
    update: (id: string, data: any) => api.patch(`/cms/promo-banners/${id}`, data),
    remove: (id: string) => api.delete(`/cms/promo-banners/${id}`),
  },
  storeBanners: {
    getAll: () => api.get('/cms/store-banners/all'),
    create: (data: any) => api.post('/cms/store-banners', data),
    update: (id: string, data: any) => api.patch(`/cms/store-banners/${id}`, data),
    remove: (id: string) => api.delete(`/cms/store-banners/${id}`),
  },
}

export const uploadsAPI = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const analyticsAPI = {
  getInsights: () => api.get('/analytics/admin/insights'),
  getSearchInsights: (days = 14, limit = 10) =>
    api.get<SearchInsightsResponse>('/analytics/admin/search-insights', { params: { days, limit } }),
}

export const recipesAPI = {
  listCategories: () => api.get('/recipes/categories'),
  createCategory: (data: { name: string; slug: string; description?: string; active?: boolean; order?: number }) =>
    api.post('/recipes/categories', data),
  updateCategory: (id: string, data: any) => api.put(`/recipes/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/recipes/categories/${id}`),
  list: (page = 1, limit = 20, active?: boolean) =>
    api.get('/recipes', { params: { page, limit, ...(active !== undefined && { active }) } }),
  getById: (slug: string) => api.get(`/recipes/${slug}`),
  create: (data: any) => api.post('/recipes', data),
  update: (id: string, data: any) => api.put(`/recipes/${id}`, data),
  remove: (id: string) => api.delete(`/recipes/${id}`),
}

export const brandAPI = {
  get: () => api.get('/brand'),
  update: (data: {
    storeName?: string
    logoDesktopUrl?: string | null
    logoMobileUrl?: string | null
    primaryColor?: string
    secondaryColor?: string
    freeShippingThreshold?: number | null
    businessHours?: string | null
    openMessage?: string | null
    closedMessage?: string | null
    countdownLabel?: string | null
  }) => api.put('/brand', data),
}

export interface DeliveryZone {
  id: string
  name: string
  type: 'CEP_RANGE' | 'GEO_POLYGON'
  cepStart: string | null
  cepEnd: string | null
  polygonGeoJSON: string | null
  fee: number
  freeAbove: number | null
  active: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface DeliveryZonePayload {
  name: string
  type?: 'CEP_RANGE' | 'GEO_POLYGON'
  cepStart?: string
  cepEnd?: string
  polygonGeoJSON?: string | null
  fee: number
  freeAbove?: number | null
  active?: boolean
  priority?: number
}

export interface DeliveryArea {
  id: string
  name: string
  type: 'CEP_RANGE' | 'POLYGON' | 'GEO_POLYGON'
  rule: Record<string, unknown>
  fee: number | string
  minimumOrder?: number | string | null
  freeAbove?: number | string | null
  priority: number
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface FulfillmentSlotOccupancy {
  id: string
  type: 'DELIVERY' | 'PICKUP'
  startsAt: string
  endsAt: string
  capacityOrders: number
  capacityItems?: number | null
  reservedOrders: number
  reservedItems: number
  availableOrders: number
  availableItems?: number | null
  cutoffMinutes: number
  cutoffAt: string
  cutoffExpired: boolean
  occupancyPercent: number
  isFull: boolean
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
}

export interface FulfillmentSlotPayload {
  type: 'DELIVERY' | 'PICKUP'
  startsAt: string
  endsAt: string
  capacityOrders: number
  capacityItems?: number | null
  cutoffMinutes?: number
  status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
}

export interface Driver {
  id: string
  name: string
  phone?: string | null
  status: 'ACTIVE' | 'INACTIVE'
}

export interface DeliveryRoute {
  id: string
  driverId?: string | null
  status: string
  startsAt?: string | null
  completedAt?: string | null
  driver?: Driver | null
  stops: Array<{ id: string; orderId: string; sequence: number; status: string; eta?: string | null; deliveredAt?: string | null }>
}

export const deliveryAPI = {
  listZones: () => api.get<DeliveryZone[]>('/delivery/zones'),
  createZone: (data: DeliveryZonePayload) => api.post<DeliveryZone>('/delivery/zones', data),
  updateZone: (id: string, data: Partial<DeliveryZonePayload>) =>
    api.patch<DeliveryZone>(`/delivery/zones/${id}`, data),
  deleteZone: (id: string) => api.delete(`/delivery/zones/${id}`),
  calculate: (cep?: string, lat?: number, lng?: number) =>
    api.get('/delivery/calculate', {
      params: {
        ...(cep ? { cep } : {}),
        ...(lat != null ? { lat } : {}),
        ...(lng != null ? { lng } : {}),
      },
    }),
}

export const fulfillmentAPI = {
  listAreas: () => api.get<DeliveryArea[]>('/admin/fulfillment/areas'),
  createArea: (data: Omit<DeliveryArea, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<DeliveryArea>('/admin/fulfillment/areas', data),
  updateArea: (id: string, data: Partial<Omit<DeliveryArea, 'id' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<DeliveryArea>(`/admin/fulfillment/areas/${id}`, data),
  deleteArea: (id: string) => api.delete(`/admin/fulfillment/areas/${id}`),
  listSlots: (params?: { type?: 'DELIVERY' | 'PICKUP'; from?: string; to?: string; status?: string }) =>
    api.get<FulfillmentSlotOccupancy[]>('/admin/fulfillment/slots', { params }),
  createSlot: (data: FulfillmentSlotPayload) => api.post<FulfillmentSlotOccupancy>('/admin/fulfillment/slots', data),
  updateSlot: (id: string, data: Partial<FulfillmentSlotPayload>) =>
    api.patch<FulfillmentSlotOccupancy>(`/admin/fulfillment/slots/${id}`, data),
  deleteSlot: (id: string) => api.delete(`/admin/fulfillment/slots/${id}`),
  listDrivers: () => api.get<Driver[]>('/admin/fulfillment/drivers'),
  createDriver: (data: { name: string; phone?: string; status?: 'ACTIVE' | 'INACTIVE' }) =>
    api.post<Driver>('/admin/fulfillment/drivers', data),
  listRoutes: (params?: { status?: string }) => api.get<DeliveryRoute[]>('/admin/fulfillment/routes', { params }),
  createRoute: (data: { driverId?: string; startsAt?: string }) =>
    api.post<DeliveryRoute>('/admin/fulfillment/routes', data),
  addStop: (routeId: string, data: { orderId: string; sequence?: number; eta?: string }) =>
    api.post<DeliveryRoute>(`/admin/fulfillment/routes/${routeId}/stops`, data),
  startRoute: (routeId: string) => api.post<DeliveryRoute>(`/admin/fulfillment/routes/${routeId}/start`),
  updateStopStatus: (routeId: string, stopId: string, data: { status: string; notes?: string }) =>
    api.post<Record<string, unknown>>(`/admin/fulfillment/routes/${routeId}/stops/${stopId}/status`, data),
  completeRoute: (routeId: string) => api.post<DeliveryRoute>(`/admin/fulfillment/routes/${routeId}/complete`),
}

export interface FraudLog {
  id: string
  vector: 'WHATSAPP' | 'DEVICE' | 'IP'
  value: string
  orderId: string | null
  customerId: string | null
  createdAt: string
}

export const fraudAPI = {
  listLogs: (params?: { limit?: number; vector?: string }) =>
    api.get<FraudLog[]>('/orders/admin/fraud-logs', { params }),
}

export interface AdminNotification {
  id: string
  type: 'ORDER_UPDATE' | 'PROMO' | 'CAMPAIGN'
  title: string
  body: string
  customerId?: string
  read: boolean
  createdAt: string
}

export const notificationsAdminAPI = {
  broadcast: (data: {
    type: 'PROMO' | 'CAMPAIGN'
    title: string
    body: string
    customerId?: string
  }) => api.post('/notifications/admin/broadcast', data),
}
