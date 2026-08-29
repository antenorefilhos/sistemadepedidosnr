import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('driver_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('driver_token')
      localStorage.removeItem('driver_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  },
)

export interface DeliveryStop {
  id: string
  orderId: string
  sequence: number
  status: string
  eta: string | null
  deliveredAt: string | null
  order?: {
    id: string
    total: number
    status: string
    paymentMethod: string
    notes: string | null
    addressSnapshot?: {
      street?: string
      number?: string
      complement?: string
      neighborhood?: string
      city?: string
      reference?: string
    } | null
    customer?: { name: string; whatsapp: string }
  }
}

export interface DeliveryRoute {
  id: string
  driverId: string
  status: string
  startsAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  driver?: { name: string }
  stops: DeliveryStop[]
}

/** Pedido na fila compartilhada -- ainda sem dono. */
export interface AvailableDelivery {
  id: string
  total: number
  createdAt: string
  deliveryInstructions: string | null
  addressSnapshot?: {
    street?: string
    number?: string
    neighborhood?: string
    city?: string
    complement?: string
  } | null
  customer?: { name: string; whatsapp: string | null } | null
  _count?: { items: number }
}

export const driverApi = {
  /** Fila que TODOS os entregadores veem. Some da lista de todos quando alguem pega. */
  listAvailable: () => api.get<AvailableDelivery[]>('/driver/available'),

  takeDelivery: (orderId: string) =>
    api.post<DeliveryRoute>(`/driver/available/${orderId}/take`),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getMe: () => api.get('/driver/me'),

  listRoutes: () =>
    api.get<DeliveryRoute[]>('/driver/routes'),

  getRoute: (id: string) =>
    api.get<DeliveryRoute>(`/driver/routes/${id}`),

  startRoute: (id: string) =>
    api.post<DeliveryRoute>(`/driver/routes/${id}/start`),

  updateStopStatus: (routeId: string, stopId: string, status: string, notes?: string) =>
    api.post(`/driver/routes/${routeId}/stops/${stopId}/status`, { status, notes }),

  completeRoute: (id: string) =>
    api.post<DeliveryRoute>(`/driver/routes/${id}/complete`),
}

export default api
