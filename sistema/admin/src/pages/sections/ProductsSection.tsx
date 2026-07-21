import { useState, type FormEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Package,
  Infinity,
  Layers,
  CheckSquare,
  Square,
  AlertTriangle,
  FolderOpen,
  EyeOff,
  Tag,
  CheckCircle2,
} from 'lucide-react'
import type { AdminProduct, ProductAvailabilityMetricsResponse, SolidcomStatusResponse } from '../../services/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'
import ProductSlideOver from './ProductSlideOver'

type ProductFormState = {
  ean: string
  name: string
  titleMask: string
  titleMaskShort: string
  alternativeDescription: string
  classification01: string
  classification02: string
  classification03: string
  classification04: string
  price: string
  promotionalPrice: string
  stock: string
  unit: string
  badges: string
  origin: string
  videoUrl: string
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>
type SelectOption = { value: string }
type PendingProductAction =
  | { type: 'delete-product'; productId: string; productName: string }
  | { type: 'bulk-status'; active: boolean; ids: string[] }
  | { type: 'bulk-delete'; ids: string[] }
type ProductFeedback = {
  tone: 'success' | 'error'
  title: string
  description?: string
}

type Props = {
  productsSearch: string
  onProductsSearchChange: (value: string) => void
  onSearch: () => void
  onSyncProducts: () => void
  syncingProducts: boolean
  onSyncTaxonomy: () => void
  syncingTaxonomy: boolean
  onCreateProduct: () => void
  classification01Filter: string
  classification02Filter: string
  classification03Filter: string
  classification04Filter: string
  onClassification01FilterChange: (value: string) => void
  onClassification02FilterChange: (value: string) => void
  onClassification03FilterChange: (value: string) => void
  onClassification04FilterChange: (value: string) => void
  groupedMercadologicalTree: SelectOption[]
  level2Options: SelectOption[]
  level3Options: SelectOption[]
  level4Options: SelectOption[]
  formatClassificationOptionLabel: (value: string) => string
  isProductFormOpen: boolean
  editingProductId: string | null
  onSaveProduct: (event: FormEvent<HTMLFormElement>) => void
  productForm: ProductFormState
  productFormErrors: ProductFormErrors
  onProductFormChange: (updates: Partial<ProductFormState>) => void
  formLevel2Options: SelectOption[]
  formLevel3Options: SelectOption[]
  formLevel4Options: SelectOption[]
  onResetProductForm: () => void
  savingProduct: boolean
  productsLoading: boolean
  productsError: string
  products: AdminProduct[]
  formatClassificationPath: (values: Array<string | null | undefined>) => string
  onEditProduct: (product: AdminProduct) => void
  onDeleteProduct: (id: string) => Promise<void>
  productsPage: number
  productsTotalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
  solidcomStatusLoading: boolean
  solidcomStatus: SolidcomStatusResponse | null
  onReloadSolidcomStatus: () => void
  solidcomStatusExpanded: boolean
  onToggleSolidcomStatusExpanded: () => void
  availabilityMetrics: ProductAvailabilityMetricsResponse | null
  productsFilterOutOfStock: boolean
  onProductsFilterOutOfStockChange: (value: boolean) => void
  productsFilterInactive: boolean
  onProductsFilterInactiveChange: (value: boolean) => void
  productsFilterUncategorized: boolean
  onProductsFilterUncategorizedChange: (value: boolean) => void
  onBulkUpdateStatus: (ids: string[], active: boolean) => Promise<void>
  onBulkDelete: (ids: string[]) => Promise<void>
  onUpdateProductFields: (id: string, updates: Partial<AdminProduct>) => Promise<void>
  productFeedback: ProductFeedback | null
  onDismissProductFeedback: () => void
}

// --- Sub-components ---

function SyncOptionBadge({ value }: { value?: string | null }) {
  if (!value) return null
  const map: Record<string, { label: string; color: string }> = {
    SEMPRE: { label: 'Sempre', color: 'bg-emerald-100 text-emerald-700' },
    ESTOQUE: { label: 'Estoque', color: 'bg-amber-100 text-amber-700' },
    NUNCA: { label: 'Nunca', color: 'bg-gray-100 text-gray-500' },
  }
  const item = map[value]
  if (!item) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${item.color}`}>
      {value === 'SEMPRE' && <Infinity size={10} />}
      {item.label}
    </span>
  )
}

function StockGauge({ stock }: { stock: number | null | undefined }) {
  const s = stock ?? 0
  if (s <= 0) return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">Zerado</span>
  if (s <= 4) return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Baixo · {s}</span>
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{s} un.</span>
}

function PriceDisplay({ price, promoPrice, unit, formatPrice }: { price: number; promoPrice?: number | null; unit?: string; formatPrice: (v: number) => string }) {
  const hasPromo = typeof promoPrice === 'number' && promoPrice > 0 && promoPrice < price
  return (
    <div>
      {hasPromo ? (
        <>
          <p className="text-[11px] text-gray-400 line-through">{formatPrice(price)}</p>
          <p className="font-bold text-emerald-700">{formatPrice(promoPrice!)}</p>
          <span className="inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">PROMO</span>
        </>
      ) : (
        <>
          <p className="font-semibold text-gray-800">{formatPrice(price)}</p>
          <p className="text-xs text-gray-400">/{unit || 'UN'}</p>
        </>
      )}
    </div>
  )
}

// --- Main Component ---

export default function ProductsSection({
  productsSearch,
  onProductsSearchChange,
  onSearch,
  onSyncProducts,
  syncingProducts,
  onSyncTaxonomy,
  syncingTaxonomy,
  onCreateProduct,
  classification01Filter,
  classification02Filter,
  classification03Filter,
  classification04Filter,
  onClassification01FilterChange,
  onClassification02FilterChange,
  onClassification03FilterChange,
  onClassification04FilterChange,
  groupedMercadologicalTree,
  level2Options,
  level3Options,
  level4Options,
  formatClassificationOptionLabel,
  isProductFormOpen,
  editingProductId,
  onSaveProduct,
  productForm,
  productFormErrors,
  onProductFormChange,
  formLevel2Options,
  formLevel3Options,
  formLevel4Options,
  onResetProductForm,
  savingProduct,
  productsLoading,
  productsError,
  products,
  formatClassificationPath,
  onEditProduct,
  onDeleteProduct,
  productsPage,
  productsTotalPages,
  onPreviousPage,
  onNextPage,
  solidcomStatusLoading,
  solidcomStatus,
  onReloadSolidcomStatus,
  solidcomStatusExpanded,
  onToggleSolidcomStatusExpanded,
  availabilityMetrics,
  productsFilterOutOfStock,
  onProductsFilterOutOfStockChange,
  productsFilterInactive,
  onProductsFilterInactiveChange,
  productsFilterUncategorized,
  onProductsFilterUncategorizedChange,
  onBulkUpdateStatus,
  onBulkDelete,
  onUpdateProductFields,
  productFeedback,
  onDismissProductFeedback,
}: Props) {
  const activeFilterCount = [classification01Filter, classification02Filter, classification03Filter, classification04Filter].filter(Boolean).length
  const isSolidcomEnabled = Boolean(solidcomStatus?.enabled)
  const canRunSolidcomActions = !solidcomStatusLoading && isSolidcomEnabled
  const solidcomActionHint = solidcomStatusLoading
    ? 'Verificando status da extensão Solidcom...'
    : 'Habilite a extensão Solidcom para usar esta ação.'

  const [catalogViewMode, setCatalogViewMode] = useState<'table' | 'cards'>('table')
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingProductAction | null>(null)
  const [confirmingAction, setConfirmingAction] = useState(false)

  const [editingCell, setEditingCell] = useState<{
    productId: string
    field: 'price' | 'promotionalPrice' | 'stock'
  } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [inlineEditError, setInlineEditError] = useState('')
  const activeFeedback = inlineEditError
    ? { tone: 'error' as const, title: inlineEditError }
    : productFeedback

  const handleSaveInline = async (productId: string, field: 'price' | 'promotionalPrice' | 'stock', value: string) => {
    setEditingCell(null)
    setInlineEditError('')
    const normalized = value.trim()
    let parsedValue: number | null = null

    if (field === 'price') {
      const num = parseFloat(normalized.replace(',', '.'))
      if (isNaN(num) || num < 0) {
        setInlineEditError('Preço inválido')
        return
      }
      parsedValue = num
    } else if (field === 'promotionalPrice') {
      if (normalized === '') {
        parsedValue = null
      } else {
        const num = parseFloat(normalized.replace(',', '.'))
        if (isNaN(num) || num < 0) {
          setInlineEditError('Preço promocional inválido')
          return
        }
        parsedValue = num
      }
    } else if (field === 'stock') {
      if (normalized === '') {
        parsedValue = null
      } else {
        const num = parseInt(normalized, 10)
        if (isNaN(num)) {
          setInlineEditError('Estoque inválido')
          return
        }
        parsedValue = num
      }
    }

    try {
      await onUpdateProductFields(productId, { [field]: parsedValue })
    } catch (err) {
      // The parent renders the API error in the catalog feedback banner.
    }
  }

  const handleToggleOutOfStock = () => {
    onProductsFilterOutOfStockChange(!productsFilterOutOfStock)
    onProductsFilterInactiveChange(false)
    onProductsFilterUncategorizedChange(false)
  }

  const handleToggleUncategorized = () => {
    onProductsFilterUncategorizedChange(!productsFilterUncategorized)
    onProductsFilterOutOfStockChange(false)
    onProductsFilterInactiveChange(false)
  }

  const handleToggleInactive = () => {
    onProductsFilterInactiveChange(!productsFilterInactive)
    onProductsFilterOutOfStockChange(false)
    onProductsFilterUncategorizedChange(false)
  }

  const handleResetFilters = () => {
    onProductsFilterOutOfStockChange(false)
    onProductsFilterInactiveChange(false)
    onProductsFilterUncategorizedChange(false)
  }

  const editingProduct = editingProductId ? (products.find((p) => p.id === editingProductId) ?? null) : null

  const formatPrice = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

  const formatFriendlyCategoryLabel = (value: string) =>
    formatClassificationOptionLabel(value).replace(/^\d+\s*-\s*/, '').replace(/_/g, ' ')

  // --- Selection Helpers ---
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  const requestBulkStatusUpdate = (active: boolean) => {
    setPendingAction({ type: 'bulk-status', active, ids: Array.from(selectedIds) })
  }

  const requestBulkDelete = () => {
    setPendingAction({ type: 'bulk-delete', ids: Array.from(selectedIds) })
  }

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return
    setConfirmingAction(true)
    try {
      if (pendingAction.type === 'delete-product') {
        await onDeleteProduct(pendingAction.productId)
      } else if (pendingAction.type === 'bulk-status') {
        await onBulkUpdateStatus(pendingAction.ids, pendingAction.active)
        clearSelection()
      } else {
        await onBulkDelete(pendingAction.ids)
        clearSelection()
      }
      setPendingAction(null)
    } catch (err) {
      // The parent owns the user-facing API error banner.
    } finally {
      setConfirmingAction(false)
    }
  }

  const pendingActionCopy = (() => {
    if (!pendingAction) return null
    if (pendingAction.type === 'delete-product') {
      return {
        title: 'Inativar produto?',
        description: `A acao vai inativar "${pendingAction.productName}" no catalogo administrativo.`,
        confirmLabel: 'Inativar produto',
        destructive: true,
      }
    }
    if (pendingAction.type === 'bulk-status') {
      return {
        title: pendingAction.active ? 'Ativar produtos selecionados?' : 'Inativar produtos selecionados?',
        description: `${pendingAction.ids.length} produto(s) selecionado(s) serao ${pendingAction.active ? 'ativados' : 'inativados'} em lote.`,
        confirmLabel: pendingAction.active ? 'Ativar produtos' : 'Inativar produtos',
        destructive: !pendingAction.active,
      }
    }
    return {
      title: 'Excluir produtos selecionados?',
      description: `${pendingAction.ids.length} produto(s) selecionado(s) serao excluidos permanentemente.`,
      confirmLabel: 'Excluir produtos',
      destructive: true,
    }
  })()

  // --- Filter chips ---
  const filterChips: { label: string; onRemove: () => void }[] = [
    ...(classification01Filter ? [{ label: `Depto: ${formatFriendlyCategoryLabel(classification01Filter)}`, onRemove: () => { onClassification01FilterChange(''); onClassification02FilterChange(''); onClassification03FilterChange(''); onClassification04FilterChange('') } }] : []),
    ...(classification02Filter ? [{ label: `Seção: ${formatFriendlyCategoryLabel(classification02Filter)}`, onRemove: () => { onClassification02FilterChange(''); onClassification03FilterChange(''); onClassification04FilterChange('') } }] : []),
    ...(classification03Filter ? [{ label: `N3: ${formatFriendlyCategoryLabel(classification03Filter)}`, onRemove: () => { onClassification03FilterChange(''); onClassification04FilterChange('') } }] : []),
    ...(classification04Filter ? [{ label: `N4: ${formatFriendlyCategoryLabel(classification04Filter)}`, onRemove: () => onClassification04FilterChange('') }] : []),
  ]

  return (
    <>
      {/* Slide-Over */}
      <ProductSlideOver
        isOpen={isProductFormOpen}
        editingProduct={editingProduct}
        productForm={productForm}
        productFormErrors={productFormErrors}
        onProductFormChange={onProductFormChange}
        onSaveProduct={onSaveProduct}
        onClose={onResetProductForm}
        savingProduct={savingProduct}
        groupedMercadologicalTree={groupedMercadologicalTree}
        formLevel2Options={formLevel2Options}
        formLevel3Options={formLevel3Options}
        formLevel4Options={formLevel4Options}
        formatClassificationOptionLabel={formatClassificationOptionLabel}
        availabilityMetrics={availabilityMetrics}
      />

      <div className="space-y-4">
        {activeFeedback && !pendingActionCopy && (
          <div
            role="alert"
            className={`sticky top-0 z-20 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm shadow-sm ${
              activeFeedback.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              {activeFeedback.tone === 'success' ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-700" />
              )}
              <div className="min-w-0">
                <p className="font-bold">{activeFeedback.title}</p>
                {activeFeedback.description && (
                  <p className="mt-1 text-xs leading-5 opacity-80">{activeFeedback.description}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setInlineEditError('')
                onDismissProductFeedback()
              }}
              variant="ghost"
              size="icon"
              className={activeFeedback.tone === 'success' ? 'h-8 w-8 shrink-0 rounded-lg text-emerald-700 hover:bg-emerald-100' : 'h-8 w-8 shrink-0 rounded-lg text-red-700 hover:bg-red-100'}
              aria-label="Dispensar aviso do catalogo"
            >
              <X size={15} />
            </Button>
          </div>
        )}

      {/* KPI Bar */}
      <SectionToolbar>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Card 1: Todos */}
            <div
              onClick={handleResetFilters}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 select-none relative overflow-hidden group ${
                !productsFilterOutOfStock && !productsFilterInactive && !productsFilterUncategorized
                  ? 'border-[#5d082a] bg-gradient-to-br from-[#5d082a] to-[#80103c] text-white shadow-[0_8px_30px_rgba(93,8,42,0.25)] scale-[1.02]'
                  : 'border-[#ead7df]/60 bg-[#fffbfd] text-[#3d272f] hover:border-[#5d082a]/30 hover:bg-[#fff0f5]/30 hover:shadow-md hover:shadow-[#5d082a]/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  !productsFilterOutOfStock && !productsFilterInactive && !productsFilterUncategorized
                    ? 'text-white/80'
                    : 'text-[#5d082a]/60'
                }`}>Todos os Produtos</p>
                <Layers size={16} className={`transition-transform duration-300 group-hover:scale-110 ${
                  !productsFilterOutOfStock && !productsFilterInactive && !productsFilterUncategorized
                    ? 'text-white/60'
                    : 'text-[#5d082a]/40'
                }`} />
              </div>
              <p className="mt-2 text-3xl font-black leading-none">{availabilityMetrics?.totalActive ?? products.length}</p>
              <p className={`mt-1 text-[10px] ${
                !productsFilterOutOfStock && !productsFilterInactive && !productsFilterUncategorized
                  ? 'text-white/60'
                  : 'text-gray-400'
              }`}>Catálogo completo</p>
            </div>

            {/* Card 2: Sem Estoque */}
            <div
              onClick={handleToggleOutOfStock}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 select-none relative overflow-hidden group ${
                productsFilterOutOfStock
                  ? 'border-amber-500 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_8px_30px_rgba(245,158,11,0.25)] scale-[1.02]'
                  : 'border-amber-200/60 bg-[#fffdfa] text-amber-900 hover:border-amber-400/80 hover:bg-amber-50/50 hover:shadow-md hover:shadow-amber-500/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  productsFilterOutOfStock ? 'text-white/85' : 'text-amber-850/85'
                }`}>Sem Estoque</p>
                <AlertTriangle size={16} className={`transition-transform duration-300 group-hover:scale-110 ${
                  productsFilterOutOfStock ? 'text-white/70' : 'text-amber-600/70'
                }`} />
              </div>
              <p className="mt-2 text-3xl font-black leading-none">
                {availabilityMetrics?.outOfStock ?? 0}
              </p>
              <p className={`mt-1 text-[10px] ${
                productsFilterOutOfStock ? 'text-white/60' : 'text-amber-600/60'
              }`}>Produtos com estoque zerado</p>
            </div>

            {/* Card 3: Sem Categoria */}
            <div
              onClick={handleToggleUncategorized}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 select-none relative overflow-hidden group ${
                productsFilterUncategorized
                  ? 'border-slate-500 bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-[0_8px_30px_rgba(100,116,139,0.25)] scale-[1.02]'
                  : 'border-slate-200/60 bg-[#fafbfe] text-slate-800 hover:border-slate-400/80 hover:bg-slate-50/50 hover:shadow-md hover:shadow-slate-500/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  productsFilterUncategorized ? 'text-white/85' : 'text-slate-650'
                }`}>Sem Categoria</p>
                <FolderOpen size={16} className={`transition-transform duration-300 group-hover:scale-110 ${
                  productsFilterUncategorized ? 'text-white/70' : 'text-slate-500'
                }`} />
              </div>
              <p className="mt-2 text-3xl font-black leading-none">-</p>
              <p className={`mt-1 text-[10px] ${
                productsFilterUncategorized ? 'text-white/60' : 'text-slate-500/60'
              }`}>Sem departamento</p>
            </div>

            {/* Card 4: Inativos */}
            <div
              onClick={handleToggleInactive}
              className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 select-none relative overflow-hidden group ${
                productsFilterInactive
                  ? 'border-zinc-700 bg-gradient-to-br from-zinc-700 to-zinc-800 text-white shadow-[0_8px_30px_rgba(63,63,70,0.25)] scale-[1.02]'
                  : 'border-zinc-200/60 bg-[#fafafa] text-zinc-800 hover:border-zinc-400/80 hover:bg-zinc-100/50 hover:shadow-md hover:shadow-zinc-700/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  productsFilterInactive ? 'text-white/85' : 'text-zinc-650'
                }`}>Inativos</p>
                <EyeOff size={16} className={`transition-transform duration-300 group-hover:scale-110 ${
                  productsFilterInactive ? 'text-white/70' : 'text-zinc-500'
                }`} />
              </div>
              <p className="mt-2 text-3xl font-black leading-none">
                {availabilityMetrics?.inactiveWithStock ?? 0}
              </p>
              <p className={`mt-1 text-[10px] ${
                productsFilterInactive ? 'text-white/60' : 'text-zinc-500/60'
              }`}>Fora de exibição</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={onToggleSolidcomStatusExpanded}
            variant="outline"
            size="sm"
            className="min-h-10 rounded-xl border-[#e7d2db] bg-white px-4 text-xs font-semibold text-[#5d082a] hover:bg-[#fff7fa]"
          >
            {solidcomStatusExpanded ? 'Ocultar métricas' : 'Métricas de disponibilidade'}
          </Button>
        </div>

        {solidcomStatusExpanded && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 rounded-xl border border-[#f1dbe3] bg-[#fffafc] p-3">
            <SectionMetric label="Estoque baixo (1-4)" value={availabilityMetrics?.lowStockProducts ?? '-'} tone="brand" />
            <SectionMetric label="Sempre ativo com estoque zerado" value={availabilityMetrics?.alwaysEnabledWithZeroStock ?? '-'} tone="success" />
            <SectionMetric label="Inativo com estoque" value={availabilityMetrics?.inactiveWithStock ?? '-'} tone="neutral" />
          </div>
        )}
      </SectionToolbar>

      {/* Toolbar: Search + Actions */}
      <SectionToolbar>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={productsSearch}
              onChange={(e) => onProductsSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="Buscar por nome, descrição ou EAN..."
              className="h-12 w-full rounded-xl border border-[#ead7df] bg-white pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-[#5d082a] focus:ring-4 focus:ring-[#5d082a]/10"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex items-center rounded-xl border border-[#ead7df] bg-white p-1">
              <Button
                type="button"
                onClick={() => setCatalogViewMode('table')}
                variant={catalogViewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className={catalogViewMode === 'table' ? 'bg-[#5d082a] text-white hover:bg-[#4a0622]' : 'text-[#5d082a] hover:bg-[#fff7fa]'}
              >
                <List size={14} /> Tabela
              </Button>
              <Button
                type="button"
                onClick={() => setCatalogViewMode('cards')}
                variant={catalogViewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className={catalogViewMode === 'cards' ? 'bg-[#5d082a] text-white hover:bg-[#4a0622]' : 'text-[#5d082a] hover:bg-[#fff7fa]'}
              >
                <LayoutGrid size={14} /> Cards
              </Button>
            </div>

            <Button onClick={onSyncProducts} disabled={syncingProducts || !canRunSolidcomActions} title={!canRunSolidcomActions ? solidcomActionHint : 'Sincronizar produtos com Solidcom'} className="min-h-11 rounded-xl bg-sky-600 px-4 text-sm text-white hover:bg-sky-700">
              <RefreshCw size={15} className={syncingProducts ? 'animate-spin' : ''} />
              Sync Solidcom
            </Button>

            <Button onClick={onSyncTaxonomy} disabled={syncingTaxonomy || !canRunSolidcomActions} title={!canRunSolidcomActions ? solidcomActionHint : 'Gerar taxonomia com dados do Solidcom'} className="min-h-11 rounded-xl bg-amber-600 px-4 text-sm text-white hover:bg-amber-700">
              <RefreshCw size={15} className={syncingTaxonomy ? 'animate-spin' : ''} />
              Gerar Taxonomia
            </Button>

            <Button onClick={onCreateProduct} className="min-h-11 rounded-xl bg-[#5d082a] px-4 text-sm font-bold text-white shadow-lg shadow-[#5d082a]/20 hover:bg-[#4a0622]">
              <Plus size={15} />
              Novo Produto
            </Button>
          </div>
        </div>
      </SectionToolbar>

      {/* Filter Bar */}
      <SectionToolbar>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setShowFilterBar((prev) => !prev)}
              variant={showFilterBar ? 'default' : 'outline'}
              size="sm"
              className={showFilterBar ? 'min-h-9 rounded-xl border-[#5d082a] bg-[#5d082a] px-4 text-white hover:bg-[#4a0622]' : 'min-h-9 rounded-xl border-[#e8d5de] bg-white px-4 text-[#5d082a] hover:bg-[#fff1f7]'}
            >
              <Filter size={13} />
              Filtrar
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${showFilterBar ? 'bg-white/20' : 'bg-[#5d082a] text-white'}`}>{activeFilterCount}</span>
              )}
            </Button>

            {/* Active filter chips */}
            {filterChips.map((chip) => (
              <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0f5] px-3 py-1.5 text-xs font-semibold text-[#5d082a]">
                {chip.label}
                <Button type="button" onClick={chip.onRemove} variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0 text-[#5d082a] hover:bg-[#5d082a]/10" aria-label={`Remover filtro ${chip.label}`}>
                  <X size={11} />
                </Button>
              </span>
            ))}
          </div>

          {showFilterBar && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Select value={classification01Filter} onChange={(e) => onClassification01FilterChange(e.target.value)} className="h-12 rounded-xl border-[#ead7df] bg-white pl-10 pr-4 text-gray-700 focus-visible:ring-[#5d082a]/20">
                  <option value="">Departamento</option>
                  {groupedMercadologicalTree.map((item) => (<option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>))}
                </Select>
              </div>
              <Select value={classification02Filter} onChange={(e) => onClassification02FilterChange(e.target.value)} className="h-12 rounded-xl border-[#ead7df] bg-white px-4 text-gray-700 focus-visible:ring-[#5d082a]/20" disabled={!classification01Filter}>
                <option value="">Seção</option>
                {level2Options.map((item) => (<option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>))}
              </Select>
              <Select value={classification03Filter} onChange={(e) => onClassification03FilterChange(e.target.value)} className="h-12 rounded-xl border-[#ead7df] bg-white px-4 text-gray-700 focus-visible:ring-[#5d082a]/20" disabled={!classification02Filter}>
                <option value="">Refino N3</option>
                {level3Options.map((item) => (<option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>))}
              </Select>
              <Select value={classification04Filter} onChange={(e) => onClassification04FilterChange(e.target.value)} className="h-12 rounded-xl border-[#ead7df] bg-white px-4 text-gray-700 focus-visible:ring-[#5d082a]/20" disabled={!classification03Filter}>
                <option value="">Refino N4</option>
                {level4Options.map((item) => (<option key={item.value} value={item.value}>{formatFriendlyCategoryLabel(item.value)}</option>))}
              </Select>
            </div>
          )}
        </div>
      </SectionToolbar>

      {/* Product List Panel */}
      <SectionPanel>
        {productsLoading ? (
          <div className="flex items-center justify-center p-12 text-gray-500">
            <RefreshCw size={20} className="mr-3 animate-spin" />
            Carregando produtos...
          </div>
        ) : productsError ? (
          <div className="p-6 text-red-600">{productsError}</div>
        ) : (
          <>
            {products.length === 0 ? (
              <div className="p-6">
                <SectionEmptyState title="Nenhum produto encontrado" description="Ajuste a busca, revise os filtros ou sincronize novamente os dados do Solidcom." />
              </div>
            ) : catalogViewMode === 'table' ? (
              <Table className="min-w-full text-sm">
                  <TableHeader className="bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)] text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10">
                        <Button type="button" onClick={toggleAll} variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-[#5d082a]">
                          {allSelected ? <CheckSquare size={16} className="text-[#5d082a]" /> : <Square size={16} />}
                        </Button>
                      </TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const isSelected = selectedIds.has(product.id)
                      const categoryPath = formatClassificationPath([product.classification01, product.classification02, product.classification03, product.classification04])
                      return (
                        <TableRow
                          key={product.id}
                          className={`group border-t border-[#f2e5eb] transition-colors ${isSelected ? 'bg-[#fff0f5]' : 'hover:bg-[#fffafc]'}`}
                        >
                          {/* Checkbox */}
                          <TableCell>
                            <Button type="button" onClick={() => toggleOne(product.id)} variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-[#5d082a]">
                              {isSelected ? <CheckSquare size={16} className="text-[#5d082a]" /> : <Square size={16} />}
                            </Button>
                          </TableCell>

                          {/* Produto */}
                          <TableCell className="align-top">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0f5] text-[#5d082a]">
                                <Package size={14} />
                              </div>
                              <div>
                                <p className="max-w-[260px] truncate font-semibold text-gray-800" title={product.name}>{product.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">EAN {product.ean}</span>
                                  {product.badges && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f5] border border-[#e7d2db]/60 px-2 py-0.5 text-[10px] font-bold text-[#5d082a]">
                                      <Tag size={10} className="shrink-0" />
                                      {product.badges}
                                    </span>
                                  )}
                                  <SyncOptionBadge value={product.syncOption} />
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Categoria */}
                          <TableCell className="align-top">
                            <span className="line-clamp-2 text-xs text-gray-500">{categoryPath || <span className="italic text-gray-300">Sem categoria</span>}</span>
                          </TableCell>

                          {/* Preço */}
                          <TableCell onDoubleClick={() => {
                            if (editingCell?.productId !== product.id || editingCell?.field !== 'price') {
                              setEditingCell({ productId: product.id, field: 'price' })
                              setEditValue(product.price.toString())
                            }
                          }}>
                            <div className="flex flex-col">
                              {/* Regular Price */}
                              {editingCell?.productId === product.id && editingCell?.field === 'price' ? (
                                <div className="relative flex items-center z-10 animate-in fade-in zoom-in-95 duration-150">
                                  <Input
                                    type="text"
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveInline(product.id, 'price', editValue)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onBlur={() => handleSaveInline(product.id, 'price', editValue)}
                                    className="w-24 rounded-lg border border-[#5d082a] bg-white px-2.5 py-1 text-xs font-bold text-[#2e2226] shadow-sm outline-none transition focus:ring-2 focus:ring-[#5d082a]/20"
                                  />
                                </div>
                              ) : (
                                <div
                                  className="group/item inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#5d082a]/5 hover:text-[#5d082a] rounded-lg px-2 py-0.5 -mx-2 transition-all duration-200 w-fit"
                                  onClick={() => {
                                    setEditingCell({ productId: product.id, field: 'price' })
                                    setEditValue(product.price.toString())
                                  }}
                                >
                                  <span className={`font-semibold text-gray-800 group-hover/item:text-[#5d082a] ${product.promotionalPrice && product.promotionalPrice > 0 ? 'line-through text-gray-400 text-xs' : ''}`}>
                                    {formatPrice(product.price)}
                                  </span>
                                  <Pencil size={10} className="text-[#9e7080] group-hover/item:text-[#5d082a] opacity-0 scale-75 group-hover/item:opacity-100 group-hover/item:scale-100 transition-all duration-200 transform translate-x-1 group-hover/item:translate-x-0" />
                                </div>
                              )}

                              {/* Promo Price */}
                              {editingCell?.productId === product.id && editingCell?.field === 'promotionalPrice' ? (
                                <div className="relative flex items-center z-10 mt-1 animate-in fade-in zoom-in-95 duration-150">
                                  <Input
                                    type="text"
                                    autoFocus
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveInline(product.id, 'promotionalPrice', editValue)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onBlur={() => handleSaveInline(product.id, 'promotionalPrice', editValue)}
                                    placeholder="Ex: 8.90"
                                    className="w-24 rounded-lg border border-[#5d082a] bg-white px-2.5 py-1 text-xs font-bold text-[#2e2226] shadow-sm outline-none transition focus:ring-2 focus:ring-[#5d082a]/20"
                                  />
                                </div>
                              ) : (
                                <div
                                  className="group/item inline-flex items-center gap-1.5 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 rounded-lg px-2 py-0.5 -mx-2 mt-0.5 w-fit"
                                  onClick={() => {
                                    setEditingCell({ productId: product.id, field: 'promotionalPrice' })
                                    setEditValue(product.promotionalPrice?.toString() ?? '')
                                  }}
                                >
                                  {product.promotionalPrice && product.promotionalPrice > 0 ? (
                                    <>
                                      <span className="font-bold text-emerald-700">{formatPrice(product.promotionalPrice)}</span>
                                      <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[9px] font-black text-emerald-700 uppercase tracking-wider">PROMO</span>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic hover:text-emerald-600">+ Promo</span>
                                  )}
                                  <Pencil size={10} className="text-[#9e7080] group-hover/item:text-emerald-600 opacity-0 scale-75 group-hover/item:opacity-100 group-hover/item:scale-100 transition-all duration-200 transform translate-x-1 group-hover/item:translate-x-0" />
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Estoque */}
                          <TableCell onDoubleClick={() => {
                            if (editingCell?.productId !== product.id || editingCell?.field !== 'stock') {
                              setEditingCell({ productId: product.id, field: 'stock' })
                              setEditValue(product.stock?.toString() ?? '')
                            }
                          }}>
                            {editingCell?.productId === product.id && editingCell?.field === 'stock' ? (
                              <div className="relative flex items-center z-10 animate-in fade-in zoom-in-95 duration-150">
                                <Input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInline(product.id, 'stock', editValue)
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }}
                                  onBlur={() => handleSaveInline(product.id, 'stock', editValue)}
                                  placeholder="Ex: 10"
                                  className="w-20 rounded-lg border border-[#5d082a] bg-white px-2.5 py-1 text-xs font-bold text-[#2e2226] shadow-sm outline-none transition focus:ring-2 focus:ring-[#5d082a]/20"
                                />
                              </div>
                            ) : (
                              <div
                                className="group/item inline-flex items-center gap-1.5 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-0.5 -mx-2 w-fit transition-all duration-200"
                                onClick={() => {
                                    setEditingCell({ productId: product.id, field: 'stock' })
                                    setEditValue(product.stock?.toString() ?? '')
                                }}
                              >
                                <StockGauge stock={product.stock} />
                                <Pencil size={10} className="text-[#9e7080] group-hover/item:text-gray-600 opacity-0 scale-75 group-hover/item:opacity-100 group-hover/item:scale-100 transition-all duration-200 transform translate-x-1 group-hover/item:translate-x-0" />
                              </div>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="align-top">
                            <Badge variant={product.active ? 'success' : 'secondary'} className={product.active ? 'rounded-full px-3 py-1 text-xs font-bold' : 'rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500'}>
                              {product.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>

                          {/* Ações — aparece no hover */}
                          <TableCell className="align-top">
                            <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                type="button"
                                onClick={() => onEditProduct(product)}
                                variant="outline"
                                size="sm"
                                className="min-h-8 rounded-lg border-[#e8d8df] px-2.5 text-xs text-[#5d082a] hover:bg-[#fff7fa]"
                                title="Editar"
                              >
                                <Pencil size={13} /> Editar
                              </Button>
                              <Button
                                type="button"
                                onClick={() => setPendingAction({ type: 'delete-product', productId: product.id, productName: product.name })}
                                variant="outline"
                                size="sm"
                                className="min-h-8 rounded-lg border-red-200 px-2.5 text-xs text-red-500 hover:bg-red-50"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
            ) : (
              /* Cards View */
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => {
                  const categoryPath = formatClassificationPath([product.classification01, product.classification02, product.classification03, product.classification04])
                  return (
                    <div key={product.id} className="group rounded-2xl border border-[#ead7df]/60 bg-white p-5 shadow-[0_4px_20px_rgba(93,8,42,0.02)] transition-all duration-300 hover:shadow-[0_12px_30px_rgba(93,8,42,0.06)] hover:border-[#5d082a]/30 hover:-translate-y-0.5 flex flex-col justify-between min-h-[220px]">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f5] border border-[#e7d2db]/30 text-[#5d082a] transition duration-300 group-hover:scale-105 group-hover:bg-[#fff0f5]/80">
                            <Package size={18} />
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition ${product.active ? 'bg-emerald-50 text-emerald-800 border-emerald-200/50' : 'bg-slate-50 text-slate-600 border-slate-200/60'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${product.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {product.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          <p className="line-clamp-2 text-sm font-bold text-[#2e2226] group-hover:text-[#5d082a] transition duration-200" title={product.name}>{product.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] text-gray-500 border border-gray-100">EAN {product.ean}</span>
                            {product.badges && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fff0f5] border border-[#e7d2db]/60 px-1.5 py-0.5 text-[9px] font-bold text-[#5d082a]">
                                <Tag size={8} />
                                {product.badges}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-1 text-[10px] text-gray-400 font-medium" title={categoryPath}>{categoryPath || <span className="italic text-gray-300">Sem categoria</span>}</p>
                        </div>
                      </div>
                      
                      <div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl bg-[#fffafc] border border-[#f5edf1] px-3.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#5d082a]/50">Preço</p>
                            <PriceDisplay price={product.price} promoPrice={product.promotionalPrice} unit={product.unit} formatPrice={formatPrice} />
                          </div>
                          <div className="rounded-xl bg-slate-50/80 border border-slate-100 px-3.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Estoque</p>
                            <div className="mt-1"><StockGauge stock={product.stock} /></div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                          <Button type="button" onClick={() => onEditProduct(product)} variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#e8d8df] text-[#5d082a] hover:bg-[#fff7fa]" title="Editar" aria-label={`Editar ${product.name}`}>
                            <Pencil size={13} />
                          </Button>
                          <Button type="button" onClick={() => setPendingAction({ type: 'delete-product', productId: product.id, productName: product.name })} variant="outline" size="icon" className="h-8 w-8 rounded-lg border-red-100 text-red-500 hover:bg-red-50" title="Excluir" aria-label={`Excluir ${product.name}`}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[#f3e4ea] px-4 py-3">
              <span className="text-xs text-gray-400">Página <strong>{productsPage}</strong> de <strong>{productsTotalPages}</strong></span>
              <div className="flex gap-2">
                <Button onClick={onPreviousPage} disabled={productsPage <= 1} variant="secondary" size="sm" className="min-h-9 rounded-xl bg-gray-100 px-3 text-xs text-gray-600 hover:bg-gray-200">
                  <ChevronLeft size={15} /> Anterior
                </Button>
                <Button onClick={onNextPage} disabled={productsPage >= productsTotalPages} variant="secondary" size="sm" className="min-h-9 rounded-xl bg-gray-100 px-3 text-xs text-gray-600 hover:bg-gray-200">
                  Próxima <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionPanel>

      {/* Solidcom Status Panel */}
      <SectionPanel>
        <div className="border-b border-[#f1dbe3] bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)] p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-800">Status da Integração Solidcom</h3>
              <p className="text-xs text-gray-400">Volume, última sincronização e ocorrências recentes</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={onReloadSolidcomStatus} disabled={solidcomStatusLoading} variant="outline" size="sm" className="rounded-xl border-[#ead7df] px-3 text-[11px] uppercase tracking-wide text-gray-500 hover:bg-gray-50">
                Atualizar
              </Button>
              <Button type="button" onClick={onToggleSolidcomStatusExpanded} variant="outline" size="sm" className="rounded-xl border-[#ead7df] px-3 text-[11px] uppercase tracking-wide text-gray-500 hover:bg-gray-50">
                {solidcomStatusExpanded ? 'Recolher' : 'Expandir'}
              </Button>
            </div>
          </div>
        </div>

        {solidcomStatusExpanded && (
          <div className="p-5">
            {solidcomStatusLoading ? (
              <p className="text-sm text-gray-500">Carregando status...</p>
            ) : solidcomStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-xl border border-[#ead7df] bg-[#fff8fb] p-3">
                    <p className="text-xs text-gray-400">Produtos ativos</p>
                    <p className="mt-1 text-xl font-black">{solidcomStatus.productsCount}</p>
                  </div>
                  <div className="rounded-xl border border-[#ead7df] bg-[#fff8fb] p-3">
                    <p className="text-xs text-gray-400">Último sync</p>
                    <p className="mt-1 font-medium">{solidcomStatus.lastSync ? new Date(solidcomStatus.lastSync.at).toLocaleString('pt-BR') : 'Sem execuções'}</p>
                  </div>
                  <div className="rounded-xl border border-[#ead7df] bg-[#fff8fb] p-3">
                    <p className="text-xs text-gray-400">Resultado</p>
                    <div className="mt-1">
                      {solidcomStatus.lastSync ? (
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {solidcomStatus.lastSync.synced} ok
                          </span>
                          <span className="flex items-center gap-1.5 text-red-650 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/50">
                            <span className={`h-1.5 w-1.5 rounded-full bg-red-500 ${solidcomStatus.lastSync.errors > 0 ? 'animate-pulse' : ''}`} />
                            {solidcomStatus.lastSync.errors} err
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-bold">-</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Histórico recente</p>
                  <div className="rounded-xl border border-[#f1dbe3]">
                    <Table className="min-w-full text-sm">
                      <TableHeader className="bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)] text-xs text-gray-400">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Data</TableHead>
                          <TableHead>Produtos</TableHead>
                          <TableHead>Sincronizados</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {solidcomStatus.history.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="px-4 py-4 text-center text-gray-400">Nenhum registro de sincronização.</TableCell></TableRow>
                        ) : (
                          solidcomStatus.history.map((item) => (
                            <TableRow key={item.id} className="border-t border-[#f3e4ea] hover:bg-[#fffafc]">
                              <TableCell className="px-4 py-2 text-xs">{new Date(item.at).toLocaleString('pt-BR')}</TableCell>
                              <TableCell className="px-4 py-2">{item.products}</TableCell>
                              <TableCell className="px-4 py-2 font-medium text-emerald-700">{item.synced}</TableCell>
                              <TableCell className="px-4 py-2 text-red-500">{item.errors}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Não foi possível carregar o status da integração.</p>
            )}
          </div>
        )}
      </SectionPanel>

      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-[#5d082a] to-[#80103c] px-6 py-3.5 shadow-[0_12px_45px_rgba(93,8,42,0.45)] backdrop-blur-md">
            <div className="flex items-center gap-2 text-white">
              <Layers size={16} className="animate-pulse" />
              <span className="text-sm font-bold">{selectedIds.size} selecionado(s)</span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <Button
              type="button"
              onClick={clearSelection}
              variant="outline"
              size="sm"
              className="rounded-xl border-white/20 bg-transparent px-3 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Limpar
            </Button>
            <Button
              type="button"
              onClick={() => requestBulkStatusUpdate(true)}
              variant="ghost"
              size="sm"
              className="rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 hover:text-white"
            >
              Ativar
            </Button>
            <Button
              type="button"
              onClick={() => requestBulkStatusUpdate(false)}
              variant="ghost"
              size="sm"
              className="rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 hover:text-white"
            >
              Desativar
            </Button>
            <Button
              type="button"
              onClick={requestBulkDelete}
              variant="destructive"
              size="sm"
              className="rounded-xl border border-red-400/30 bg-red-500 px-3 text-xs font-bold text-white hover:bg-red-600"
            >
              <Trash2 size={12} className="inline mr-1" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {pendingActionCopy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2e2226]/40 px-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="product-action-confirm-title" className="w-full max-w-md rounded-2xl border border-[#ead7df] bg-white p-5 shadow-[0_24px_80px_rgba(46,34,38,0.25)]">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pendingActionCopy.destructive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {pendingActionCopy.destructive ? <Trash2 size={18} /> : <CheckSquare size={18} />}
              </div>
              <div>
                <h3 id="product-action-confirm-title" className="text-base font-black text-[#2e2226]">{pendingActionCopy.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{pendingActionCopy.description}</p>
              </div>
            </div>
            {productFeedback?.tone === 'error' && (
              <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {productFeedback.title}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingAction(null)} disabled={confirmingAction} className="rounded-xl border-[#ead7df]">
                Cancelar
              </Button>
              <Button type="button" variant={pendingActionCopy.destructive ? 'destructive' : 'default'} onClick={handleConfirmPendingAction} disabled={confirmingAction} className={pendingActionCopy.destructive ? 'rounded-xl bg-red-600 text-white hover:bg-red-700' : 'rounded-xl bg-[#5d082a] text-white hover:bg-[#4a0622]'}>
                {confirmingAction ? 'Processando...' : pendingActionCopy.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
