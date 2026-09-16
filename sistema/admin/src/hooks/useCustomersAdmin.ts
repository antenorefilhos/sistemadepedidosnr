import { useCallback, useEffect, useMemo, useState } from 'react'
import { customersAPI, ordersAPI, type AdminCustomer } from '../services/api'

/** Todo o estado e logica de negocio da aba Clientes do admin -- extraido de
 * AdminDashboard (JON-65, Auditoria 360) pra tirar o arquivo de 1147 linhas. */
export function useCustomersAdmin(activeSection: string) {
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
    if (activeSection === 'customers') loadCustomers()
  }, [activeSection, loadCustomers])

  const openCustomerDetails = async (customer: AdminCustomer) => {
    try {
      const response = await customersAPI.getOne(customer.id)
      setSelectedCustomer(response.data)
    } catch {
      setSelectedCustomer(customer)
    }
  }

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

  return {
    customersSearch, setCustomersSearch,
    customersEmailFilter, setCustomersEmailFilter,
    customersAddressFilter, setCustomersAddressFilter,
    customersOrderFilter, setCustomersOrderFilter,
    customersDateFilter, setCustomersDateFilter,
    customersViewMode, setCustomersViewMode,
    loadCustomers,
    customersLoading, filteredCustomers, customerOrderCountMap,
    openCustomerDetails,
    selectedCustomer, setSelectedCustomer,
  }
}
