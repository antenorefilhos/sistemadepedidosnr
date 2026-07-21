import axios from 'axios'
import type { Order } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const resolveApiUrl = (value?: string | null) => {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/branding/')) return value
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface WhatsAppDispatch {
  channel: 'whatsapp_web'
  to: string
  body: string
  url: string
}

export interface CreatedOrderResponse {
  order: Order
  whatsapp: WhatsAppDispatch | null
}

export interface BackendCartItem {
  id: string
  cartId: string
  productId: string
  quantity: number
  notes?: string | null
  allowSubstitution: boolean
}

export interface BackendCart {
  id: string
  tenantId: string
  storeId: string
  customerId?: string | null
  deviceId?: string | null
  status: string
  items: BackendCartItem[]
}

export interface CheckoutDeliveryPayload {
  mode?: string
  cep?: string
  zipCode?: string
  addressId?: string
  slotId?: string
  windowStart?: string
  windowEnd?: string
}

export interface FulfillmentSlot {
  id: string
  type: string
  startsAt: string
  endsAt: string
  capacityOrders: number
  capacityItems?: number | null
  reservedOrders: number
  reservedItems: number
  availableOrders: number
  availableItems?: number | null
  status: string
  isFull: boolean
  cutoffExpired: boolean
}

export interface CheckoutQuoteResponse {
  session: {
    id: string
    status: string
    orderId?: string | null
  }
  cart: BackendCart
  price: {
    subtotal: number
    deliveryAmount: number
    discountAmount: number
    total: number
    appliedPromotions?: unknown[]
  }
  delivery: {
    mode: string
    fee: number | null
    rawFee: number | null
    zoneName: string | null
    outOfArea: boolean
    validSlot: boolean
    slot: { id: string | null; windowStart: string | null; windowEnd: string | null }
  }
  stock: {
    allAvailable: boolean
    unavailableItems: Array<{ productId: string; requested: number; available: number }>
    items: Array<{
      productId: string
      requested: number
      available: number
      inStock: boolean
      allowSubstitution: boolean
      substitutionStatus: 'ACCEPTED' | 'DECLINED'
    }>
  }
  canConfirm: boolean
  blockers: string[]
}

export interface CheckoutConfirmResponse extends CreatedOrderResponse {
  session: CheckoutQuoteResponse['session']
  reused?: boolean
}

export interface CreateOrderPayload {
  customerId: string
  items: Array<{ productId: string; quantity: number }>
  idempotencyKey: string
  paymentMethod?: string
  delivery?: number
  discount?: number
  couponCode?: string
  notes?: string
  changeAmount?: string
  deviceId?: string
  deliveryAddressId?: string
}

export interface CouponValidationResult {
  valid: boolean
  code: string
  message: string
  discountAmount: number
}

export interface CreateProductPayload {
  ean: string
  name: string
  alternativeDescription?: string
  price: number
  promotionalPrice?: number
  stock?: number
  isFractional?: boolean
  unit?: string
  badges?: string
}

export interface CreateCustomerPayload {
  name: string
  cpf: string
  whatsapp: string
  email?: string
}

export interface RegisterPayload {
  name: string
  email: string
  cpf: string
  whatsapp: string
  password: string
  origin?: string
}

export interface GuestCheckoutPayload {
  name: string
  whatsapp: string
  cpf?: string
  email?: string
}

export interface CreateAddressPayload {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault?: boolean
}

type RetryableConfig = {
  _retryCount?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
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
    const isAuthEndpoint = requestUrl.includes('/auth/customer/login') || requestUrl.includes('/auth/customer/register')
    const hasResponse = !!error.response
    // Só retry em erros 5xx ou falta de response (network timeout)
    const shouldRetryNetworkOrServer = !hasResponse || (status >= 500 && status < 600)

    if (shouldRetryNetworkOrServer) {
      const retryCount = config._retryCount || 0
      // Max 1 retry com delay mais curto: 500ms base
      if (retryCount < 1) {
        config._retryCount = retryCount + 1
        const delayMs = 500
        await sleep(delayMs)
        return api.request({ ...(error.config || {}), ...config })
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
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

    if (status === 500) {
      error.userMessage = 'Erro interno do servidor. Tente novamente.'
    }

    if (!hasResponse) {
      error.userMessage = 'Sem conexao com o servidor. Verifique sua internet e tente novamente.'
    }

    return Promise.reject(error)
  },
)

// Products
export const productsAPI = {
  getAll: (
    search?: string,
    page?: number,
    limit?: number,
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    classification01?: string,
    classification02?: string,
    classification03?: string,
    classification04?: string,
  ) =>
    api.get('/products', {
      params: {
        search,
        page,
        limit,
        category,
        minPrice,
        maxPrice,
        classification01,
        classification02,
        classification03,
        classification04,
      },
    }),
  suggest: (q: string, limit = 6) => api.get('/products/suggest', { params: { q, limit } }),
  getMercadologicalTree: () => api.get('/products/mercadological-tree'),
  getOne: (id: string) => api.get(`/products/${id}`),
  getRecommendations: (id: string, limit = 6) => api.get(`/products/${id}/recommendations`, { params: { limit } }),
  create: (data: CreateProductPayload) => api.post('/products', data),
  update: (id: string, data: Partial<CreateProductPayload>) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
}

// Customers
export const customersAPI = {
  getAll: (search?: string) => api.get('/customers', { params: { search } }),
  getOne: (id: string) => api.get(`/customers/${id}`),
  create: (data: CreateCustomerPayload) => api.post('/customers', data),
  update: (id: string, data: Partial<CreateCustomerPayload>) => api.put(`/customers/${id}`, data),
}

// Orders
export const ordersAPI = {
  getAll: (customerId?: string) => api.get('/orders', { params: customerId ? { customerId } : undefined }),
  getOne: (id: string) => api.get(`/orders/${id}`),
  create: (data: CreateOrderPayload) => api.post<CreatedOrderResponse>('/orders', data),
  updateStatus: (id: string, status: string) => api.put(`/orders/${id}/status`, { status }),
}

export const checkoutAPI = {
  createCart: (data: { customerId?: string; deviceId?: string }) => api.post<BackendCart>('/cart', data),
  addCartItem: (
    cartId: string,
    data: { productId: string; quantity: number; notes?: string; allowSubstitution?: boolean },
  ) => api.post<BackendCart>(`/cart/${cartId}/items`, data),
  createSession: (data: { cartId: string; idempotencyKey: string; customerId?: string }) =>
    api.post<{ session: CheckoutQuoteResponse['session']; reused: boolean }>('/checkout/sessions', data),
  quoteSession: (
    id: string,
    data: { customerId?: string; couponCode?: string; deliveryAddressId?: string; delivery?: CheckoutDeliveryPayload },
  ) => api.post<CheckoutQuoteResponse>(`/checkout/sessions/${id}/quote`, data),
  confirmSession: (
    id: string,
    data: {
      customerId: string
      couponCode?: string
      deliveryAddressId?: string
      delivery?: CheckoutDeliveryPayload
      paymentMethod?: string
      notes?: string
      changeAmount?: string
      deviceId?: string
    },
  ) => api.post<CheckoutConfirmResponse>(`/checkout/sessions/${id}/confirm`, data),
  cancelSession: (id: string, reason?: string) => api.post(`/checkout/sessions/${id}/cancel`, { reason }),
}

export const couponsAPI = {
  validate: (code: string, subtotal: number) =>
    api.get<CouponValidationResult>('/coupons/validate', {
      params: { code, subtotal },
    }),
}

// Auth
export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/customer/login', { email, password }),
  register: (data: RegisterPayload) => api.post('/auth/customer/register', data),
  guestCheckout: (data: GuestCheckoutPayload) => api.post('/auth/customer/guest-checkout', data),
}

// Addresses
export const addressesAPI = {
  searchCEP: (cep: string) => api.get(`/addresses/search/${cep}`),
  create: (customerId: string, data: CreateAddressPayload) => api.post(`/addresses/${customerId}`, data),
}

// Delivery
export const deliveryAPI = {
  calculate: (cep?: string, lat?: number, lng?: number) =>
    api.get<{
      fee: number | null
      freeAbove: number | null
      zoneName: string | null
      zoneId: string | null
      isFree: boolean
      outOfArea?: boolean
    }>(
      '/delivery/calculate',
      { params: { ...(cep ? { cep } : {}), ...(lat != null ? { lat } : {}), ...(lng != null ? { lng } : {}) } },
    ),
  slots: (type = 'DELIVERY') =>
    api.get<FulfillmentSlot[]>('/delivery/slots', { params: { type } }),
}

// CMS
export const cmsAPI = {
  heroSlides: {
    getAll: () => api.get('/cms/hero-slides'),
  },
  storeBanners: {
    getAll: () => api.get('/cms/store-banners'),
  },
  categories: {
    getAll: () => api.get('/cms/categories'),
    getCommercial: () => api.get('/cms/categories/commercial'),
  },
  promoBanners: {
    getAll: () => api.get('/cms/promo-banners'),
  },
}

export const analyticsAPI = {
  getTopProducts: (limit = 8) => api.get('/analytics/top-products', { params: { limit } }),
}

export const recommendationsAPI = {
  getRebuy: (customerId: string, limit = 12) =>
    api.get('/recommendations/rebuy', { params: { customerId, limit } }),
  getShowcase: (segmentKey?: string, limit = 12) =>
    api.get('/recommendations/showcase', { params: { segmentKey, limit } }),
  getComplementary: (productId: string, limit = 12) =>
    api.get(`/recommendations/complementary/${productId}`, { params: { limit } }),
  getSubstitutes: (productId: string, limit = 8) =>
    api.get(`/recommendations/substitutes/${productId}`, { params: { limit } }),
}

export const recipesAPI = {
  list: (category?: string, page = 1, limit = 12) =>
    api.get('/recipes', { params: { active: true, category, page, limit } }),
  getBySlug: (slug: string) => api.get(`/recipes/${slug}`),
  categories: () => api.get('/recipes/categories'),
}

export interface Notification {
  id: string
  type: 'ORDER_UPDATE' | 'PROMO' | 'CAMPAIGN'
  title: string
  body: string
  customerId?: string
  read: boolean
  createdAt: string
}

export const notificationsAPI = {
  list: () => api.get<Notification[]>('/notifications'),
  unreadCount: () => api.get<number>('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  subscribeToPush: (subscription: any) => api.post('/notifications/push-subscribe', subscription),
}

export const brandAPI = {
  get: () => api.get('/brand'),
}
