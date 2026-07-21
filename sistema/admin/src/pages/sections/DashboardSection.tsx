import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  integrationsAPI,
  ordersAPI,
  pickingAPI,
  productsAPI,
  type AdminOrder,
  type IntegrationOperationsPanel,
  type PickingPerformanceResponse,
  type PickingTask,
  type ProductAvailabilityMetricsResponse,
} from '../../services/api'
import { SalesChart, StatusDonutChart, TopProductsChart } from '../../components/BICharts'
import { Select } from '../../components/ui/select'
import { DashboardStats, DashboardAnalytics } from '../types'
import { SectionPanel } from './SectionChrome'
import { SystemHealthWidget } from '../SystemHealthWidget'
import {
  Banknote,
  Package,
  AlertTriangle,
  ClipboardList,
  Gauge,
  Megaphone,
  PlugZap,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Users,
} from 'lucide-react'

interface DashboardSectionProps {
  stats: DashboardStats
  analytics: DashboardAnalytics
  onAnalyticsChange: (updates: Partial<DashboardAnalytics>) => void
}

interface StatCardProps {
  label: string
  value: string | number
  trend: number
  trendComparisonPeriod?: string
  icon: typeof Banknote
  iconColor: string
  iconBg: string
}

function StatCard({ label, value, trend, trendComparisonPeriod = 'últimos 30 dias', icon: Icon, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="rounded-[14px] border border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_100%)] p-6 shadow-[0_18px_36px_rgba(93,8,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(93,8,42,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[#5d082a]">{value}</p>
        </div>
        <div className={`rounded-lg p-3 shadow-sm ${iconBg}`} aria-hidden="true">
          <Icon size={22} className={iconColor} />
        </div>
      </div>
      <div className="mt-4">{renderTrend(trend, trendComparisonPeriod)}</div>
    </div>
  )
}

function ChartPlaceholder() {
  return (
    <div className="flex h-[300px] animate-pulse flex-col justify-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-6">
      <div className="h-4 w-40 rounded bg-gray-200" />
      <div className="h-24 rounded bg-gray-200/80" />
      <div className="grid grid-cols-4 gap-3">
        <div className="h-3 rounded bg-gray-200" />
        <div className="h-3 rounded bg-gray-200" />
        <div className="h-3 rounded bg-gray-200" />
        <div className="h-3 rounded bg-gray-200" />
      </div>
    </div>
  )
}

function renderTrend(value: number, comparisonPeriod: string = 'últimos 30 dias') {
  const isUp = value >= 0

  return (
    <span 
      className={`inline-flex items-center gap-1 text-sm font-semibold ${isUp ? 'text-emerald-600' : 'text-red-500'}`}
      title={`${isUp ? 'Crescimento' : 'Redução'} de ${Math.abs(value)}% vs. ${comparisonPeriod}`}
    >
      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {Math.abs(value)}%
      <span className="text-xs font-normal opacity-75"> vs. {comparisonPeriod}</span>
    </span>
  )
}

function minutesUntil(value?: string | null) {
  if (!value) return null
  return Math.round((new Date(value).getTime() - Date.now()) / 60000)
}

function queueToneClass(tone: 'critical' | 'warning' | 'neutral' | 'success') {
  const tones = {
    critical: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    neutral: 'border-sky-200 bg-sky-50 text-sky-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return tones[tone]
}

function OperationalQueueCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string
  value: string | number
  detail: string
  icon: typeof Banknote
  tone: 'critical' | 'warning' | 'neutral' | 'success'
}) {
  return (
    <div className={`rounded-lg border p-4 ${queueToneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider opacity-75">{title}</p>
          <p className="mt-2 text-3xl font-black leading-none">{value}</p>
        </div>
        <div className="rounded-lg bg-white/70 p-2 shadow-sm">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium opacity-85">{detail}</p>
    </div>
  )
}

export function DashboardSection({
  stats,
  analytics,
  onAnalyticsChange,
}: DashboardSectionProps) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [pickingTasks, setPickingTasks] = useState<PickingTask[]>([])
  const [pickingPerformance, setPickingPerformance] = useState<PickingPerformanceResponse | null>(null)
  const [availability, setAvailability] = useState<ProductAvailabilityMetricsResponse | null>(null)
  const [integrationOps, setIntegrationOps] = useState<IntegrationOperationsPanel | null>(null)

  const loadDashboardAnalytics = useCallback(async () => {
    try {
      onAnalyticsChange({ dashboardLoading: true })
      const [salesRes, statusRes, revenueRes, topRes] = await Promise.all([
        ordersAPI.getSalesAnalytics(analytics.salesPeriod),
        ordersAPI.getStatusAnalytics(),
        ordersAPI.getRevenueAnalytics(),
        productsAPI.getTopAnalytics(5),
      ])

      onAnalyticsChange({
        salesSeries: salesRes.data.data,
        statusAnalytics: statusRes.data,
        revenueAnalytics: revenueRes.data,
        topProducts: topRes.data,
        dashboardLoading: false,
      })
    } catch (error) {
      onAnalyticsChange({ dashboardLoading: false })
    }
  }, [analytics.salesPeriod, onAnalyticsChange])

  useEffect(() => {
    loadDashboardAnalytics()
  }, [loadDashboardAnalytics])

  useEffect(() => {
    let cancelled = false
    async function loadOperationalQueues() {
      try {
        const [ordersRes, tasksRes, performanceRes, availabilityRes, integrationOpsRes] = await Promise.all([
          ordersAPI.getAll(),
          pickingAPI.getTasks({ limit: 100 }),
          pickingAPI.getPerformance(),
          productsAPI.getAvailabilityMetrics(),
          integrationsAPI.getOperationsPanel(),
        ])
        if (cancelled) return
        setOrders(ordersRes.data)
        setPickingTasks(tasksRes.data)
        setPickingPerformance(performanceRes.data)
        setAvailability(availabilityRes.data)
        setIntegrationOps(integrationOpsRes.data)
      } catch {
        if (cancelled) return
        setOrders([])
        setPickingTasks([])
        setPickingPerformance(null)
        setAvailability(null)
        setIntegrationOps(null)
      }
    }
    loadOperationalQueues()
    return () => {
      cancelled = true
    }
  }, [])

  const roleQueues = useMemo(() => {
    const activeStatuses = new Set(['PENDING', 'CONFIRMED', 'PAYMENT_PENDING', 'PICKING_PENDING', 'PICKING', 'WAITING_CUSTOMER_SUBSTITUTION', 'CONFERENCE_PENDING', 'PACKING', 'FAILED_SYNC'])
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status))
    const urgentOrders = activeOrders.filter((order) => {
      const ageMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000
      return ageMinutes >= 45 || ['FAILED_SYNC', 'WAITING_CUSTOMER_SUBSTITUTION'].includes(order.status)
    })
    const activePicking = pickingTasks.filter((task) => !['COMPLETED', 'CANCELLED'].includes(task.status))
    const slaRisk = activePicking.filter((task) => {
      const minutes = minutesUntil(task.slaDueAt)
      return minutes !== null && minutes <= 20
    })
    const ruptureQueue = activePicking.reduce((sum, task) => sum + task.items.filter((item) => ['MISSING', 'SUBSTITUTED'].includes(item.status)).length, 0)
    const catalogIssues =
      (availability?.lowStockProducts || 0) +
      (availability?.alwaysEnabledWithZeroStock || 0) +
      (availability?.inactiveWithStock || 0)
    const integrationFailures =
      (integrationOps?.deadLetters || 0) +
      Number(integrationOps?.outbox?.FAILED || 0) +
      Number(integrationOps?.jobs?.FAILED || 0)
    const campaignSignals = analytics.topProducts.length

    return {
      activeOrders,
      urgentOrders,
      activePicking,
      slaRisk,
      ruptureQueue,
      catalogIssues,
      integrationFailures,
      campaignSignals,
    }
  }, [analytics.topProducts.length, availability, integrationOps, orders, pickingTasks])

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita Total"
          value={`R$ ${stats.revenue.toFixed(2)}`}
          trend={12}
          trendComparisonPeriod="últimos 30 dias"
          icon={Banknote}
          iconColor="text-[#5d082a]"
          iconBg="bg-[#fdf0f4]"
        />
        <StatCard
          label="Pedidos"
          value={stats.orders}
          trend={8}
          trendComparisonPeriod="últimos 7 dias"
          icon={ShoppingCart}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          label="Clientes"
          value={stats.customers}
          trend={5}
          trendComparisonPeriod="últimos 30 dias"
          icon={Users}
          iconColor="text-fuchsia-600"
          iconBg="bg-fuchsia-50"
        />
        <StatCard
          label="Produtos"
          value={stats.products}
          trend={3}
          trendComparisonPeriod="últimos 30 dias"
          icon={Package}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <OperationalQueueCard
          title="Operador"
          value={roleQueues.urgentOrders.length}
          detail={`${roleQueues.activeOrders.length} pedidos ativos; prioridade por idade, falha ou substituicao.`}
          icon={Gauge}
          tone={roleQueues.urgentOrders.length > 0 ? 'critical' : 'success'}
        />
        <OperationalQueueCard
          title="Picking"
          value={roleQueues.slaRisk.length}
          detail={`${roleQueues.activePicking.length} tarefas ativas; risco de SLA em ate 20 min.`}
          icon={ClipboardList}
          tone={roleQueues.slaRisk.length > 0 ? 'warning' : 'success'}
        />
        <OperationalQueueCard
          title="Ruptura"
          value={roleQueues.ruptureQueue}
          detail="Itens faltantes ou substituidos aguardando atencao operacional."
          icon={AlertTriangle}
          tone={roleQueues.ruptureQueue > 0 ? 'critical' : 'success'}
        />
        <OperationalQueueCard
          title="Catalogo"
          value={roleQueues.catalogIssues}
          detail="Baixo estoque, estoque inconsistente ou produto ativo sem lastro."
          icon={Package}
          tone={roleQueues.catalogIssues > 0 ? 'warning' : 'success'}
        />
        <OperationalQueueCard
          title="Integracoes"
          value={roleQueues.integrationFailures}
          detail={`${integrationOps?.connectors ?? 0} conectores; falhas em outbox/jobs/DLQ.`}
          icon={PlugZap}
          tone={roleQueues.integrationFailures > 0 ? 'critical' : 'success'}
        />
        <OperationalQueueCard
          title="Campanhas"
          value={roleQueues.campaignSignals}
          detail="Produtos com tracao para vitrine, oferta ou CRM."
          icon={Megaphone}
          tone={roleQueues.campaignSignals > 0 ? 'neutral' : 'warning'}
        />
      </div>

      <SectionPanel>
        <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)] px-6 py-5">
          <h3 className="text-lg font-semibold text-gray-800">Painel por funcao</h3>
          <p className="mt-1 text-sm text-gray-500">Leitura rapida para operador, separador e gestor sem depender de treinamento longo.</p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#f1dbe3] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-wider text-[#9e7080]">Operador</p>
            <h4 className="mt-1 text-base font-bold text-gray-900">Priorizar pedido parado</h4>
            <p className="mt-2 text-sm text-gray-600">
              {roleQueues.urgentOrders.length > 0
                ? `${roleQueues.urgentOrders.length} pedido(s) exigem acao por SLA, falha ou substituicao.`
                : 'Fila sem pedido critico neste momento.'}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-wider text-[#9e7080]">Separador</p>
            <h4 className="mt-1 text-base font-bold text-gray-900">Concluir por setor e SLA</h4>
            <p className="mt-2 text-sm text-gray-600">
              {pickingPerformance
                ? `${pickingPerformance.totals.completed}/${pickingPerformance.totals.tasks} tarefas concluidas no periodo; ${pickingPerformance.totals.delayed} atrasada(s).`
                : 'Sem leitura de produtividade carregada.'}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-wider text-[#9e7080]">Gestor</p>
            <h4 className="mt-1 text-base font-bold text-gray-900">Enxergar gargalo</h4>
            <p className="mt-2 text-sm text-gray-600">
              {roleQueues.integrationFailures > 0 || roleQueues.catalogIssues > 0
                ? `${roleQueues.catalogIssues} alerta(s) de catalogo e ${roleQueues.integrationFailures} falha(s) de integracao.`
                : 'Catalogo e integracoes sem fila critica nos indicadores principais.'}
            </p>
          </div>
        </div>
      </SectionPanel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionPanel>
          <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Performance de Vendas</h3>
            <Select
              value={analytics.salesPeriod}
              onChange={(e) => onAnalyticsChange({ salesPeriod: e.target.value as DashboardAnalytics['salesPeriod'] })}
              className="w-full border-[#ead7df] bg-white focus-visible:ring-[#5d082a] sm:w-auto"
              aria-label="Período de vendas"
            >
              <option value="day">Hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Últimos 30 dias</option>
            </Select>
          </div>
          </div>
          <div className="p-6">
          {analytics.dashboardLoading ? (
            <ChartPlaceholder />
          ) : (
            <SalesChart salesData={analytics.salesSeries} period={analytics.salesPeriod} />
          )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] px-6 py-5">
            <h3 className="text-lg font-semibold text-gray-800">Top 5 Produtos (Volume)</h3>
          </div>
          <div className="p-6">
          {analytics.dashboardLoading ? (
            <ChartPlaceholder />
          ) : (
            <TopProductsChart topProducts={analytics.topProducts} />
          )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] px-6 py-5">
            <h3 className="text-lg font-semibold text-gray-800">Resumo de Crescimento</h3>
          </div>
          <div className="p-6">
          {analytics.statusAnalytics ? (
            <StatusDonutChart statusData={analytics.statusAnalytics} />
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-[14px] border border-dashed border-[#ead7df] bg-[linear-gradient(180deg,#fffafc_0%,#fff 100%)] text-center text-sm text-gray-500">
              Sem dados para análise.
            </div>
          )}
          </div>
        </SectionPanel>

        <SystemHealthWidget />

      </div>
    </div>
  )
}
