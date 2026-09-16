import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  productsAPI,
  integrationsAPI,
  getApiErrorMessage,
  type AdminProduct,
  type ProductPayload,
  type SolidcomStatusResponse,
  type MercadologicalTreeLevel1,
  type ProductAvailabilityMetricsResponse,
} from '../services/api'

export type ProductFormState = {
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
  manualIsFractional: boolean
  manualFractionStep: string
}

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>
export type ProductFeedback = {
  tone: 'success' | 'error'
  title: string
  description?: string
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  ean: '',
  name: '',
  titleMask: '',
  titleMaskShort: '',
  alternativeDescription: '',
  classification01: '',
  classification02: '',
  classification03: '',
  classification04: '',
  price: '',
  promotionalPrice: '',
  stock: '',
  unit: 'un',
  badges: '',
  origin: '',
  videoUrl: '',
  manualIsFractional: false,
  manualFractionStep: '',
}

const splitClassificationParts = (value?: string | null) =>
  (value || '')
    .split(/\s*[|｜]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)

const getClassificationPrimary = (value?: string | null) => {
  const parts = splitClassificationParts(value)
  if (parts.length === 0) return ''
  return parts[0]
}

const formatClassificationLabel = (value?: string | null) => {
  const normalizedValue = getClassificationPrimary(value) || value || ''
  const match = normalizedValue.match(/^(\d+)\s*-\s*(.+)$/)

  if (!match) return normalizedValue

  const [, code, label] = match
  return `${code} - ${label.trim()}`
}

export const formatClassificationOptionLabel = (value: string) => formatClassificationLabel(value)

export const formatClassificationPath = (values: Array<string | null | undefined>) =>
  values
    .map((value) => formatClassificationLabel(value))
    .filter(Boolean)
    .join(' > ')

type GroupedLevel4 = { value: string }
type GroupedLevel3 = { value: string; children: GroupedLevel4[] }
type GroupedLevel2 = { value: string; children: GroupedLevel3[] }
type GroupedLevel1 = { value: string; children: GroupedLevel2[] }

/**
 * Todo o estado e logica de negocio da aba Produtos do admin -- extraido de
 * AdminDashboard (JON-65, Auditoria 360) pra tirar o arquivo de 1147 linhas.
 * `activeSection` e `onMutated` (refresh de stats globais apos criar/editar/
 * excluir produto) vem de fora porque cruzam dominio com o resto do dashboard.
 */
export function useProductsAdmin(activeSection: string, onMutated: () => void) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsSearch, setProductsSearch] = useState('')
  // JON-31 (auditoria admin): a busca disparava 4 requisicoes por tecla e
  // reprocessava a arvore mercadologica inteira no onChange -- congelava o
  // navegador 30s+. Agora debounce de 350ms e a arvore/status/metricas saem
  // do efeito de busca (nao mudam com o texto).
  const [debouncedProductsSearch, setDebouncedProductsSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedProductsSearch(productsSearch), 350)
    return () => clearTimeout(id)
  }, [productsSearch])
  const [productsFilterOutOfStock, setProductsFilterOutOfStock] = useState(false)
  const [productsFilterInactive, setProductsFilterInactive] = useState(false)
  const [productsFilterUncategorized, setProductsFilterUncategorized] = useState(false)
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(1)
  const [mercadologicalTree, setMercadologicalTree] = useState<MercadologicalTreeLevel1[]>([])
  const [classification01Filter, setClassification01Filter] = useState('')
  const [classification02Filter, setClassification02Filter] = useState('')
  const [classification03Filter, setClassification03Filter] = useState('')
  const [classification04Filter, setClassification04Filter] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [syncingProducts, setSyncingProducts] = useState(false)
  const [syncingTaxonomy, setSyncingTaxonomy] = useState(false)
  const [solidcomStatus, setSolidcomStatus] = useState<SolidcomStatusResponse | null>(null)
  const [solidcomStatusLoading, setSolidcomStatusLoading] = useState(false)
  const [solidcomStatusExpanded, setSolidcomStatusExpanded] = useState(true)
  const [availabilityMetrics, setAvailabilityMetrics] = useState<ProductAvailabilityMetricsResponse | null>(null)
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM)
  const [productFormErrors, setProductFormErrors] = useState<ProductFormErrors>({})
  const [productFeedback, setProductFeedback] = useState<ProductFeedback | null>(null)

  const loadProducts = useCallback(async (
    page = 1,
    search = '',
    outOfStock = productsFilterOutOfStock,
    inactive = productsFilterInactive,
    uncategorized = productsFilterUncategorized
  ) => {
    try {
      setProductsLoading(true)
      setProductsError('')

      const response = await productsAPI.getAdmin({
        page,
        limit: 10,
        search: search || undefined,
        classification01: classification01Filter || undefined,
        classification02: classification02Filter || undefined,
        classification03: classification03Filter || undefined,
        classification04: classification04Filter || undefined,
        outOfStock: outOfStock || undefined,
        inactive: inactive || undefined,
        uncategorized: uncategorized || undefined,
      })

      setProducts(response.data.data)
      setProductsPage(response.data.page)
      setProductsTotalPages(response.data.totalPages)
    } catch (error: any) {
      setProductsError(getApiErrorMessage(error, 'Erro ao carregar produtos'))
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }, [classification01Filter, classification02Filter, classification03Filter, classification04Filter, productsFilterOutOfStock, productsFilterInactive, productsFilterUncategorized])

  const loadMercadologicalTree = useCallback(async () => {
    try {
      const response = await productsAPI.getMercadologicalTree()
      setMercadologicalTree(response.data.data || [])
    } catch {
      setMercadologicalTree([])
    }
  }, [])

  const loadSolidcomStatus = useCallback(async () => {
    try {
      setSolidcomStatusLoading(true)
      const response = await integrationsAPI.getSolidcomStatus()
      setSolidcomStatus(response.data)
    } catch {
      setSolidcomStatus(null)
    } finally {
      setSolidcomStatusLoading(false)
    }
  }, [])

  const loadAvailabilityMetrics = useCallback(async () => {
    try {
      const response = await productsAPI.getAvailabilityMetrics()
      setAvailabilityMetrics(response.data)
    } catch {
      setAvailabilityMetrics(null)
    }
  }, [])

  // Arvore mercadologica, status da integracao e metricas de disponibilidade:
  // NAO mudam com o texto da busca -- carregam uma vez ao entrar na secao.
  useEffect(() => {
    if (activeSection !== 'products') return
    loadSolidcomStatus()
    loadMercadologicalTree()
    loadAvailabilityMetrics()
  }, [activeSection, loadSolidcomStatus, loadMercadologicalTree, loadAvailabilityMetrics])

  // Lista de produtos: reage ao texto JA COM DEBOUNCE e aos filtros.
  useEffect(() => {
    if (activeSection !== 'products') return
    loadProducts(
      1,
      debouncedProductsSearch,
      productsFilterOutOfStock,
      productsFilterInactive,
      productsFilterUncategorized
    )
  }, [
    activeSection,
    loadProducts,
    debouncedProductsSearch,
    productsFilterOutOfStock,
    productsFilterInactive,
    productsFilterUncategorized
  ])

  const groupedMercadologicalTree = useMemo<GroupedLevel1[]>(() => {
    const level1Map = new Map<string, Map<string, Map<string, Set<string>>>>()

    const addPath = (values: Array<string | null | undefined>) => {
      const parts = values.flatMap((value) => splitClassificationParts(value)).filter(Boolean)
      const [level1, level2, level3, level4] = parts
      if (!level1) return

      if (!level1Map.has(level1)) {
        level1Map.set(level1, new Map<string, Map<string, Set<string>>>())
      }
      const level2Map = level1Map.get(level1)!

      if (!level2) return
      if (!level2Map.has(level2)) {
        level2Map.set(level2, new Map<string, Set<string>>())
      }
      const level3Map = level2Map.get(level2)!

      if (!level3) return
      if (!level3Map.has(level3)) {
        level3Map.set(level3, new Set<string>())
      }
      const level4Set = level3Map.get(level3)!

      if (level4) {
        level4Set.add(level4)
      }
    }

    for (const level1 of mercadologicalTree) {
      if (level1.children.length === 0) {
        addPath([level1.value])
        continue
      }

      for (const level2 of level1.children) {
        if (level2.children.length === 0) {
          addPath([level1.value, level2.value])
          continue
        }

        for (const level3 of level2.children) {
          if (level3.children.length === 0) {
            addPath([level1.value, level2.value, level3.value])
            continue
          }

          for (const level4 of level3.children) {
            addPath([level1.value, level2.value, level3.value, level4.value])
          }
        }
      }
    }

    return Array.from(level1Map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([level1, level2Map]) => ({
        value: level1,
        children: Array.from(level2Map.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([level2, level3Map]) => ({
            value: level2,
            children: Array.from(level3Map.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([level3, level4Set]) => ({
                value: level3,
                children: Array.from(level4Set.values())
                  .sort((a, b) => a.localeCompare(b))
                  .map((level4) => ({ value: level4 })),
              })),
          })),
      }))
  }, [mercadologicalTree])

  const level2Options = useMemo(() => {
    const level1 = groupedMercadologicalTree.find((item) => item.value === classification01Filter)
    return level1?.children || []
  }, [groupedMercadologicalTree, classification01Filter])

  const level3Options = useMemo(() => {
    const level2 = level2Options.find((item) => item.value === classification02Filter)
    return level2?.children || []
  }, [level2Options, classification02Filter])

  const level4Options = useMemo(() => {
    const level3 = level3Options.find((item) => item.value === classification03Filter)
    return level3?.children || []
  }, [level3Options, classification03Filter])

  const formLevel2Options = useMemo(() => {
    const level1 = mercadologicalTree.find((item) => item.value === productForm.classification01)
    return level1?.children || []
  }, [mercadologicalTree, productForm.classification01])

  const formLevel3Options = useMemo(() => {
    const level2 = formLevel2Options.find((item) => item.value === productForm.classification02)
    return level2?.children || []
  }, [formLevel2Options, productForm.classification02])

  const formLevel4Options = useMemo(() => {
    const level3 = formLevel3Options.find((item) => item.value === productForm.classification03)
    return level3?.children || []
  }, [formLevel3Options, productForm.classification03])

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setProductFormErrors({})
    setEditingProductId(null)
    setIsProductFormOpen(false)
  }

  const openCreateProductForm = () => {
    setProductFeedback(null)
    setEditingProductId(null)
    setProductForm(EMPTY_PRODUCT_FORM)
    setIsProductFormOpen(true)
  }

  const openEditProductForm = (product: AdminProduct) => {
    setProductFeedback(null)
    setEditingProductId(product.id)
    setProductForm({
      ean: product.ean || '',
      name: product.name || '',
      titleMask: product.titleMask || '',
      titleMaskShort: product.titleMaskShort || '',
      alternativeDescription: product.alternativeDescription || '',
      classification01: product.classification01 || '',
      classification02: product.classification02 || '',
      classification03: product.classification03 || '',
      classification04: product.classification04 || '',
      price: String(product.price ?? ''),
      promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : '',
      stock: product.stock != null ? String(product.stock) : '',
      unit: product.unit || 'un',
      badges: product.badges || '',
      origin: product.origin || '',
      videoUrl: product.videoUrl || '',
      manualIsFractional: Boolean(product.manualIsFractional),
      manualFractionStep: product.manualFractionStep != null ? String(product.manualFractionStep) : '',
    })
    setIsProductFormOpen(true)
  }

  const buildProductPayload = (): ProductPayload => {
    if (editingProductId) {
      const payload: Partial<ProductPayload> = {}
      payload.titleMask = productForm.titleMask.trim() || null
      payload.titleMaskShort = productForm.titleMaskShort.trim() || null
      payload.videoUrl = productForm.videoUrl.trim() || null
      payload.badges = productForm.badges.trim() || null
      payload.promotionalPrice = productForm.promotionalPrice.trim() ? Number(productForm.promotionalPrice) : null
      payload.manualIsFractional = productForm.manualIsFractional
      payload.manualFractionStep = productForm.manualIsFractional && productForm.manualFractionStep.trim()
        ? Number(productForm.manualFractionStep)
        : null
      return payload as ProductPayload
    }

    const payload: ProductPayload = {
      ean: productForm.ean.trim(),
      name: productForm.name.trim(),
      price: Number(productForm.price),
      unit: productForm.unit.trim() || 'un',
    }

    if (productForm.alternativeDescription.trim()) {
      payload.alternativeDescription = productForm.alternativeDescription.trim()
    }
    if (productForm.promotionalPrice.trim()) {
      payload.promotionalPrice = Number(productForm.promotionalPrice)
    }
    if (productForm.stock.trim()) {
      payload.stock = Number(productForm.stock)
    }
    if (productForm.badges.trim()) {
      payload.badges = productForm.badges.trim()
    }
    if (productForm.origin.trim()) {
      payload.origin = productForm.origin.trim()
    }
    if (productForm.classification01.trim()) {
      payload.classification01 = productForm.classification01.trim()
    }
    if (productForm.classification02.trim()) {
      payload.classification02 = productForm.classification02.trim()
    }
    if (productForm.classification03.trim()) {
      payload.classification03 = productForm.classification03.trim()
    }
    if (productForm.classification04.trim()) {
      payload.classification04 = productForm.classification04.trim()
    }

    return payload as ProductPayload
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setProductFeedback(null)

    const errors: ProductFormErrors = {}
    if (!editingProductId) {
      if (!productForm.ean.trim()) errors.ean = 'EAN obrigatorio'
      if (!productForm.name.trim()) errors.name = 'Nome obrigatorio'
      if (!productForm.price.trim()) {
        errors.price = 'Preco obrigatorio'
      } else if (Number(productForm.price) <= 0) {
        errors.price = 'Preco deve ser maior que zero'
      }
    }

    setProductFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    try {
      setSavingProduct(true)
      const payload = buildProductPayload()

      if (editingProductId) {
        await productsAPI.update(editingProductId, payload)
      } else {
        await productsAPI.createAdmin(payload)
      }

      resetProductForm()
      await loadProducts(productsPage, productsSearch)
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao salvar produto'),
      })
    } finally {
      setSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    try {
      setProductFeedback(null)
      await productsAPI.delete(id)
      await loadProducts(productsPage, productsSearch)
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao remover produto'),
      })
      throw error
    }
  }

  const handleBulkUpdateStatus = async (ids: string[], active: boolean) => {
    try {
      setProductFeedback(null)
      await productsAPI.bulkUpdateStatus(ids, active)
      await loadProducts(productsPage, productsSearch)
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar produtos em lote'),
      })
      throw error
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    try {
      setProductFeedback(null)
      await productsAPI.bulkDelete(ids)
      await loadProducts(1, productsSearch)
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao excluir produtos em lote'),
      })
      throw error
    }
  }

  const handleUpdateProductFields = async (id: string, updates: any) => {
    try {
      setProductFeedback(null)
      await productsAPI.update(id, updates)
      await loadProducts(productsPage, productsSearch)
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao atualizar campo do produto'),
      })
      throw error
    }
  }

  // Sync completo do catalogo leva ~190s -- rodar sincrono via HTTP
  // request/response estourava timeout 504 do Nginx. Dispara em background
  // e faz polling do status ate terminar, sem travar o navegador.
  const handleSyncProducts = async () => {
    try {
      setProductFeedback(null)
      const { data } = await productsAPI.syncBackground()
      if (data.alreadyRunning) {
        setProductFeedback({ tone: 'success', title: 'Sincronizacao ja estava em andamento -- aguardando terminar.' })
      } else {
        setProductFeedback({ tone: 'success', title: 'Sincronizacao iniciada em segundo plano...' })
      }
      setSyncingProducts(true)

      const poll = async () => {
        const status = await productsAPI.syncStatus()
        if (status.data.running) {
          window.setTimeout(poll, 3000)
          return
        }

        setSyncingProducts(false)
        if (status.data.lastError) {
          setProductFeedback({ tone: 'error', title: `Erro na sincronizacao: ${status.data.lastError}` })
          return
        }

        const result = status.data.lastResult as any
        const taxonomy = result?.taxonomy
        if (taxonomy) {
          setProductFeedback({
            tone: 'success',
            title: 'Sincronizacao concluida',
            description: `Produtos sincronizados: ${result?.synced ?? 0}; erros: ${result?.errors ?? 0}; produtos processados: ${taxonomy.productsProcessed}; produtos recategorizados: ${taxonomy.productsRecategorized}; categorias detectadas: ${taxonomy.categoriesDetected}; categorias criadas: ${taxonomy.categoriesCreated}; raizes mercadologicas: ${taxonomy.mercadologicalRoots}.`,
          })
        } else {
          setProductFeedback({ tone: 'success', title: result?.message || 'Sincronizacao concluida' })
        }

        await loadProducts(productsPage, productsSearch)
        await loadSolidcomStatus()
        await loadMercadologicalTree()
        await onMutated()
        await loadAvailabilityMetrics()
      }

      window.setTimeout(poll, 3000)
    } catch (error: any) {
      setSyncingProducts(false)
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao iniciar sincronizacao'),
      })
    }
  }

  const handleSyncTaxonomy = async () => {
    try {
      setProductFeedback(null)
      setSyncingTaxonomy(true)
      const response = await productsAPI.syncTaxonomy()
      const result = response.data
      setProductFeedback({
        tone: 'success',
        title: 'Taxonomia atualizada',
        description: `Produtos processados: ${result.productsProcessed}; produtos recategorizados: ${result.productsRecategorized}; mantidos por categoria de cadastro: ${result.productsKeptByRegisteredCategory ?? 0}; inferidos por classificacao: ${result.productsInferredFromClassification ?? 0}; categorias detectadas: ${result.categoriesDetected}; categorias criadas: ${result.categoriesCreated}; categorias atualizadas: ${result.categoriesUpdated ?? 0}; categorias semeadas para futuro: ${result.categoriesSeededForFuture ?? 0}; raizes mercadologicas: ${result.mercadologicalRoots}.`,
      })

      await loadProducts(1, productsSearch)
      await loadMercadologicalTree()
      await onMutated()
      await loadAvailabilityMetrics()
    } catch (error: any) {
      setProductFeedback({
        tone: 'error',
        title: getApiErrorMessage(error, 'Erro ao sincronizar taxonomia'),
      })
    } finally {
      setSyncingTaxonomy(false)
    }
  }

  return {
    products, productsLoading, productsError, productsSearch, setProductsSearch,
    productsFilterOutOfStock, setProductsFilterOutOfStock,
    productsFilterInactive, setProductsFilterInactive,
    productsFilterUncategorized, setProductsFilterUncategorized,
    productsPage, setProductsPage, productsTotalPages,
    mercadologicalTree,
    classification01Filter, setClassification01Filter,
    classification02Filter, setClassification02Filter,
    classification03Filter, setClassification03Filter,
    classification04Filter, setClassification04Filter,
    savingProduct, syncingProducts, syncingTaxonomy,
    solidcomStatus, solidcomStatusLoading, solidcomStatusExpanded, setSolidcomStatusExpanded,
    availabilityMetrics,
    isProductFormOpen, editingProductId, productForm, setProductForm, productFormErrors, productFeedback, setProductFeedback,
    loadProducts, loadSolidcomStatus,
    groupedMercadologicalTree, level2Options, level3Options, level4Options,
    formLevel2Options, formLevel3Options, formLevel4Options,
    resetProductForm, openCreateProductForm, openEditProductForm,
    handleSaveProduct, handleDeleteProduct, handleBulkUpdateStatus, handleBulkDelete, handleUpdateProductFields,
    handleSyncProducts, handleSyncTaxonomy,
  }
}
