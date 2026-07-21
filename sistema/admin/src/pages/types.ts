// Dashboard types and interfaces
import {
  AdminProduct,
  AdminOrder,
  AdminCustomer,
  SalesAnalyticsPoint,
  StatusAnalyticsResponse,
  RevenueAnalyticsResponse,
  TopProductAnalyticsItem,
  SolidcomStatusResponse,
} from '../services/api'

export type Section = 'dashboard' | 'products' | 'orders' | 'customers' | 'layout' | 'intelligence'
export type ViewMode = 'list' | 'kanban'

// Stats
export interface DashboardStats {
  orders: number
  customers: number
  products: number
  revenue: number
}

// Products
export interface ProductFormState {
  ean: string
  name: string
  alternativeDescription: string
  price: string
  promotionalPrice: string
  stock: string
  unit: string
  badges: string
  origin: string
}

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>

export interface ProductsSection {
  products: AdminProduct[]
  productsLoading: boolean
  productsError: string
  productsSearch: string
  productsPage: number
  productsTotalPages: number
  savingProduct: boolean
  syncingProducts: boolean
  solidcomStatus: SolidcomStatusResponse | null
  solidcomStatusLoading: boolean
  isProductFormOpen: boolean
  editingProductId?: string | null
  productForm?: ProductFormState
  productFormErrors?: ProductFormErrors
  // New fields for section integration
  page?: number
  limit?: number
  totalProducts?: number
  searchTerm?: string
  formOpen?: boolean
  selectedProductId?: string | null
}

// Orders
export interface OrdersSection {
  orders: AdminOrder[]
  ordersLoading: boolean
  ordersSearch: string
  ordersStatusFilter: string
  ordersDateFilter: 'all' | 'today' | '7d' | '30d'
  ordersPaymentFilter: string
  ordersViewMode: ViewMode
  draggingOrderId: string | null
  selectedOrder: AdminOrder | null
  updatingOrderStatus: boolean
  // New fields for section integration
  page?: number
  limit?: number
  totalOrders?: number
  searchTerm?: string
  filter?: string
}

// Customers
export interface CustomersSection {
  customers: AdminCustomer[]
  customersLoading: boolean
  customersSearch: string
  customersViewMode: ViewMode
  customersEmailFilter: 'all' | 'with' | 'without'
  customersAddressFilter: 'all' | 'with' | 'without'
  customersDateFilter: 'all' | '7d' | '30d' | '90d'
  customersOrderFilter?: 'all' | 'with-orders' | 'without-orders'
  customerOrderCountMap?: Record<string, number>
  selectedCustomer?: AdminCustomer | null
  // New fields for section integration
  page?: number
  limit?: number
  totalCustomers?: number
  searchTerm?: string
  formOpen?: boolean
  selectedCustomerId?: string | null
}

// Dashboard Analytics
export interface DashboardAnalytics {
  salesPeriod: 'day' | 'week' | 'month'
  salesSeries: SalesAnalyticsPoint[]
  statusAnalytics: StatusAnalyticsResponse | null
  revenueAnalytics: RevenueAnalyticsResponse | null
  topProducts: TopProductAnalyticsItem[]
  dashboardLoading: boolean
}
