import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useInfiniteProducts, useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useBrand } from '../hooks/useBrand'
import { useCommercialTaxonomy, useStoreBanners } from '../hooks/useCMS'
import {
  CATEGORY_ICONS,
  CMS_CATEGORY_TO_RULE_ID,
  HOME_CATEGORY_RULES,
  HOME_COMMERCIAL_PRIORITY,
  getCategoryHref,
  findCategoryBanner,
  resolveBannerLink,
  normalizeCategoryCode,
  toCategoryUrlParam,
} from '../utils/homeCategories'
import { PromoBanner } from '../components/PromoBanner'
import { productsAPI, resolveApiUrl } from '../services/api'
import { formatPrice, formatProductTitle } from '../utils/format'
import { trackEvent } from '../utils/analytics'
import { Search, ShoppingCart, ArrowLeft, Loader2, User, SlidersHorizontal, X, ScanLine, Check, Clock, MessageCircle, Tag, ChevronDown } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'
import { productPath } from '../utils/productUrl'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { BackToTopButton } from '../components/BackToTopButton'
import { Footer } from '../components/Footer'
import { useDragScroll } from '../hooks/useDragScroll'
import { SEO } from '../components/SEO'
import { SkeletonCard } from '../components/Skeleton'
import type { Product } from '../types'
import { StoreProductCard } from '../components/StoreProductCard'
import { buttonVariants } from '../components/ui/button'
import { cn } from '../lib/cn'
import { DesktopNavLinks } from '../components/DesktopNavLinks'

// Mercado refeito em 07/10/2026 (revisao de UI/UX do storefront, padrao dos
// apps lideres de supermercado, celular primeiro):
// - sem busca: buscas recentes, grade de departamentos e buscas populares;
// - com busca/departamento: titulo claro, secoes do departamento (Bovinos,
//   Aves...), ordenar e filtrar numa folha que sobe de baixo, filtros ativos
//   como chips que se tiram com um toque;
// - busca sem resultado: o que tentar e o WhatsApp da loja.

interface PaginatedProducts {
  data: Product[]
  page: number
  limit: number
  total: number
  hasNextPage: boolean
}

// 29/09/2026: 4 dos 5 atalhos antigos ("ofertas da semana", "frescos para
// hoje", "frango para churrasco", "carne moida") buscavam texto que nao casa
// com nenhum produto e davam tela vazia. Atalho de intencao agora e LINK
// (promocoes, categoria); os de busca sao termos conferidos contra o catalogo.
const QUICK_LINKS: Array<{ label: string; to?: string; query?: string }> = [
  { label: 'Ofertas da semana', to: '/promocoes' },
  { label: 'Pão francês', query: 'pão francês' },
  { label: 'Leite', query: 'leite' },
  { label: 'Picanha', query: 'picanha' },
  { label: 'Cerveja', query: 'cerveja' },
  { label: 'Queijo', query: 'queijo' },
  { label: 'Café', query: 'café' },
  { label: 'Banana', query: 'banana' },
]

const PRICE_FILTERS = [
  { key: 'up-to-20', label: 'Até R$ 20', maxPrice: 20 },
  { key: 'up-to-30', label: 'Até R$ 30', maxPrice: 30 },
  { key: '30-to-60', label: 'R$ 30 a R$ 60', minPrice: 30, maxPrice: 60 },
  { key: '60-plus', label: 'Acima de R$ 60', minPrice: 60 },
] as Array<{ key: string; label: string; minPrice?: number; maxPrice?: number }>

const SORTS = [
  { key: '', label: 'Recomendados' },
  { key: 'menor-preco', label: 'Menor preço' },
  { key: 'maior-preco', label: 'Maior preço' },
  { key: 'desconto', label: 'Maiores descontos' },
  { key: 'az', label: 'Nome (A–Z)' },
]

// Missoes e vitrines que chegam pelo "Ver tudo" (?tag=): titulo em vez do slug.
const TAG_LABELS: Record<string, string> = {
  churrasco: 'Churrasco',
  'churrasco-nobre': 'Churrasco nobre',
  'queijos-e-vinhos': 'Queijos & vinhos',
  'boteco-em-casa': 'Boteco em casa',
  'cafe-da-manha': 'Café da manhã',
  'lanche-rapido': 'Lanche rápido',
  sobremesa: 'Hora da sobremesa',
  'linha-economica': 'Linha econômica',
  'linha-premium': 'Linha premium',
  'diet-light': 'Diet & light',
  integral: 'Integrais',
  'fitness-proteina': 'Fitness & proteína',
  'zero-lactose': 'Zero lactose',
}
const tagLabel = (tag: string) => TAG_LABELS[tag] || tag.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())

const QUERY_TERM_ALIASES: Record<string, string> = {
  refigerante: 'refrigerante',
  refrijerante: 'refrigerante',
  refri: 'refrigerante',
  bolacha: 'biscoito',
  bixcoito: 'biscoito',
  biscoto: 'biscoito',
  macarao: 'macarrao',
  mucarela: 'mussarela',
  mozarela: 'mussarela',
  acougue: 'açougue',
  acogue: 'açougue',
  acucar: 'açúcar',
  assucar: 'açúcar',
  agua: 'água',
}

const normalizeSearchText = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => QUERY_TERM_ALIASES[token.trim().toLowerCase()] || token)
    .join(' ')
    .trim()

// Buscas recentes: conveniencia deste aparelho (localStorage pode faltar em
// aba anonima -- tudo em try/catch, a pagina funciona sem).
const RECENT_KEY = 'aef-buscas-recentes'
const readRecent = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}
const writeRecent = (list: string[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)))
  } catch {
    /* sem armazenamento: so nao lembra */
  }
}

const chip = (active: boolean) =>
  cn(
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
    active ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#E8D7B0] bg-white text-[#231F20] hover:border-[#D2BB8A] hover:bg-[#FBF7F0]',
  )

export default function MercadoPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { count, total: cartTotal } = useCart()
  const { user } = useAuth()
  const brand = useBrand()
  const categoriesScroll = useDragScroll<HTMLDivElement>()
  const sectionsScroll = useDragScroll<HTMLDivElement>()
  const landingDeptScroll = useDragScroll<HTMLDivElement>()
  const toolbarScroll = useDragScroll<HTMLDivElement>()
  const { data: categoriesCMS } = useCommercialTaxonomy()
  const navigate = useNavigate()

  const q = searchParams.get('q') || ''
  const catParam = searchParams.get('cat') || ''
  const cat = normalizeCategoryCode(catParam)
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
  const classification01 = searchParams.get('classification01') || ''
  const classification02 = searchParams.get('classification02') || ''
  const classification03 = searchParams.get('classification03') || ''
  const classification04 = searchParams.get('classification04') || ''
  const tag = searchParams.get('tag') || ''
  const sort = searchParams.get('ordem') || ''
  const onSale = searchParams.get('ofertas') === '1'
  const section = searchParams.get('secao') || ''

  /** Troca so as chaves passadas na URL (undefined/'' remove). */
  const updateParams = useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  // Banner de topo da categoria (StoreBanner slot=category). So quando a
  // pagina esta navegando uma categoria: com termo de busca (`q`) ela vira
  // "resultados para X" e o banner empurraria os resultados pra baixo.
  const { data: storeBanners } = useStoreBanners()
  const categoryBanner = useMemo(
    () => (q || section ? undefined : findCategoryBanner(storeBanners, cat)),
    [storeBanners, cat, q, section],
  )

  const [inputValue, setInputValue] = useState(q)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const sentinelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const trackedSearchRef = useRef('')
  const prevFiltersRef = useRef<string>('')

  // Sincroniza o campo com o ?q= ao navegar e lembra a busca feita.
  useEffect(() => {
    setInputValue(q)
    setIsInputFocused(false)
    const term = q.trim()
    if (!term) return
    setRecent((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 6)
      writeRecent(next)
      return next
    })
  }, [q])

  // Filtro mudou: volta ao topo da lista.
  useEffect(() => {
    const filterKey = `${cat}|${tag}|${section}|${sort}|${onSale}|${minPrice}|${maxPrice}|${classification01}|${classification02}|${classification03}|${classification04}`
    if (prevFiltersRef.current !== '' && prevFiltersRef.current !== filterKey) window.scrollTo({ top: 0, behavior: 'smooth' })
    prevFiltersRef.current = filterKey
  }, [cat, tag, section, sort, onSale, minPrice, maxPrice, classification01, classification02, classification03, classification04])

  useEffect(() => {
    const value = inputValue.trim()
    if (value.length < 2 || value === q) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setIsSuggesting(true)
        const response = await productsAPI.suggest(value, 6)
        // Dedup: o ERP tem SKUs distintos com nome identico, e o nome e a key.
        if (!cancelled) setSuggestions([...new Set((response.data?.data || []) as string[])])
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setIsSuggesting(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [inputValue, q])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) setIsInputFocused(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteProducts(
    q || undefined,
    cat || undefined,
    minPrice,
    maxPrice,
    classification01 || undefined,
    classification02 || undefined,
    classification03 || undefined,
    classification04 || undefined,
    tag || undefined,
    { sort: sort || undefined, onSale, section: section || undefined },
  )

  const allProducts = data?.pages.flatMap((p) => (p as PaginatedProducts).data) ?? []
  const total = (data?.pages[0] as PaginatedProducts | undefined)?.total ?? 0

  const { data: sections = [] } = useQuery({
    queryKey: ['product-sections', cat],
    queryFn: async () => (await productsAPI.getSections(cat)).data,
    enabled: Boolean(cat) && !q,
    staleTime: 5 * 60 * 1000,
  })
  // Secao com 1 produto so (cadastro fora do lugar) nao vira chip.
  const sectionChips = sections.filter((s) => s.count >= 2)

  useEffect(() => {
    const query = q.trim()
    if (!query || isLoading) return
    const normalizedQuery = normalizeSearchText(query)
    const corrected = normalizedQuery.toLowerCase() !== query.toLowerCase()
    const key = `${query}|${cat}|${total}`
    if (trackedSearchRef.current === key) return
    trackedSearchRef.current = key
    trackEvent('SEARCH', 'PRODUCT', undefined, {
      query,
      category: cat || null,
      minPrice: minPrice ?? null,
      maxPrice: maxPrice ?? null,
      resultCount: total,
      originalQuery: query,
      normalizedQuery,
      corrected,
      correctedFrom: corrected ? query : null,
      correctedTo: corrected ? normalizedQuery : null,
      source: 'search_page',
    })
  }, [q, cat, minPrice, maxPrice, total, isLoading])

  // Rolagem infinita
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Busca pelo codigo de barras lido com a camera: um produto so -> abre a
  // pagina dele; mais de um (ou nenhum) -> mostra o resultado da busca.
  const [scannerOpen, setScannerOpen] = useState(() => searchParams.get('scan') === '1')
  // Botao de camera da home chega com ?scan=1: abre o leitor e limpa o parametro.
  useEffect(() => {
    if (searchParams.get('scan') !== '1') return
    const next = new URLSearchParams(searchParams)
    next.delete('scan')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const handleBarcode = useCallback(async (code: string) => {
    setScannerOpen(false)
    const ean = code.replace(/\D/g, '')
    if (!ean) return
    try {
      const { data } = await productsAPI.getAll(ean, 1, 2)
      const found = (data?.data || data || []) as Product[]
      if (found.length === 1) return navigate(productPath(found[0]))
    } catch { /* cai na busca normal */ }
    setInputValue(ean)
    setSearchParams({ q: ean })
  }, [navigate, setSearchParams])

  /** Busca por texto: mantem departamento e filtros, sai da secao. */
  const runSearch = (term: string, source: 'search_page' | 'suggestion_click' | 'recent' | 'popular') => {
    const value = term.trim()
    if (source !== 'search_page' && value) {
      const typed = inputValue.trim()
      const normalizedQuery = normalizeSearchText(value)
      const normalizedTyped = typed ? normalizeSearchText(typed) : ''
      const corrected = Boolean(typed) && normalizedTyped.toLowerCase() !== typed.toLowerCase()
      trackEvent('SEARCH', 'PRODUCT', undefined, {
        query: value,
        category: cat || null,
        minPrice: minPrice ?? null,
        maxPrice: maxPrice ?? null,
        originalQuery: typed || value,
        normalizedQuery,
        corrected,
        correctedFrom: corrected ? typed : null,
        correctedTo: corrected ? normalizedTyped : null,
        source,
        usedSuggestion: source === 'suggestion_click',
      })
    }
    setInputValue(value)
    setIsInputFocused(false)
    inputRef.current?.blur()
    updateParams({ q: value || undefined, secao: undefined })
  }

  const setCategory = (code: string) => {
    setInputValue('')
    // Departamento novo: tira a busca e a secao do anterior; ordem e filtros ficam.
    updateParams({ cat: code ? toCategoryUrlParam(code) : undefined, q: undefined, secao: undefined, tag: undefined })
  }

  // Barra de departamentos: exclusivamente as categorias comerciais oficiais
  // (mesma fonte da Home), nunca as classificacoes brutas do ERP.
  const departments = useMemo(() => {
    const raw = Array.isArray(categoriesCMS) ? categoriesCMS : []
    const seen = new Set<string>()
    return raw
      .filter((item: any) => item?.active !== false)
      .map((item: any) => {
        const code = normalizeCategoryCode(String(item?.code || item?.name || ''))
        const ruleId = CMS_CATEGORY_TO_RULE_ID[code]
        const rule = ruleId ? HOME_CATEGORY_RULES.find((r) => r.id === ruleId) : undefined
        if (!rule) return null
        return {
          id: rule.id,
          key: code,
          label: String(item?.shortName || '').trim() || rule.shortLabel,
          fullLabel: rule.label,
          priority: item?.priority ?? HOME_COMMERCIAL_PRIORITY[rule.id] ?? 999,
        }
      })
      .filter((item): item is { id: string; key: string; label: string; fullLabel: string; priority: number } => Boolean(item))
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      .sort((a, b) => a.priority - b.priority)
  }, [categoriesCMS])

  const openDepartment = (dept: { id: string; key: string }) => {
    const href = getCategoryHref({ id: dept.id, code: dept.key })
    if (href.startsWith('/adega')) return navigate(href)
    setCategory(dept.key)
  }

  const department = departments.find((d) => d.key === cat)
  const priceFilter = PRICE_FILTERS.find((f) => f.minPrice === minPrice && f.maxPrice === maxPrice)
  const hasPrice = typeof minPrice === 'number' || typeof maxPrice === 'number'
  const sortLabel = SORTS.find((s) => s.key === sort)?.label || 'Recomendados'
  const refineCount = [Boolean(sort), onSale, hasPrice].filter(Boolean).length
  const isLanding = !q && !cat && !tag && !section && !onSale && !hasPrice && !sort && !classification01 && !classification02 && !classification03 && !classification04
  const hasLegacyClassification = Boolean(classification01 || classification02 || classification03 || classification04)

  const title = q
    ? `Resultados para “${q}”`
    : tag
      ? tagLabel(tag)
      : department
        ? department.fullLabel
        : onSale
          ? 'Ofertas'
          : 'Todos os produtos'

  const clearAll = () => {
    setInputValue('')
    setSearchParams({})
    setIsInputFocused(false)
    inputRef.current?.blur()
  }

  const whatsappDigits = (brand.contactWhatsapp || '').replace(/\D/g, '')
  const whatsappAskUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Procurei "${q}" no site e não achei. Vocês têm?`)}`
    : null

  const showDropdown = isInputFocused && (suggestions.length > 0 || (!inputValue.trim() && recent.length > 0))

  return (
    <div className="min-h-screen bg-[#FBFAF7]">
      <SEO
        title={q ? `${q} — Mercado` : department ? `${department.fullLabel} — Mercado` : tag ? `${tagLabel(tag)} — Mercado` : 'Mercado'}
        description={
          q
            ? `Resultados para "${q}" no Mercado Antenor & Filhos. Carnes, vinhos, padaria e muito mais.`
            : 'Encontre rapidinho o que você precisa na Antenor & Filhos, com ofertas, carnes, vinhos e muito mais.'
        }
        canonical="/mercado"
        noindex={!isLanding}
      />

      <header className="sticky top-0 z-50 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-2 py-2.5 sm:px-4">
          <button type="button" onClick={() => navigate('/')} aria-label="Voltar ao início" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </button>

          <div ref={suggestionsRef} className="relative min-w-0 flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                runSearch(inputValue, 'search_page')
              }}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#E8D7B0] bg-[#FBF7F0] px-3.5 transition-colors focus-within:border-[#D2BB8A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#D2BB8A]/40"
            >
              <Search size={18} className="shrink-0 text-[#5d4f33]" />
              <input
                ref={inputRef}
                type="search"
                // So abre o teclado sozinho quando a pessoa veio para buscar
                // (aba Buscar); vindo de um departamento ele cobria a lista.
                autoFocus={isLanding}
                value={inputValue}
                enterKeyHint="search"
                onFocus={() => setIsInputFocused(true)}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setIsInputFocused(true)
                }}
                placeholder="Buscar no mercado"
                aria-label="Buscar produtos"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-[#231F20] outline-none placeholder:text-[#6B7280] [&::-webkit-search-cancel-button]:hidden"
              />
              {isSuggesting && <Loader2 size={14} className="animate-spin text-[#5D082A]" />}
              {inputValue ? (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('')
                    setSuggestions([])
                    if (q) updateParams({ q: undefined })
                    inputRef.current?.focus()
                  }}
                  aria-label="Limpar busca"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
                >
                  <X size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  aria-label="Buscar pelo código de barras (câmera)"
                  title="Ler código de barras"
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-[#5D082A]"
                >
                  <ScanLine size={19} />
                </button>
              )}
            </form>

            {showDropdown && (
              <div className="absolute left-0 right-0 top-[50px] z-50 overflow-hidden rounded-2xl border border-[#E8D7B0]/70 bg-white shadow-xl">
                {inputValue.trim()
                  ? suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(formatProductTitle(suggestion), 'suggestion_click')}
                        className="flex w-full items-center gap-3 border-b border-[#f1e8d6] px-4 py-3 text-left text-sm text-[#231F20] last:border-b-0 hover:bg-[#FBF7F0]"
                      >
                        <Search size={15} className="shrink-0 text-gray-400" />
                        <span className="line-clamp-1">{formatProductTitle(suggestion)}</span>
                      </button>
                    ))
                  : recent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(term, 'recent')}
                        className="flex w-full items-center gap-3 border-b border-[#f1e8d6] px-4 py-3 text-left text-sm text-[#231F20] last:border-b-0 hover:bg-[#FBF7F0]"
                      >
                        <Clock size={15} className="shrink-0 text-gray-400" />
                        <span className="line-clamp-1">{term}</span>
                      </button>
                    ))}
              </div>
            )}
          </div>

          <DesktopNavLinks tone="light" />

          <Link
            to="/cart"
            aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]"
          >
            <ShoppingCart size={22} aria-hidden="true" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5D082A] px-1 text-[10px] font-bold text-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          {user && <NotificationBell />}

          <Link to={user ? '/account' : '/login'} className="hidden shrink-0 items-center gap-1 rounded-full p-1 hover:bg-black/5 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D2BB8A]/40 bg-[#D2BB8A]/20">
              <User size={16} className="text-[#5D082A]" />
            </span>
            <span className="pr-1 text-xs font-semibold text-[#231F20]">{user?.name?.split(' ')[0] || 'Entrar'}</span>
          </Link>
        </div>

        {/* Departamentos: so fora da tela inicial (la eles sao a grade). */}
        {!isLanding && departments.length > 0 && (
          <div ref={categoriesScroll.ref} className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-2.5" {...categoriesScroll.dragProps}>
            <button type="button" onClick={() => setCategory('')} className={chip(!cat)}>Todos</button>
            {departments.map((dept) => (
              <button key={dept.key} type="button" onClick={() => openDepartment(dept)} className={chip(cat === dept.key)}>
                {dept.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {scannerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setScannerOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-semibold text-[#231F20]">Aponte a câmera para o código de barras do produto</p>
            <BarcodeScanner onResult={handleBarcode} onClose={() => setScannerOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-6 pt-4">
        {isLanding ? (
          <div className="space-y-6">
            {recent.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#231F20]">Buscas recentes</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setRecent([])
                      writeRecent([])
                    }}
                    className="text-xs font-semibold text-[#5D082A]"
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((term) => (
                    <button key={term} type="button" onClick={() => runSearch(term, 'recent')} className={chip(false)}>
                      <Clock size={14} className="text-gray-400" /> {term}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-base font-bold text-[#231F20]">Departamentos</h2>
              {/* 08/10/2026: no celular, uma linha que desliza (a grade de 5 linhas tomava a tela inteira); no computador, grade. */}
              <div
                ref={landingDeptScroll.ref}
                className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [overflow-anchor:none] lg:mx-0 lg:grid lg:grid-cols-9 lg:overflow-visible lg:px-0 lg:pb-0"
                {...landingDeptScroll.dragProps}
              >
                {departments.map((dept) => {
                  const Icon = CATEGORY_ICONS[dept.id] || CATEGORY_ICONS.default
                  return (
                    <button
                      key={dept.key}
                      type="button"
                      onClick={() => openDepartment(dept)}
                      className="flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border border-[#EFE6D2] bg-white px-1 py-3 text-center transition-colors hover:border-[#D2BB8A] active:scale-[0.98] lg:w-auto"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F2E6] text-[#5D082A]">
                        <Icon size={21} strokeWidth={1.8} />
                      </span>
                      <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#231F20]">{dept.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-2.5 text-base font-bold text-[#231F20]">Buscas populares</h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_LINKS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => (item.to ? navigate(item.to) : runSearch(item.query!, 'popular'))}
                    className={chip(false)}
                  >
                    {item.to ? <Tag size={14} className="text-[#5D082A]" /> : <Search size={14} className="text-gray-400" />} {item.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-end justify-between gap-3 pt-1">
              <div>
                <h2 className="text-lg font-bold text-[#231F20]">Todos os produtos</h2>
                {!isLoading && <p className="text-xs text-gray-500">{total} produtos</p>}
              </div>
              <button type="button" onClick={() => setSheetOpen(true)} className={chip(false)}>
                <SlidersHorizontal size={14} /> Ordenar e filtrar
              </button>
            </div>
          </div>
        ) : (
          <>
            {categoryBanner && (
              <div className="mb-4">
                <PromoBanner
                  bannerId={categoryBanner.id}
                  image={resolveApiUrl(categoryBanner.desktopImageUrl)}
                  alt={categoryBanner.title || categoryBanner.name || 'Destaque da categoria'}
                  badge={categoryBanner.badgeText || undefined}
                  title={categoryBanner.title || categoryBanner.name || 'Destaque'}
                  description={categoryBanner.description || undefined}
                  ctaLabel={categoryBanner.ctaLabel || undefined}
                  ctaTo={resolveBannerLink(categoryBanner.linkValue, categoryBanner.linkType)}
                  align={categoryBanner.align || 'left'}
                  overlayColor={categoryBanner.overlayColor || undefined}
                  sponsorName={categoryBanner.sponsorName || undefined}
                />
              </div>
            )}

            <div className="mb-3">
              <h1 className="text-xl font-bold leading-tight text-[#231F20] sm:text-2xl">{title}</h1>
              {!isLoading && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {total} {total === 1 ? 'produto' : 'produtos'}
                  {q && department ? ` em ${department.fullLabel}` : ''}
                </p>
              )}
            </div>

            {/* Secoes do departamento (Bovinos, Aves...): o que o cliente procura dentro do Acougue. */}
            {sectionChips.length >= 2 && (
              <div ref={sectionsScroll.ref} className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4" {...sectionsScroll.dragProps}>
                <button type="button" onClick={() => updateParams({ secao: undefined })} className={chip(!section)}>Tudo</button>
                {sectionChips.map((s) => (
                  <button key={s.name} type="button" onClick={() => updateParams({ secao: s.name })} className={chip(section === s.name)}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Ordenar e filtros ativos: um toque tira cada um. */}
            <div ref={toolbarScroll.ref} className="no-scrollbar -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4" {...toolbarScroll.dragProps}>
              <button type="button" onClick={() => setSheetOpen(true)} className={chip(refineCount > 0)}>
                <SlidersHorizontal size={14} /> {refineCount > 0 ? `Filtros · ${refineCount}` : 'Filtrar'}
              </button>
              <button type="button" onClick={() => setSheetOpen(true)} className={chip(false)}>
                {sortLabel} <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => updateParams({ ofertas: onSale ? undefined : '1' })} className={chip(onSale)}>
                {onSale && <Check size={14} />} Só ofertas
              </button>
              {hasPrice && (
                <button type="button" onClick={() => updateParams({ minPrice: undefined, maxPrice: undefined })} className={chip(true)}>
                  {priceFilter?.label || 'Preço'} <X size={14} />
                </button>
              )}
              {hasLegacyClassification && (
                <button type="button" onClick={() => updateParams({ classification01: undefined, classification02: undefined, classification03: undefined, classification04: undefined })} className={chip(true)}>
                  Seleção <X size={14} />
                </button>
              )}
              {(refineCount > 0 || section || hasLegacyClassification) && (
                <button type="button" onClick={() => updateParams({ ordem: undefined, ofertas: undefined, minPrice: undefined, maxPrice: undefined, secao: undefined, classification01: undefined, classification02: undefined, classification03: undefined, classification04: undefined })} className="shrink-0 px-2 text-xs font-semibold text-[#5D082A] underline underline-offset-2">
                  Limpar
                </button>
              )}
            </div>
          </>
        )}

        {/* Grade de produtos */}
        <div className={isLanding ? 'mt-3' : ''}>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              <SkeletonCard count={10} />
            </div>
          ) : allProducts.length === 0 ? (
            <div className="mx-auto max-w-md py-14 text-center text-[#5D4F33]">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F8F2E6] text-[#8a6a3a]">
                <Search size={28} />
              </span>
              <p className="text-base font-bold text-[#231F20]">{q ? `Não achamos “${q}”` : 'Nenhum produto com esses filtros'}</p>
              <p className="mt-1 text-sm">
                {q ? 'Confira a grafia ou tente uma palavra mais simples, como “queijo” ou “arroz”.' : 'Tire algum filtro para ver mais produtos.'}
              </p>
              <div className="mt-5 flex flex-col items-center gap-2.5">
                {(refineCount > 0 || section || cat || tag) && (
                  <button type="button" onClick={clearAll} className={buttonVariants({ variant: 'outline', size: 'md' })}>
                    Tirar os filtros
                  </button>
                )}
                {q && whatsappAskUrl && (
                  <a href={whatsappAskUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 text-sm font-semibold text-[#0d5c36]">
                    <MessageCircle size={16} /> Não achou? Pergunte no WhatsApp
                  </a>
                )}
                <Link to="/promocoes" className="text-sm font-semibold text-[#5D082A] underline underline-offset-2">
                  Ver ofertas da semana
                </Link>
              </div>
              {q && (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a6a3a]">Mais procurados</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_LINKS.filter((item) => item.query).map((item) => (
                      <button key={item.label} type="button" onClick={() => runSearch(item.query!, 'popular')} className={chip(false)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {allProducts.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    source="SEARCH"
                    variant="grid"
                    analyticsMeta={{
                      query: q || null,
                      normalizedQuery: q ? normalizeSearchText(q) : null,
                    }}
                  />
                ))}
              </div>

              <div ref={sentinelRef} className="mt-4 flex h-10 items-center justify-center">
                {isFetchingNextPage && <Loader2 className="animate-spin text-[#5D082A]" size={24} />}
              </div>

              {!hasNextPage && (
                <p className="mt-2 text-center text-xs text-[#6B7280]">
                  {allProducts.length === total ? `Você viu os ${total} produtos.` : `${allProducts.length} produtos`}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {sheetOpen && (
        <FilterSheet
          total={total}
          isLoading={isLoading}
          sort={sort}
          onSale={onSale}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onChange={updateParams}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <Footer />
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--mobile-nav-height,4rem)] z-40 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-2.5 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur md:hidden">
          <Link
            to="/cart"
            className={buttonVariants({ className: 'flex h-12 w-full justify-between rounded-xl px-4 text-white shadow-lg' })}
            aria-label={`Ver carrinho com ${count} itens`}
          >
            <span className="text-sm font-bold">
              Ver carrinho
              <span className="ml-2 rounded-md bg-white/15 px-2 py-1 text-xs">{count} {count === 1 ? 'item' : 'itens'}</span>
            </span>
            <span className="text-base font-black">{formatPrice(cartTotal)}</span>
          </Link>
        </div>
      )}
      <MobileBottomNav />
      <BackToTopButton aboveBar={count > 0} />
    </div>
  )
}

/**
 * Ordenar e filtrar: folha que sobe de baixo no celular, painel no
 * computador. Cada toque ja aplica (a contagem do botao acompanha).
 */
function FilterSheet({
  total,
  isLoading,
  sort,
  onSale,
  minPrice,
  maxPrice,
  onChange,
  onClose,
}: {
  total: number
  isLoading: boolean
  sort: string
  onSale: boolean
  minPrice?: number
  maxPrice?: number
  onChange: (patch: Record<string, string | number | undefined>) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const option = (active: boolean) =>
    cn(
      'flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors',
      active ? 'bg-[#F8F2E6] font-bold text-[#5D082A]' : 'text-[#231F20] hover:bg-[#FBF7F0]',
    )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Ordenar e filtrar">
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EFE6D2] px-5 py-4">
          <h2 className="text-base font-bold text-[#231F20]">Ordenar e filtrar</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F8F4EA]">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wider text-[#8a6a3a]">Ordenar por</p>
            {SORTS.map((s) => (
              <button key={s.key || 'rec'} type="button" onClick={() => onChange({ ordem: s.key || undefined })} className={option(sort === s.key)}>
                {s.label}
                {sort === s.key && <Check size={18} />}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-[#8a6a3a]">Preço</p>
            <div className="flex flex-wrap gap-2 px-1">
              {PRICE_FILTERS.map((f) => {
                const active = f.minPrice === minPrice && f.maxPrice === maxPrice
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => onChange(active ? { minPrice: undefined, maxPrice: undefined } : { minPrice: f.minPrice, maxPrice: f.maxPrice })}
                    className={chip(active)}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl px-3 hover:bg-[#FBF7F0]">
            <span>
              <span className="block text-sm font-semibold text-[#231F20]">Só ofertas</span>
              <span className="block text-xs text-gray-500">Produtos com preço promocional agora</span>
            </span>
            <input
              type="checkbox"
              checked={onSale}
              onChange={(e) => onChange({ ofertas: e.target.checked ? '1' : undefined })}
              className="h-5 w-5 accent-[#5D082A]"
            />
          </label>
        </div>

        <div className="flex gap-2 border-t border-[#EFE6D2] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => onChange({ ordem: undefined, ofertas: undefined, minPrice: undefined, maxPrice: undefined })}
            className={buttonVariants({ variant: 'outline', className: 'h-12 rounded-xl px-4' })}
          >
            Limpar
          </button>
          <button type="button" onClick={onClose} className={buttonVariants({ className: 'h-12 flex-1 rounded-xl' })}>
            {isLoading ? 'Ver produtos' : `Ver ${total} ${total === 1 ? 'produto' : 'produtos'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
