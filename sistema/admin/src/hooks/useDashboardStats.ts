import { useCallback, useEffect, useState } from 'react'
import { ordersAPI, customersAPI, productsAPI } from '../services/api'

/** Cartões de totais do topo do dashboard -- extraido de AdminDashboard
 * (JON-65, Auditoria 360). */
export function useDashboardStats() {
  const [stats, setStats] = useState({
    orders: 0,
    customers: 0,
    products: 0,
    revenue: 0,
  })

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

      const productsPayload = productsRes.data as { total?: number; data?: unknown[] } | unknown[]
      const productsCount = Array.isArray(productsPayload)
        ? productsPayload.length
        : productsPayload.total ?? productsPayload.data?.length ?? 0

      setStats({
        orders: ordersRes.data.length,
        customers: customersRes.data.length,
        products: productsCount,
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

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return { stats, loadStats }
}
