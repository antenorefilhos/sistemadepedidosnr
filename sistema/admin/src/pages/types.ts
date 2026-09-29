// Dashboard types and interfaces
import {
  AdminOrder,
  AdminCustomer,
} from '../services/api'

export type Section = 'dashboard' | 'products' | 'orders' | 'customers' | 'layout' | 'intelligence'
export type ViewMode = 'list' | 'kanban'

// Stats
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

