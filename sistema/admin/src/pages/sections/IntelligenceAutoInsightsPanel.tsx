import type { CategoryRevenueData, ConversionFunnelData, CustomerOriginData } from '../../components/BICharts'
import { Button } from '@/components/ui/button'

type AutoInsightsResponse = {
  overview: Array<{ type: string; _count: { _all: number } }>
  funnel: { views: number; carts: number; checkouts: number; conversion: string }
  topWished: Array<{ name: string; count: number }>
}

interface IntelligenceAutoInsightsPanelProps {
  categoryRevenue: CategoryRevenueData[]
  funnel: ConversionFunnelData | null
  cartAbandonRate: string
  customerOrigin: CustomerOriginData[]
  autoInsights?: AutoInsightsResponse | null
  viewMode?: 'compact' | 'detailed'
  onViewModeChange?: (mode: 'compact' | 'detailed') => void
  isRefreshing?: boolean
  lastSyncAt?: number | null
  onRefresh?: () => void
}

export default function IntelligenceAutoInsightsPanel({
  categoryRevenue,
  funnel,
  cartAbandonRate,
  customerOrigin,
  autoInsights = null,
  viewMode = 'detailed',
  onViewModeChange,
  isRefreshing = false,
  lastSyncAt = null,
  onRefresh,
}: IntelligenceAutoInsightsPanelProps) {
  const topCategory = categoryRevenue[0]
  const formattedLastSync = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('pt-BR') : null
  const serverTopWished = autoInsights?.topWished ?? []

  return (
    <div className="bg-gray-900 p-6 rounded-lg text-amber-100 border border-amber-200/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold flex items-center gap-2 text-white">Insights Automaticos</h3>
          {formattedLastSync && <p className="text-[11px] text-amber-100/70 mt-1">Atualizado as {formattedLastSync}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onViewModeChange && (
            <div className="inline-flex items-center rounded-lg border border-amber-200/30 bg-black/30 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewModeChange('compact')}
                className={`h-7 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  viewMode === 'compact' ? 'bg-amber-100 text-amber-900' : 'text-amber-100 hover:bg-white/10'
                }`}
                aria-pressed={viewMode === 'compact'}
              >
                Compacto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewModeChange('detailed')}
                className={`h-7 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  viewMode === 'detailed' ? 'bg-amber-100 text-amber-900' : 'text-amber-100 hover:bg-white/10'
                }`}
                aria-pressed={viewMode === 'detailed'}
              >
                Detalhado
              </Button>
            </div>
          )}
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Atualizar insights automaticos"
              className="h-8 rounded-lg border-amber-200/40 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-white/15 hover:text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
          )}
        </div>
      </div>
      {viewMode === 'detailed' && (
        <div className="space-y-3 text-sm">
          {topCategory && (
            <p>
              - <strong className="text-white">Foco de Receita:</strong> A categoria{' '}
              <strong className="text-[#D2BB8A]">{topCategory.category}</strong> representa{' '}
              {categoryRevenue.length > 0
                ? ((topCategory.revenue / categoryRevenue.reduce((sum, item) => sum + item.revenue, 0)) * 100).toFixed(0)
                : '—'}
              % do faturamento. Considere expandir o mix dessa categoria.
            </p>
          )}
          {funnel && funnel.addedToCart > funnel.purchased && (
            <p>
              - <strong className="text-white">Carrinho Abandonado:</strong> {cartAbandonRate} dos clientes que adicionaram nao finalizaram. Ative as{' '}
              <strong className="text-[#D2BB8A]">Notificacoes WhatsApp</strong> para recuperar essas vendas.
            </p>
          )}
          {customerOrigin.length > 0 && (
            <p>
              - <strong className="text-white">Melhor Canal:</strong> <strong className="text-[#D2BB8A]">{customerOrigin[0]?.origin}</strong> traz{' '}
              {customerOrigin[0]?.count} cliente(s). Considere investir mais nesse canal.
            </p>
          )}
          {categoryRevenue.length === 0 && funnel?.purchased === 0 && (
            <p className="text-gray-500 italic">Realize os primeiros pedidos para que os insights sejam gerados automaticamente.</p>
          )}
        </div>
      )}

      {viewMode === 'compact' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-amber-100/70 uppercase tracking-wider">Top categoria</p>
            <p className="font-semibold text-amber-50 mt-1">{topCategory?.category || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-amber-100/70 uppercase tracking-wider">Abandono</p>
            <p className="font-semibold text-amber-50 mt-1">{cartAbandonRate}</p>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-amber-100/70 uppercase tracking-wider">Melhor canal</p>
            <p className="font-semibold text-amber-50 mt-1">{customerOrigin[0]?.origin || '—'}</p>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-amber-200/20 bg-black/20 p-4">
        <p className="text-sm font-semibold text-white mb-2">Top produtos desejados</p>
        {serverTopWished.length === 0 && (
          <p className="text-xs text-amber-100/75">Ainda sem volume suficiente de ADD_TO_CART para ranking no periodo.</p>
        )}
        {serverTopWished.length > 0 && (
          <div className="space-y-2">
            {serverTopWished.slice(0, viewMode === 'compact' ? 3 : serverTopWished.length).map((item) => (
              <div key={`${item.name}-${item.count}`} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-sm text-amber-50">{item.name}</span>
                <span className="text-xs font-bold text-[#D2BB8A]">{item.count} add(s)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
