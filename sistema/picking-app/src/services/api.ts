import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('picker_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('picker_token')
      localStorage.removeItem('picker_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  },
)

export interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
  requestedQuantity: number | null
  fulfilledQuantity: number | null
  status: string
  product?: {
    id: string
    name: string
    ean: string | null
    imageUrl: string | null
    unit: string | null
    isFractional: boolean | null
  }
}

export interface Order {
  id: string
  customerId: string
  status: string
  total: number
  subtotal: number
  notes: string | null
  paymentMethod: string
  createdAt: string
  /** DAV do Solidcom -- e o numero que se digita no PDV pra puxar o pedido. */
  erpDav?: string | null
  customer?: { id: string; name: string; cpf: string; whatsapp: string }
  items: OrderItem[]
  pickingTask?: PickingTask | null
}

export interface PickingTaskItem {
  id: string
  orderItemId: string
  productId: string
  requestedQuantity: number
  pickedQuantity: number | null
  finalWeight: number | null
  barcode: string | null
  notes: string | null
  status: string
}

export interface PickingTask {
  id: string
  orderId: string
  assignedToId: string | null
  status: string
  priority: number
  slaDueAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  items: PickingTaskItem[]
  order?: Order
}

export const pickerApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getMe: () => api.get('/picker/me'),

  searchOrders: (params: { q?: string; status?: string; dateFrom?: string; dateTo?: string }) =>
    api.get<Order[]>('/picker/orders', { params }),

  startOrderPicking: (orderId: string) =>
    api.post<PickingTask>(`/picker/orders/${orderId}/start`),

  sendToCashier: (orderId: string, data?: { deliveryInstructions?: string }) =>
    api.post<Order>(`/picker/orders/${orderId}/send-to-cashier`, data || {}),

  getTask: (id: string) =>
    api.get<PickingTask>(`/picker/tasks/${id}`),

  pickItem: (taskId: string, itemId: string, data: {
    quantity: number
    finalWeight?: number
    barcode?: string
    notes?: string
  }) => api.post<PickingTask>(`/picker/tasks/${taskId}/items/${itemId}/pick`, data),

  markMissing: (taskId: string, itemId: string, data: {
    reason: string
    requestSubstitution?: boolean
    notes?: string
  }) => api.post(`/picker/tasks/${taskId}/items/${itemId}/missing`, data),

  resetItem: (taskId: string, itemId: string, reason?: string) =>
    api.post<PickingTask>(`/picker/tasks/${taskId}/items/${itemId}/reset`, { reason }),

  removeItem: (taskId: string, itemId: string) =>
    api.post<PickingTask>(`/picker/tasks/${taskId}/items/${itemId}/remove`),

  addItemToOrder: (orderId: string, data: { productId: string; quantity: number; notes?: string }) =>
    api.post<PickingTask>(`/picker/orders/${orderId}/add-item`, data),

  searchProducts: (q: string) =>
    api.get<Array<{ id: string; name: string; ean: string | null; price: number; promotionalPrice: number | null; unit: string | null }>>('/picker/products/search', { params: { q } }),

  finishTask: (id: string, notes?: string) =>
    api.post<PickingTask>(`/picker/tasks/${id}/finish`, { notes }),
}

export default api
