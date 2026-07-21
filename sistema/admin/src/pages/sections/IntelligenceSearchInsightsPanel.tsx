import type { SearchInsightsResponse } from '../../services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface IntelligenceSearchInsightsPanelProps {
  searchInsights: SearchInsightsResponse
  windowDays: number
  topLimit: number
  collapseMode?: 'manual' | 'expanded' | 'collapsed'
  preset?: 'custom' | 'operational' | 'commercial' | 'balanced'
  collapsedSections?: Array<
    | 'topTerms'
    | 'noResultTerms'
    | 'topCorrections'
    | 'adsOpportunitiesGuide'
    | 'adsRanking'
    | 'correctedIntent'
    | 'topConversions'
  >
  onToggleSection?: (sectionId:
    | 'topTerms'
    | 'noResultTerms'
    | 'topCorrections'
    | 'adsOpportunitiesGuide'
    | 'adsRanking'
    | 'correctedIntent'
    | 'topConversions') => void
  onCollapseAllSections?: () => void
  onExpandAllSections?: () => void
  onApplyPreset?: (preset: 'operational' | 'commercial' | 'balanced') => void
  onResetView?: () => void
  isRefreshing?: boolean
  lastSyncAt?: number | null
}

const TOTAL_COLLAPSIBLE_SECTIONS = 7
const OPERATIONAL_PRESET_DESCRIPTION = 'Foco operacional: prioriza saude da busca e gaps de catalogo.'
const BALANCED_PRESET_DESCRIPTION = 'Foco balanceado: equilibrio entre saude geral e oportunidades comerciais.'
const COMMERCIAL_PRESET_DESCRIPTION = 'Foco comercial: prioriza oportunidades para ads e conversao.'

export default function IntelligenceSearchInsightsPanel({
  searchInsights,
  windowDays,
  topLimit,
  collapseMode = 'manual',
  preset = 'custom',
  collapsedSections = [],
  onToggleSection,
  onCollapseAllSections,
  onExpandAllSections,
  onApplyPreset,
  onResetView,
  isRefreshing = false,
  lastSyncAt = null,
}: IntelligenceSearchInsightsPanelProps) {
  const formattedLastSync = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('pt-BR') : null
  const collapsedCount = collapsedSections.length
  const allExpanded = collapsedCount === 0
  const allCollapsed = collapsedCount >= TOTAL_COLLAPSIBLE_SECTIONS
  const collapseModeLabel =
    collapseMode === 'collapsed'
      ? 'Modo global: recolher tudo'
      : collapseMode === 'expanded'
        ? 'Modo global: expandir tudo'
        : 'Ajuste manual por secao'
  const collapseModeClassName =
    collapseMode === 'collapsed'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : collapseMode === 'expanded'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-gray-50 text-gray-600'
  const activePresetSummary =
    preset === 'operational'
      ? OPERATIONAL_PRESET_DESCRIPTION
      : preset === 'balanced'
        ? BALANCED_PRESET_DESCRIPTION
        : preset === 'commercial'
          ? COMMERCIAL_PRESET_DESCRIPTION
          : null
  const isCollapsed = (sectionId:
    | 'topTerms'
    | 'noResultTerms'
    | 'topCorrections'
    | 'adsOpportunitiesGuide'
    | 'adsRanking'
    | 'correctedIntent'
    | 'topConversions') => collapsedSections.includes(sectionId)

  const renderSectionToggle = (sectionId:
    | 'topTerms'
    | 'noResultTerms'
    | 'topCorrections'
    | 'adsOpportunitiesGuide'
    | 'adsRanking'
    | 'correctedIntent'
    | 'topConversions', label: string) => (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-sm font-bold text-gray-700">{label}</p>
      {onToggleSection && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onToggleSection(sectionId)}
          className="h-7 rounded-md border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50"
          aria-pressed={isCollapsed(sectionId)}
        >
          {isCollapsed(sectionId) ? 'Expandir' : 'Recolher'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-800">Saude da Busca</h3>
        <div className="flex items-center gap-2">
          {onApplyPreset && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyPreset('operational')}
                title={OPERATIONAL_PRESET_DESCRIPTION}
                aria-label={`Preset operacional. ${OPERATIONAL_PRESET_DESCRIPTION}`}
                className={`h-7 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  preset === 'operational'
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Preset operacional
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyPreset('balanced')}
                title={BALANCED_PRESET_DESCRIPTION}
                aria-label={`Preset balanceado. ${BALANCED_PRESET_DESCRIPTION}`}
                className={`h-7 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  preset === 'balanced'
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Preset balanceado
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyPreset('commercial')}
                title={COMMERCIAL_PRESET_DESCRIPTION}
                aria-label={`Preset comercial. ${COMMERCIAL_PRESET_DESCRIPTION}`}
                className={`h-7 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                  preset === 'commercial'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Preset comercial
              </Button>
            </>
          )}
          {onResetView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetView}
              disabled={preset === 'custom' && allExpanded}
              className="h-7 rounded-md border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restaurar padrao
            </Button>
          )}
          <Badge variant="outline" className={`text-[11px] ${collapseModeClassName}`}>
            {collapseModeLabel}
          </Badge>
          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-[11px] text-gray-600">
            {collapsedCount}/{TOTAL_COLLAPSIBLE_SECTIONS} recolhidas
          </Badge>
          {onExpandAllSections && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExpandAllSections}
              disabled={allExpanded}
              className="h-7 rounded-md border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Expandir tudo
            </Button>
          )}
          {onCollapseAllSections && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCollapseAllSections}
              disabled={allCollapsed}
              className="h-7 rounded-md border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Recolher tudo
            </Button>
          )}
          {formattedLastSync && (
            <span className="text-[11px] font-medium text-gray-400">Atualizado as {formattedLastSync}</span>
          )}
          {isRefreshing && (
            <Badge variant="secondary" className="bg-gray-100 text-[11px] text-gray-600">
              Atualizando...
            </Badge>
          )}
        </div>
      </div>
      {activePresetSummary && (
        <p className="mb-3 text-xs font-medium text-gray-500">{activePresetSummary}</p>
      )}
      <p className="text-xs text-gray-400 mb-4">Termos mais buscados e gargalos de resultado nos ultimos {windowDays} dias (top {topLimit})</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Buscas</p>
          <p className="text-2xl font-black text-[#5D082A]">{searchInsights.totals.searches}</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Termos Unicos</p>
          <p className="text-2xl font-black text-gray-800">{searchInsights.totals.uniqueTerms}</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Sem Resultado</p>
          <p className="text-2xl font-black text-orange-500">{(searchInsights.totals.noResultRate * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Uso Sugestao</p>
          <p className="text-2xl font-black text-blue-600">{searchInsights.totals.suggestionUsage}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">Termos Corrigidos</p>
          <p className="text-2xl font-black text-emerald-700">{searchInsights.totals.correctedSearches}</p>
          <p className="text-xs text-emerald-700/80 mt-1">erros de digitacao capturados</p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-indigo-700 font-bold">Taxa de Correcao</p>
          <p className="text-2xl font-black text-indigo-700">{(searchInsights.totals.correctionRate * 100).toFixed(0)}%</p>
          <p className="text-xs text-indigo-700/80 mt-1">potencial de ads por intencao real</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">Media de Resultados</p>
          <p className="text-2xl font-black text-amber-700">{searchInsights.totals.avgResults.toFixed(1)}</p>
          <p className="text-xs text-amber-700/80 mt-1">profundidade media por busca</p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose-700 font-bold">Gaps de Catalogo</p>
          <p className="text-2xl font-black text-rose-700">{searchInsights.noResultTerms.length}</p>
          <p className="text-xs text-rose-700/80 mt-1">termos com demanda sem oferta</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-sky-700 font-bold">Busca para Carrinho</p>
          <p className="text-2xl font-black text-sky-700">{searchInsights.totals.searchAddToCart}</p>
          <p className="text-xs text-sky-700/80 mt-1">adds ao carrinho originados de busca</p>
        </div>
        <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-cyan-700 font-bold">Conversao Busca-&gt;Carrinho</p>
          <p className="text-2xl font-black text-cyan-700">{(searchInsights.totals.searchConversionRate * 100).toFixed(0)}%</p>
          <p className="text-xs text-cyan-700/80 mt-1">forca comercial para vender destaque</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          {renderSectionToggle('topTerms', 'Top termos')}
          {!isCollapsed('topTerms') && (
            <div className="space-y-2">
              {searchInsights.topTerms.map((term) => (
                <div key={term.query} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-700">{term.query}</span>
                  <span className="text-xs font-bold text-[#5D082A]">{term.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          {renderSectionToggle('noResultTerms', 'Termos sem resultado')}
          {!isCollapsed('noResultTerms') && (
            <div className="space-y-2">
              {searchInsights.noResultTerms.length === 0 && (
                <div className="rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-medium">
                  Nenhum termo critico sem resultado no periodo.
                </div>
              )}
              {searchInsights.noResultTerms.map((term) => (
                <div key={term.query} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="text-sm text-red-700">{term.query}</span>
                  <span className="text-xs font-bold text-red-600">{term.noResults} falhas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-100 p-4 bg-gray-50/60">
          {renderSectionToggle('topCorrections', 'Top correcoes automaticas')}
          {!isCollapsed('topCorrections') && (
            <>
              <p className="text-xs text-gray-500 mb-3">Mostra intencao comercial real por termo digitado errado</p>
              <div className="space-y-2">
                {searchInsights.topCorrections.length === 0 && (
                  <div className="rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-medium">
                    Ainda sem correcoes registradas no periodo.
                  </div>
                )}
                {searchInsights.topCorrections.map((item) => (
                  <div key={`${item.originalQuery}-${item.correctedQuery}`} className="rounded-lg bg-white border border-gray-100 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{item.originalQuery} <span className="text-gray-400">-&gt;</span> {item.correctedQuery}</p>
                      <p className="text-xs text-gray-500">ultimo evento: {new Date(item.lastAt).toLocaleString('pt-BR')}</p>
                    </div>
                    <span className="text-xs font-bold text-[#5D082A] whitespace-nowrap">{item.count}x</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-gray-100 p-4 bg-gray-50/60">
          {renderSectionToggle('adsOpportunitiesGuide', 'Oportunidades comerciais para Ads')}
          {!isCollapsed('adsOpportunitiesGuide') && (
            <>
              <p className="text-xs text-gray-500 mb-3">Use estes sinais para montar propostas a fornecedores</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>- Destaque patrocinado para termos com alto volume em Top termos.</li>
                <li>- Campanhas de captura para termos em Top correcoes (intencao forte mesmo com erro).</li>
                <li>- Co-financiamento de estoque para termos sem resultado (demanda reprimida).</li>
                <li>- Pricing de ads por impressao qualificada com base em correctionRate e noResultRate.</li>
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-100 p-4 bg-white">
          {renderSectionToggle('adsRanking', 'Ranking de termos para Ads')}
          {!isCollapsed('adsRanking') && (
            <>
              <div className="flex items-center justify-end mb-3">
                <span className="text-xs text-gray-500">score de demanda comercial</span>
              </div>
              <div className="space-y-2">
                {searchInsights.adOpportunities.length === 0 && (
                  <div className="rounded-lg bg-gray-50 text-gray-600 px-3 py-2 text-sm">
                    Ainda sem volume suficiente para ranking de ads.
                  </div>
                )}
                {searchInsights.adOpportunities.map((item) => (
                  <div key={item.query} className="rounded-lg border border-gray-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.query}</p>
                      <Badge variant="secondary" className={`text-[10px] uppercase tracking-wider font-bold ${
                        item.adTier === 'ouro'
                          ? 'bg-amber-100 text-amber-800'
                          : item.adTier === 'prata'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.adTier}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>buscas: <strong>{item.searches}</strong></span>
                      <span>score: <strong>{item.adDemandScore.toFixed(1)}</strong></span>
                      <span>sem resultado: <strong>{(item.noResultRate * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-gray-100 p-4 bg-white">
          {renderSectionToggle('correctedIntent', 'Intencao corrigida mais frequente')}
          {!isCollapsed('correctedIntent') && (
            <>
              <div className="flex items-center justify-end mb-3">
                <span className="text-xs text-gray-500">termo final desejado pelo cliente</span>
              </div>
              <div className="space-y-2">
                {searchInsights.topCorrectedIntentTargets.length === 0 && (
                  <div className="rounded-lg bg-gray-50 text-gray-600 px-3 py-2 text-sm">
                    Sem intencoes corrigidas registradas no periodo.
                  </div>
                )}
                {searchInsights.topCorrectedIntentTargets.map((item) => (
                  <div key={item.query} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <span className="text-sm text-gray-700">{item.query}</span>
                    <span className="text-xs font-bold text-[#5D082A]">{item.count}x</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-gray-100 p-4 bg-white">
        {renderSectionToggle('topConversions', 'Top termos que viram carrinho')}
        {!isCollapsed('topConversions') && (
          <>
            <div className="flex items-center justify-end mb-3">
              <span className="text-xs text-gray-500">intencao comercial validada por acao</span>
            </div>
            <div className="space-y-2">
              {searchInsights.topConvertingTerms.length === 0 && (
                <div className="rounded-lg bg-gray-50 text-gray-600 px-3 py-2 text-sm">
                  Sem conversoes de busca para carrinho no periodo.
                </div>
              )}
              {searchInsights.topConvertingTerms.map((item) => (
                <div key={item.query} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.query}</p>
                    <p className="text-xs text-gray-500">
                      {item.addToCartCount} add(s) / {item.searches} buscas
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#5D082A]">{(item.conversionRate * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
