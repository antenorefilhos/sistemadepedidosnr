import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Loader2, TrendingUp, BarChart3, Users, Zap } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
  ConversionFunnelChart,
  CategoryRevenueChart,
  CustomerOriginChart,
  RevenueHeatmap,
  type ConversionFunnelData,
  type CategoryRevenueData,
  type CustomerOriginData,
  type RevenueHeatmapData,
} from '../components/BICharts'
import { AlertRulesManager } from '../components/AlertRulesManager'
import { PeriodComparison } from '../components/PeriodComparison'
import { ExecutiveReport } from '../components/ExecutiveReport'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  ordersAPI,
  customersAPI,
  analyticsAPI,
  type CategoryRevenueItem,
  type CustomerOriginItem,
  type RevenueHeatmapPoint,
  type SearchInsightsResponse,
} from '../services/api'

// Conversão: busca eventos do AnalyticsEvent para montar o funil
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const SEARCH_WINDOW_OPTIONS = [7, 14, 30] as const
const SEARCH_TOP_OPTIONS = [5, 8, 12] as const
const SEARCH_COLLAPSIBLE_SECTIONS = [
  'topTerms',
  'noResultTerms',
  'topCorrections',
  'adsOpportunitiesGuide',
  'adsRanking',
  'correctedIntent',
  'topConversions',
] as const
const SEARCH_COLLAPSE_MODE_OPTIONS = ['manual', 'expanded', 'collapsed'] as const
const SEARCH_PRESET_OPTIONS = ['custom', 'operational', 'commercial', 'balanced'] as const
const AUTO_INSIGHTS_VIEW_OPTIONS = ['compact', 'detailed'] as const
const SEARCH_INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000
const AUTO_INSIGHTS_CACHE_TTL_MS = 5 * 60 * 1000
const IntelligenceSearchInsightsPanel = lazy(() => import('./sections/IntelligenceSearchInsightsPanel'))
const IntelligenceAutoInsightsPanel = lazy(() => import('./sections/IntelligenceAutoInsightsPanel'))

type SearchInsightsCacheEntry = {
  data: SearchInsightsResponse
  fetchedAt: number
}

type AutoInsightsResponse = {
  overview: Array<{ type: string; _count: { _all: number } }>
  funnel: { views: number; carts: number; checkouts: number; conversion: string }
  topWished: Array<{ name: string; count: number }>
}

type AutoInsightsCacheEntry = {
  data: AutoInsightsResponse
  fetchedAt: number
}

type SearchCollapsibleSection = (typeof SEARCH_COLLAPSIBLE_SECTIONS)[number]
type SearchCollapseMode = (typeof SEARCH_COLLAPSE_MODE_OPTIONS)[number]
type SearchPreset = (typeof SEARCH_PRESET_OPTIONS)[number]

const SEARCH_PRESET_COLLAPSED_SECTIONS: Record<Exclude<SearchPreset, 'custom'>, SearchCollapsibleSection[]> = {
  operational: ['adsOpportunitiesGuide', 'adsRanking', 'correctedIntent', 'topConversions'],
  commercial: ['noResultTerms', 'topCorrections'],
  balanced: ['adsOpportunitiesGuide', 'topConversions'],
}

const parseAllowedInt = (value: string | null, allowed: readonly number[], fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && allowed.includes(parsed) ? parsed : fallback
}

const parseAllowedString = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => {
  if (value && allowed.includes(value as T)) return value as T
  return fallback
}

const parseAllowedList = <T extends string>(value: string | null, allowed: readonly T[]): T[] => {
  if (!value) return []

  const normalized = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is T => allowed.includes(item as T))

  return [...new Set(normalized)]
}

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return atob(padded)
}

const getSearchInsightsContextSignature = () => {
  const token = localStorage.getItem('adminToken')
  if (!token) return 'anonymous'

  const parts = token.split('.')
  if (parts.length < 2) return 'token'

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { id?: string; email?: string; role?: string }
    const id = payload.id || 'no-id'
    const email = payload.email || 'no-email'
    const role = payload.role || 'no-role'
    return `${id}|${email}|${role}`
  } catch {
    return 'token'
  }
}

export default function Intelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [funnel, setFunnel] = useState<ConversionFunnelData | null>(null)
  const [funnelComparison, setFunnelComparison] = useState<{
    funnel: { current: ConversionFunnelData; previous: ConversionFunnelData }
    metrics: {
      conversionRate: {
        current: number
        previous: number
        delta: number
        deltaPercent: number
      }
      cartAbandonRate: {
        current: number
        previous: number
        delta: number
        deltaPercent: number
      }
    }
    period: { current: string; previous: string }
  } | null>(null)
  const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenueData[]>([])
  const [customerOrigin, setCustomerOrigin] = useState<CustomerOriginData[]>([])
  const [heatmap, setHeatmap] = useState<RevenueHeatmapData[]>([])
  const [searchInsights, setSearchInsights] = useState<SearchInsightsResponse | null>(null)
  const [searchWindowDays, setSearchWindowDays] = useState(() => parseAllowedInt(searchParams.get('siDays'), SEARCH_WINDOW_OPTIONS, 14))
  const [searchTopLimit, setSearchTopLimit] = useState(() => parseAllowedInt(searchParams.get('siTop'), SEARCH_TOP_OPTIONS, 8))
  const [searchCollapsedSections, setSearchCollapsedSections] = useState<SearchCollapsibleSection[]>(() =>
    parseAllowedList(searchParams.get('siCollapsed'), SEARCH_COLLAPSIBLE_SECTIONS),
  )
  const [searchCollapseMode, setSearchCollapseMode] = useState<SearchCollapseMode>(() =>
    parseAllowedString(searchParams.get('siCollapseMode'), SEARCH_COLLAPSE_MODE_OPTIONS, 'manual'),
  )
  const [searchPreset, setSearchPreset] = useState<SearchPreset>(() =>
    parseAllowedString(searchParams.get('siPreset'), SEARCH_PRESET_OPTIONS, 'custom'),
  )
  const [autoInsightsViewMode, setAutoInsightsViewMode] = useState<'compact' | 'detailed'>(() =>
    parseAllowedString(searchParams.get('aiView'), AUTO_INSIGHTS_VIEW_OPTIONS, 'detailed'),
  )
  const [searchInsightsLoading, setSearchInsightsLoading] = useState(false)
  const [lastSearchInsightsSyncAt, setLastSearchInsightsSyncAt] = useState<number | null>(null)
  const [autoInsights, setAutoInsights] = useState<AutoInsightsResponse | null>(null)
  const [autoInsightsLoading, setAutoInsightsLoading] = useState(false)
  const [lastAutoInsightsSyncAt, setLastAutoInsightsSyncAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const searchInsightsCacheRef = useRef<Record<string, SearchInsightsCacheEntry>>({})
  const autoInsightsCacheRef = useRef<Record<string, AutoInsightsCacheEntry>>({})
  const analyticsContextRef = useRef<string>('')

  const ensureAnalyticsContext = () => {
    const currentContext = getSearchInsightsContextSignature()
    if (!analyticsContextRef.current) {
      analyticsContextRef.current = currentContext
      return currentContext
    }

    if (analyticsContextRef.current !== currentContext) {
      analyticsContextRef.current = currentContext
      searchInsightsCacheRef.current = {}
      autoInsightsCacheRef.current = {}
      setAutoInsights(null)
      setLastSearchInsightsSyncAt(null)
      setLastAutoInsightsSyncAt(null)
    }

    return currentContext
  }

  const getSearchInsightsCacheKey = (context: string, days: number, limit: number) => `${context}:${days}:${limit}`

  const loadSearchInsights = async (days: number, limit: number, force = false) => {
    const context = ensureAnalyticsContext()
    const key = getSearchInsightsCacheKey(context, days, limit)
    const cached = searchInsightsCacheRef.current[key]
    const isFresh = cached && Date.now() - cached.fetchedAt <= SEARCH_INSIGHTS_CACHE_TTL_MS

    if (!force && isFresh) {
      setSearchInsights(cached.data)
      setLastSearchInsightsSyncAt(cached.fetchedAt)
      return
    }

    if (cached) {
      setSearchInsights(cached.data)
      setLastSearchInsightsSyncAt(cached.fetchedAt)
    }

    try {
      setSearchInsightsLoading(true)
      const response = await analyticsAPI.getSearchInsights(days, limit)
      const fetchedAt = Date.now()
      searchInsightsCacheRef.current[key] = {
        data: response.data,
        fetchedAt,
      }
      setSearchInsights(response.data)
      setLastSearchInsightsSyncAt(fetchedAt)
    } catch (err) {
      // Search insights loading failed - cache will provide fallback
    } finally {
      setSearchInsightsLoading(false)
    }
  }

  const getAutoInsightsCacheKey = (context: string) => `${context}:auto-insights`

  const loadAutoInsights = async (force = false) => {
    const context = ensureAnalyticsContext()
    const key = getAutoInsightsCacheKey(context)
    const cached = autoInsightsCacheRef.current[key]
    const isFresh = cached && Date.now() - cached.fetchedAt <= AUTO_INSIGHTS_CACHE_TTL_MS

    if (!force && isFresh) {
      setAutoInsights(cached.data)
      setLastAutoInsightsSyncAt(cached.fetchedAt)
      return
    }

    if (cached) {
      setAutoInsights(cached.data)
      setLastAutoInsightsSyncAt(cached.fetchedAt)
    }

    try {
      setAutoInsightsLoading(true)
      const response = await analyticsAPI.getInsights()
      const fetchedAt = Date.now()
      autoInsightsCacheRef.current[key] = {
        data: response.data as AutoInsightsResponse,
        fetchedAt,
      }
      setAutoInsights(response.data as AutoInsightsResponse)
      setLastAutoInsightsSyncAt(fetchedAt)
    } catch (err) {
      // Auto insights loading failed - cache will provide fallback
    } finally {
      setAutoInsightsLoading(false)
    }
  }

  useEffect(() => {
    setSearchParams((previous) => {
      const currentDays = previous.get('siDays')
      const currentTop = previous.get('siTop')
      const currentCollapsed = previous.get('siCollapsed')
      const currentCollapseMode = previous.get('siCollapseMode')
      const currentPreset = previous.get('siPreset')
      const currentAutoView = previous.get('aiView')
      const nextDays = String(searchWindowDays)
      const nextTop = String(searchTopLimit)
      const nextCollapsed = searchCollapsedSections.join(',')
      const nextCollapseMode = searchCollapseMode
      const nextPreset = searchPreset
      const nextAutoView = autoInsightsViewMode

      if (
        currentDays === nextDays
        && currentTop === nextTop
        && (currentCollapsed || '') === nextCollapsed
        && currentCollapseMode === nextCollapseMode
        && currentPreset === nextPreset
        && currentAutoView === nextAutoView
      ) {
        return previous
      }

      const next = new URLSearchParams(previous)
      next.set('siDays', nextDays)
      next.set('siTop', nextTop)
      if (nextCollapsed) {
        next.set('siCollapsed', nextCollapsed)
      } else {
        next.delete('siCollapsed')
      }
      next.set('siCollapseMode', nextCollapseMode)
      next.set('siPreset', nextPreset)
      next.set('aiView', nextAutoView)
      return next
    }, { replace: true })
  }, [autoInsightsViewMode, searchCollapseMode, searchCollapsedSections, searchPreset, searchWindowDays, searchTopLimit, setSearchParams])

  useEffect(() => {
    const daysFromUrl = parseAllowedInt(searchParams.get('siDays'), SEARCH_WINDOW_OPTIONS, 14)
    const topFromUrl = parseAllowedInt(searchParams.get('siTop'), SEARCH_TOP_OPTIONS, 8)
    const collapsedFromUrl = parseAllowedList(searchParams.get('siCollapsed'), SEARCH_COLLAPSIBLE_SECTIONS)
    const collapseModeFromUrl = parseAllowedString(searchParams.get('siCollapseMode'), SEARCH_COLLAPSE_MODE_OPTIONS, 'manual')
    const presetFromUrl = parseAllowedString(searchParams.get('siPreset'), SEARCH_PRESET_OPTIONS, 'custom')
    const autoViewFromUrl = parseAllowedString(searchParams.get('aiView'), AUTO_INSIGHTS_VIEW_OPTIONS, 'detailed')

    if (daysFromUrl !== searchWindowDays) {
      setSearchWindowDays(daysFromUrl)
    }
    if (topFromUrl !== searchTopLimit) {
      setSearchTopLimit(topFromUrl)
    }
    if (collapsedFromUrl.join(',') !== searchCollapsedSections.join(',')) {
      setSearchCollapsedSections(collapsedFromUrl)
    }
    if (collapseModeFromUrl !== searchCollapseMode) {
      setSearchCollapseMode(collapseModeFromUrl)
    }
    if (presetFromUrl !== searchPreset) {
      setSearchPreset(presetFromUrl)
    }
    if (autoViewFromUrl !== autoInsightsViewMode) {
      setAutoInsightsViewMode(autoViewFromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('adminToken')
        const headers: HeadersInit | undefined = token
          ? { Authorization: `Bearer ${token}` }
          : undefined

        // Fetch paralelo de datasets de inteligencia e busca
        const [catRes, originRes, heatRes, analyticsRes, comparisonRes, searchRes] = await Promise.allSettled([
          ordersAPI.getCategoryRevenue(),
          customersAPI.getOriginAnalytics(),
          ordersAPI.getRevenueHeatmap(),
          fetch(`${API_URL}/analytics/funnel`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_URL}/analytics/funnel-compare?days=7`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
          analyticsAPI.getSearchInsights(searchWindowDays, searchTopLimit),
        ])

        if (catRes.status === 'fulfilled') setCategoryRevenue(catRes.value.data as CategoryRevenueItem[])
        if (originRes.status === 'fulfilled') setCustomerOrigin(originRes.value.data as CustomerOriginItem[])
        if (heatRes.status === 'fulfilled') setHeatmap(heatRes.value.data as RevenueHeatmapPoint[])
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
          setFunnel(analyticsRes.value)
        }
        if (comparisonRes.status === 'fulfilled' && comparisonRes.value) {
          setFunnelComparison(comparisonRes.value)
        }

        if (searchRes.status === 'fulfilled') {
          const context = ensureAnalyticsContext()
          const key = getSearchInsightsCacheKey(context, searchWindowDays, searchTopLimit)
          const fetchedAt = Date.now()
          searchInsightsCacheRef.current[key] = {
            data: searchRes.value.data,
            fetchedAt,
          }
          setSearchInsights(searchRes.value.data)
          setLastSearchInsightsSyncAt(fetchedAt)
        }

        await loadAutoInsights()

        // Funil: se o endpoint de analytics existir, usa; senão, deriva dos orders
        if (!(analyticsRes.status === 'fulfilled' && analyticsRes.value)) {
          // Funil simulado baseado em eventos indexados localmente
          const eventsRes = await fetch(`${API_URL}/analytics/events?limit=10000`, { headers })
          if (eventsRes.ok) {
            const events = await eventsRes.json()
            const types = (events.data || events) as { type: string }[]
            setFunnel({
              views: types.filter(e => e.type === 'VIEW_PRODUCT').length,
              addedToCart: types.filter(e => e.type === 'ADD_TO_CART').length,
              checkoutStarted: types.filter(e => e.type === 'CHECKOUT_START').length,
              purchased: types.filter(e => e.type === 'ORDER_CREATED').length,
            })
          } else {
            // Fallback com zeros
            setFunnel({ views: 0, addedToCart: 0, checkoutStarted: 0, purchased: 0 })
          }
        }

      } catch (err) {
        setError('Erro ao carregar dados de inteligência.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (loading) return

    loadSearchInsights(searchWindowDays, searchTopLimit)
  }, [loading, searchTopLimit, searchWindowDays])

  const handleForceRefreshSearchInsights = () => {
    void loadSearchInsights(searchWindowDays, searchTopLimit, true)
  }

  const handleToggleSearchSection = (sectionId: SearchCollapsibleSection) => {
    setSearchPreset('custom')
    setSearchCollapseMode('manual')
    setSearchCollapsedSections((previous) => (
      previous.includes(sectionId)
        ? previous.filter((id) => id !== sectionId)
        : [...previous, sectionId]
    ))
  }

  const handleCollapseAllSearchSections = () => {
    setSearchPreset('custom')
    setSearchCollapseMode('collapsed')
    setSearchCollapsedSections([...SEARCH_COLLAPSIBLE_SECTIONS])
  }

  const handleExpandAllSearchSections = () => {
    setSearchPreset('custom')
    setSearchCollapseMode('expanded')
    setSearchCollapsedSections([])
  }

  const handleApplySearchPreset = (preset: SearchPreset) => {
    if (preset === 'custom') return

    setSearchPreset(preset)
    setSearchCollapseMode('manual')
    setSearchCollapsedSections([...SEARCH_PRESET_COLLAPSED_SECTIONS[preset]])
  }

  const handleResetSearchView = () => {
    setSearchPreset('custom')
    setSearchCollapseMode('expanded')
    setSearchCollapsedSections([])
  }

  const handleForceRefreshAutoInsights = () => {
    void loadAutoInsights(true)
  }

  // KPIs derivados
  const conversionRate = funnel && funnel.views > 0
    ? `${((funnel.purchased / funnel.views) * 100).toFixed(1)}%`
    : '—'
  const cartAbandonRate = funnel && funnel.addedToCart > 0
    ? `${(((funnel.addedToCart - funnel.purchased) / funnel.addedToCart) * 100).toFixed(0)}%`
    : '—'
  const topCategory = categoryRevenue[0]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-[#5D082A]" size={36} />
        <p className="text-sm text-gray-400">Compilando inteligência de vendas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-6 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inteligência de Vendas</h2>
          <p className="text-sm text-gray-500 mt-0.5">Analytics Pro — Phase 17</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="search-window-days">Periodo da saude da busca</label>
          <Select
            id="search-window-days"
            value={searchWindowDays}
            onChange={(event) => setSearchWindowDays(Number(event.target.value))}
            className="h-8 w-auto rounded-lg border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus-visible:ring-[#5D082A]"
            aria-label="Periodo da saude da busca"
          >
            <option value={7}>Ultimos 7 dias</option>
            <option value={14}>Ultimos 14 dias</option>
            <option value={30}>Ultimos 30 dias</option>
          </Select>

          <label className="sr-only" htmlFor="search-top-limit">Quantidade de termos</label>
          <Select
            id="search-top-limit"
            value={searchTopLimit}
            onChange={(event) => setSearchTopLimit(Number(event.target.value))}
            className="h-8 w-auto rounded-lg border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus-visible:ring-[#5D082A]"
            aria-label="Quantidade de termos"
          >
            <option value={5}>Top 5</option>
            <option value={8}>Top 8</option>
            <option value={12}>Top 12</option>
          </Select>

          <Badge className="border-transparent bg-[#5D082A]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#5D082A]">
            <Zap size={12} /> Live Data
          </Badge>
          {searchInsightsLoading && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
              <Loader2 size={12} className="animate-spin" />
              Atualizando busca...
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleForceRefreshSearchInsights}
            disabled={searchInsightsLoading}
            className="h-8 rounded-lg border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Atualizar agora
          </Button>
        </div>
      </div>

      {/* KPI Row com Comparativos */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Taxa de Conversão</p>
            <p className="text-3xl font-black text-[#5D082A]">{conversionRate}</p>
            <p className="text-xs text-gray-400 mt-1">Views → Compra</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Abandono de Carrinho</p>
            <p className="text-3xl font-black text-orange-500">{cartAbandonRate}</p>
            <p className="text-xs text-gray-400 mt-1">Add-to-cart sem comprar</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Top Categoria</p>
            <p className="text-lg font-black text-gray-800 leading-tight mt-1">{topCategory?.category || '—'}</p>
            <p className="text-xs text-gray-400 mt-1">R$ {topCategory?.revenue?.toFixed(2) || '0,00'}</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Canais Mapeados</p>
            <p className="text-3xl font-black text-[#5d082a]">{customerOrigin.length}</p>
            <p className="text-xs text-gray-400 mt-1">Origens de aquisição</p>
          </div>
        </div>

        {/* Comparativos de Período (se disponível) */}
        {funnelComparison && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <PeriodComparison
                metric={funnelComparison.metrics.conversionRate}
                label="Conversão (7 dias)"
                isPercentage
              />
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <PeriodComparison
                metric={funnelComparison.metrics.cartAbandonRate}
                label="Abandono (7 dias)"
                isPercentage
              />
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <span className="text-xs text-gray-600">Pedidos Atuais</span>
              <p className="text-xl font-bold text-green-700 mt-1">{funnelComparison.funnel.current.purchased}</p>
              <span className="text-xs text-gray-500">vs {funnelComparison.funnel.previous.purchased}</span>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <span className="text-xs text-gray-600">Carrinho Atual</span>
              <p className="text-xl font-bold text-purple-700 mt-1">{funnelComparison.funnel.current.addedToCart}</p>
              <span className="text-xs text-gray-500">vs {funnelComparison.funnel.previous.addedToCart}</span>
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Funil + Canal de Aquisição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {funnel && <ConversionFunnelChart data={funnel} />}
        {customerOrigin.length > 0
          ? <CustomerOriginChart data={customerOrigin} />
          : (
            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 min-h-[300px]">
              <Users size={40} className="text-gray-200" />
              <p className="text-gray-400 text-sm">Cadastre clientes com <strong>Origem</strong> para ver o canal de aquisição aqui.</p>
            </div>
          )
        }
      </div>

      {/* Row 2: Receita por Categoria */}
      {categoryRevenue.length > 0
        ? <CategoryRevenueChart data={categoryRevenue} />
        : (
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 min-h-[200px]">
            <BarChart3 size={40} className="text-gray-200" />
            <p className="text-gray-400 text-sm">Crie pedidos com itens categorizados para ver a receita por departamento.</p>
          </div>
        )
      }

      {/* Row 3: Mapa de Calor */}
      {heatmap.length > 0
        ? <RevenueHeatmap data={heatmap} />
        : (
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 min-h-[200px]">
            <TrendingUp size={40} className="text-gray-200" />
            <p className="text-gray-400 text-sm">O mapa de calor aparecerá após acumular 7+ dias de pedidos.</p>
          </div>
        )
      }

      {searchInsights && (
        <Suspense fallback={<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando painel de busca...</div>}>
          <IntelligenceSearchInsightsPanel
            searchInsights={searchInsights}
            windowDays={searchWindowDays}
            topLimit={searchTopLimit}
            collapsedSections={searchCollapsedSections}
            collapseMode={searchCollapseMode}
            preset={searchPreset}
            onToggleSection={handleToggleSearchSection}
            onCollapseAllSections={handleCollapseAllSearchSections}
            onExpandAllSections={handleExpandAllSearchSections}
            onApplyPreset={handleApplySearchPreset}
            onResetView={handleResetSearchView}
            isRefreshing={searchInsightsLoading}
            lastSyncAt={lastSearchInsightsSyncAt}
          />
        </Suspense>
      )}

      <Suspense fallback={<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando insights...</div>}>
        <IntelligenceAutoInsightsPanel
          categoryRevenue={categoryRevenue}
          funnel={funnel}
          cartAbandonRate={cartAbandonRate}
          customerOrigin={customerOrigin}
          autoInsights={autoInsights}
          viewMode={autoInsightsViewMode}
          onViewModeChange={setAutoInsightsViewMode}
          isRefreshing={autoInsightsLoading}
          lastSyncAt={lastAutoInsightsSyncAt}
          onRefresh={handleForceRefreshAutoInsights}
        />
      </Suspense>

      {/* M33.2: Alert Rules */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">🚨 Regras de Alerta Automático</h3>
        <AlertRulesManager apiUrl={API_URL} token={localStorage.getItem('adminToken') || ''} />
      </div>

      {/* M33.3: Executive Report */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Relatório Executivo Semanal</h3>
        <ExecutiveReport apiUrl={API_URL} token={localStorage.getItem('adminToken') || ''} />
      </div>
    </div>
    )
  }
