import { useCallback, useEffect, useState } from 'react'
import {
  ordersAPI,
  productsAPI,
  type SalesAnalyticsPoint,
  type StatusAnalyticsResponse,
  type RevenueAnalyticsResponse,
  type TopProductAnalyticsItem,
} from '../services/api'
import type { DashboardAnalytics } from '../pages/types'

/** Graficos/series da aba Dashboard -- extraido de AdminDashboard (JON-65,
 * Auditoria 360). */
export function useDashboardAnalytics(activeSection: string) {
  const [salesPeriod, setSalesPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [salesSeries, setSalesSeries] = useState<SalesAnalyticsPoint[]>([])
  const [statusAnalytics, setStatusAnalytics] = useState<StatusAnalyticsResponse | null>(null)
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalyticsResponse | null>(null)
  const [topProducts, setTopProducts] = useState<TopProductAnalyticsItem[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)

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
    if (activeSection === 'dashboard') {
      loadDashboardAnalytics()
    }
  }, [activeSection, loadDashboardAnalytics])

  const handleAnalyticsChange = useCallback((updates: Partial<DashboardAnalytics>) => {
    if (updates.salesPeriod !== undefined) setSalesPeriod(updates.salesPeriod)
    if (updates.salesSeries !== undefined) setSalesSeries(updates.salesSeries)
    if (updates.statusAnalytics !== undefined) setStatusAnalytics(updates.statusAnalytics)
    if (updates.revenueAnalytics !== undefined) setRevenueAnalytics(updates.revenueAnalytics)
    if (updates.topProducts !== undefined) setTopProducts(updates.topProducts)
    if (updates.dashboardLoading !== undefined) setDashboardLoading(updates.dashboardLoading)
  }, [])

  return {
    salesPeriod, salesSeries, statusAnalytics, revenueAnalytics, topProducts, dashboardLoading,
    handleAnalyticsChange,
  }
}
