import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useInfiniteProducts, useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useCategoriesCMS } from '../hooks/useCMS'
import { productsAPI } from '../services/api'
import { formatPrice, formatProductTitle } from '../utils/format'
import { trackEvent } from '../utils/analytics'
import { Search, ShoppingCart, ArrowLeft, Loader2, User, SlidersHorizontal, X } from 'lucide-react'
import { SEO } from '../components/SEO'
import { SkeletonCard } from '../components/Skeleton'
import type { Product } from '../types'
import { StoreProductCard } from '../components/StoreProductCard'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { surfaceClasses } from '../components/ui/surface'
import { cn } from '../lib/cn'

interface PaginatedProducts {
  data: Product[]
  page: number
  limit: number
  total: number
  hasNextPage: boolean
}

interface MercadologicalTreeLevel4 {
  value: string
}

interface MercadologicalTreeLevel3 {
  value: string
  children: MercadologicalTreeLevel4[]
}

interface MercadologicalTreeLevel2 {
  value: string
  children: MercadologicalTreeLevel3[]
}

interface MercadologicalTreeLevel1 {
  value: string
  children: MercadologicalTreeLevel2[]
}

const FALLBACK_CATEGORIES = [
  { key: '', label: 'Todos' },
]

const QUICK_SEARCHES = [
  'ofertas da semana',
  'frescos para hoje',
  'frango para churrasco',
  'carne moida',
  'pão francês',
]

const PRICE_FILTERS = [
  { key: 'all', label: 'Qualquer preço' },
  { key: 'up-to-20', label: 'Até R$ 20', maxPrice: 20 },
  { key: 'up-to-30', label: 'Até R$ 30', maxPrice: 30 },
  { key: '30-to-60', label: 'R$ 30 a R$ 60', minPrice: 30, maxPrice: 60 },
  { key: '60-plus', label: 'Acima de R$ 60', minPrice: 60 },
]

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

const normalizeCategoryCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const toCategoryUrlParam = (value: string) =>
  normalizeCategoryCode(value)
    .toLowerCase()
    .replace(/_/g, '-')

export default function MercadoPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { count, total: cartTotal } = useCart()
  const { user } = useAuth()
  const { data: categoriesCMS } = useCategoriesCMS()
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
  const { data: mercadologicalTree = [] } = useQuery({
    queryKey: ['mercadological-tree'],
    queryFn: async (): Promise<MercadologicalTreeLevel1[]> => {
      const response = await productsAPI.getMercadologicalTree()
      return (response.data?.data || []) as MercadologicalTreeLevel1[]
    },
    staleTime: 1000 * 60 * 30,
  })


  const [inputValue, setInputValue] = useState(q)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const trackedSearchRef = useRef('')
  const prevFiltersRef = useRef<string>('')

  // Sync input with URL q param when navigating
  useEffect(() => {
    setInputValue(q)
    setShowSuggestions(false)
    setIsInputFocused(false)
  }, [q])

  // Reset pagination and scroll to top when filters change
  useEffect(() => {
    const filterKey = `${cat}|${minPrice}|${maxPrice}|${classification01}|${classification02}|${classification03}|${classification04}`
    if (prevFiltersRef.current !== '' && prevFiltersRef.current !== filterKey) {
      // Filters changed, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevFiltersRef.current = filterKey
  }, [cat, minPrice, maxPrice, classification01, classification02, classification03, classification04])

  useEffect(() => {
    const value = inputValue.trim()
    if (value.length < 2) {
      setSuggestions([])
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        setIsSuggesting(true)
        const response = await productsAPI.suggest(value, 6)
        if (!cancelled) {
          const next = (response.data?.data || []) as string[]
          setSuggestions(next)
          setShowSuggestions(isInputFocused && next.length > 0)
        }
      } catch {
        if (!cancelled) {
          setSuggestions([])
        }
      } finally {
        if (!cancelled) setIsSuggesting(false)
      }
    }, 220)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [inputValue, isInputFocused])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!suggestionsRef.current) return
      if (!suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
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
  )

  const allProducts = data?.pages.flatMap((p) => (p as PaginatedProducts).data) ?? []
  const total = (data?.pages[0] as PaginatedProducts | undefined)?.total ?? 0

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

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params: Record<string, string> = {}
    if (inputValue.trim()) params.q = inputValue.trim()
    if (cat) params.cat = toCategoryUrlParam(cat)
    if (classification01) params.classification01 = classification01
    if (classification02) params.classification02 = classification02
    if (classification03) params.classification03 = classification03
    if (classification04) params.classification04 = classification04
    if (typeof minPrice === 'number') params.minPrice = String(minPrice)
    if (typeof maxPrice === 'number') params.maxPrice = String(maxPrice)
    inputRef.current?.blur()
    setIsInputFocused(false)
    setSearchParams(params)
    setShowSuggestions(false)
  }

  const chooseSuggestion = (value: string) => {
    const typedQuery = inputValue.trim()
    const formattedValue = formatProductTitle(value)
    const normalizedQuery = normalizeSearchText(formattedValue)
    const normalizedTyped = typedQuery ? normalizeSearchText(typedQuery) : ''
    const corrected = Boolean(typedQuery) && normalizedTyped.toLowerCase() !== typedQuery.toLowerCase()

    trackEvent('SEARCH', 'PRODUCT', undefined, {
      query: formattedValue,
      category: cat || null,
      minPrice: minPrice ?? null,
      maxPrice: maxPrice ?? null,
      originalQuery: typedQuery || formattedValue,
      normalizedQuery,
      corrected,
      correctedFrom: corrected ? typedQuery : null,
      correctedTo: corrected ? normalizedTyped : null,
      source: 'suggestion_click',
      usedSuggestion: true,
    })

    setInputValue(formattedValue)
  setIsInputFocused(false)
    const params: Record<string, string> = { q: formattedValue }
    if (cat) params.cat = toCategoryUrlParam(cat)
    if (classification01) params.classification01 = classification01
    if (classification02) params.classification02 = classification02
    if (classification03) params.classification03 = classification03
    if (classification04) params.classification04 = classification04
    if (typeof minPrice === 'number') params.minPrice = String(minPrice)
    if (typeof maxPrice === 'number') params.maxPrice = String(maxPrice)
    setSearchParams(params)
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  const setCategory = (newCat: string) => {
    const params: Record<string, string> = {}
    // Ao selecionar categoria explicitamente, limpa q para não misturar busca textual com filtro de categoria
    if (newCat) params.cat = toCategoryUrlParam(newCat)
    if (classification01) params.classification01 = classification01
    if (classification02) params.classification02 = classification02
    if (classification03) params.classification03 = classification03
    if (classification04) params.classification04 = classification04
    if (typeof minPrice === 'number') params.minPrice = String(minPrice)
    if (typeof maxPrice === 'number') params.maxPrice = String(maxPrice)
    setInputValue('')
    setSearchParams(params)
  }

  const setPriceFilter = (nextMinPrice?: number, nextMaxPrice?: number) => {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (cat) params.cat = toCategoryUrlParam(cat)
    if (classification01) params.classification01 = classification01
    if (classification02) params.classification02 = classification02
    if (classification03) params.classification03 = classification03
    if (classification04) params.classification04 = classification04
    if (typeof nextMinPrice === 'number') params.minPrice = String(nextMinPrice)
    if (typeof nextMaxPrice === 'number') params.maxPrice = String(nextMaxPrice)
    setSearchParams(params)
    setShowSuggestions(false)
    setIsInputFocused(false)
    inputRef.current?.blur()
  }

  const categoryTree = useMemo(() => {
    const raw = Array.isArray(categoriesCMS) ? categoriesCMS : []
    if (raw.length === 0) {
      return {
        roots: FALLBACK_CATEGORIES.filter((item) => item.key),
        childrenByRootCode: new Map<string, Array<{ key: string; label: string }>>(),
      }
    }

    const active = raw.filter((item: any) => item?.active !== false)
    const roots = active
      .filter((item: any) => !item.parentId)
      .sort((a: any, b: any) => {
        if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0)
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
      })
      .map((item: any) => {
        const code = normalizeCategoryCode(String(item.name || ''))
        return {
          id: String(item.id),
          key: code,
          label: `${item.name || code}`,
        }
      })

    const childrenByRootCode = new Map<string, Array<{ key: string; label: string }>>()
    for (const root of roots) {
      const children = active
        .filter((item: any) => String(item.parentId || '') === root.id)
        .sort((a: any, b: any) => {
          if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0)
          return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
        })
        .map((item: any) => ({
          key: normalizeCategoryCode(String(item.name || '')),
          label: String(item.name || ''),
        }))

      childrenByRootCode.set(root.key, children)
    }

    const fallbackRoots = FALLBACK_CATEGORIES.filter((item) => item.key)
    return {
      roots: roots.length > 0 ? roots.map((item) => ({ key: item.key, label: item.label })) : fallbackRoots,
      childrenByRootCode,
    }
  }, [categoriesCMS])

  const categories = useMemo(() => [{ key: '', label: 'Todos' }, ...categoryTree.roots], [categoryTree.roots])

  const selectedRoot = useMemo(() => {
    if (!cat) return ''
    if (categoryTree.roots.some((item) => item.key === cat)) return cat
    for (const root of categoryTree.roots) {
      const children = categoryTree.childrenByRootCode.get(root.key) || []
      if (children.some((item) => item.key === cat)) return root.key
    }
    return ''
  }, [cat, categoryTree])

  const selectedSubcategories = useMemo(
    () => (selectedRoot ? categoryTree.childrenByRootCode.get(selectedRoot) || [] : []),
    [selectedRoot, categoryTree],
  )

  const level1Options = mercadologicalTree
  const level2Options = useMemo(() => {
    const found = mercadologicalTree.find((item) => item.value === classification01)
    return found?.children || []
  }, [mercadologicalTree, classification01])
  const level3Options = useMemo(() => {
    const found = level2Options.find((item) => item.value === classification02)
    return found?.children || []
  }, [level2Options, classification02])
  const level4Options = useMemo(() => {
    const found = level3Options.find((item) => item.value === classification03)
    return found?.children || []
  }, [level3Options, classification03])

  const setMercadologicalFilter = (level: 1 | 2 | 3 | 4, value: string) => {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (cat) params.cat = cat
    if (typeof minPrice === 'number') params.minPrice = String(minPrice)
    if (typeof maxPrice === 'number') params.maxPrice = String(maxPrice)

    const next1 = level === 1 ? value : classification01
    const next2 = level === 2 ? value : level < 2 ? '' : classification02
    const next3 = level === 3 ? value : level < 3 ? '' : classification03
    const next4 = level === 4 ? value : level < 4 ? '' : classification04

    if (next1) params.classification01 = next1
    if (next2 && next1) params.classification02 = next2
    if (next3 && next2) params.classification03 = next3
    if (next4 && next3) params.classification04 = next4

    setSearchParams(params)
  }

  const categoryLabel =
    categories.find((c) => c.key === cat)?.label ||
    selectedSubcategories.find((c) => c.key === cat)?.label ||
    ''
  const selectedPriceFilter = PRICE_FILTERS.find((filter) => filter.minPrice === minPrice && filter.maxPrice === maxPrice)
  const selectedPriceLabel = selectedPriceFilter?.label || ''
  const activeFilterLabels = [
    q ? `Busca: ${q}` : '',
    categoryLabel ? `Seção: ${categoryLabel}` : '',
    selectedPriceLabel,
    classification01,
    classification02,
    classification03,
    classification04,
  ].filter(Boolean)
  const hasActiveFilters = Boolean(
    q ||
      cat ||
      typeof minPrice === 'number' ||
      typeof maxPrice === 'number' ||
      classification01 ||
      classification02 ||
      classification03 ||
      classification04,
  )

  const activeFilterCount = [
    Boolean(q),
    Boolean(cat),
    typeof minPrice === 'number' || typeof maxPrice === 'number',
    Boolean(classification01),
    Boolean(classification02),
    Boolean(classification03),
    Boolean(classification04),
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setInputValue('')
    setSuggestions([])
    setSearchParams({})
    setShowSuggestions(false)
    setIsInputFocused(false)
    setShowFilters(false)
    inputRef.current?.blur()
  }

  return (
    <div className="min-h-screen bg-white font-outfit pb-28 md:pb-24">
      <SEO
        title={q ? `${q} — Mercado` : cat ? `${categoryLabel} — Mercado` : 'Mercado'}
        description={
          q
            ? `Resultados para "${q}" no Mercado Antenor & Filhos. Carnes, vinhos, padaria e muito mais.`
            : 'Encontre rapidinho o que você precisa na Antenor & Filhos, com ofertas, carnes, vinhos e muito mais.'
        }
        canonical="/mercado"
        noindex={hasActiveFilters}
      />

      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/20">
        {/* Linha 1: busca */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => navigate('/')}
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full text-[#231F20]"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </Button>

          <div ref={suggestionsRef} className="flex-1 relative">
            <form
              onSubmit={handleSearch}
              className={surfaceClasses({
                className: 'flex h-12 items-center gap-2 bg-[#f5f5f5] px-4 ring-1 ring-black/10 transition-colors focus-within:ring-black/20',
              })}
            >
              <Search size={18} className="text-gray-500 shrink-0" />
              <Input
                ref={inputRef}
                type="text"
                autoFocus
                value={inputValue}
                onFocus={() => {
                  setIsInputFocused(true)
                  setShowSuggestions(suggestions.length > 0)
                }}
                onBlur={() => {
                  setIsInputFocused(false)
                  setShowSuggestions(false)
                }}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setIsInputFocused(true)
                }}
                placeholder="Digite o que você quer levar hoje"
                className="h-auto border-0 bg-transparent p-0 text-[15px] shadow-none ring-0 placeholder:text-gray-400 focus-visible:ring-0"
              />
              {isSuggesting && <Loader2 size={14} className="animate-spin text-[#5D082A]" />}
              {inputValue && (
                <Button
                  type="button"
                  onClick={() => {
                    setInputValue('')
                    setSuggestions([])
                    const params: Record<string, string> = {}
                    if (cat) params.cat = cat
                    if (classification01) params.classification01 = classification01
                    if (classification02) params.classification02 = classification02
                    if (classification03) params.classification03 = classification03
                    if (classification04) params.classification04 = classification04
                    setSearchParams(params)
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                  aria-label="Limpar busca"
                >
                  <X size={16} />
                </Button>
              )}
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className={surfaceClasses({ className: 'absolute left-0 right-0 top-[50px] z-50 overflow-hidden shadow-xl' })}>
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    onClick={() => chooseSuggestion(suggestion)}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-none border-b border-[#f1e8d6] px-4 py-3 text-left text-[15px] text-[#231F20] last:border-b-0"
                  >
                    {formatProductTitle(suggestion)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Link to="/cart" className="relative p-2 shrink-0 text-[#231F20] hover:text-[#5D082A] transition-colors">
            <ShoppingCart size={22} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#5D082A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          <Link to={user ? '/account' : '/login'} className="shrink-0 hidden sm:flex items-center gap-1 hover:bg-black/5 p-1 rounded-full transition-all">
            <div className="w-8 h-8 rounded-full bg-[#D2BB8A]/20 flex items-center justify-center border border-[#D2BB8A]/40">
              <User size={16} className="text-[#5D082A]" />
            </div>
            <span className="text-xs font-semibold text-[#231F20] pr-1">
              {user?.name?.split(' ')[0] || 'Entrar'}
            </span>
          </Link>
        </div>

        {/* Linha 3: categorias + botão filtros */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((c) => (
                <Button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  variant={cat === c.key ? 'primary' : 'subtle'}
                  size="sm"
                  className={cn(
                    'h-auto min-h-10 shrink-0 px-3 py-2 text-xs',
                    cat !== c.key && 'bg-[#f0f0f0] text-[#231F20] hover:bg-[#D2BB8A]/30',
                  )}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              variant={showFilters || activeFilterCount > 0 ? 'primary' : 'outline'}
              size="sm"
              className={cn(
                'h-auto min-h-10 shrink-0 px-3 py-2 text-xs',
                !(showFilters || activeFilterCount > 0) && 'text-[#231F20]',
              )}
              aria-label="Filtros"
              aria-expanded={showFilters}
              aria-controls="filter-panel"
            >
              <SlidersHorizontal size={13} />
              {activeFilterCount > 0 ? (
                <span>{activeFilterCount}</span>
              ) : (
                <span>Filtros</span>
              )}
            </Button>
          </div>

          {selectedRoot && selectedSubcategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <Button
                type="button"
                onClick={() => setCategory(selectedRoot)}
                variant={cat === selectedRoot ? 'primary' : 'outline'}
                size="sm"
                className={cn(
                  'h-auto min-h-10 shrink-0 px-3 py-2 text-xs',
                  cat !== selectedRoot && 'border-[#E8E0CE] bg-[#f7f7f7] text-[#231F20] hover:bg-[#D2BB8A]/20',
                )}
              >
                Todas as seções
              </Button>
              {selectedSubcategories.map((sub) => (
                <Button
                  key={sub.key}
                  type="button"
                  onClick={() => setCategory(sub.key)}
                  variant={cat === sub.key ? 'primary' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-auto min-h-10 shrink-0 px-3 py-2 text-xs',
                    cat !== sub.key && 'border-[#E8E0CE] bg-[#f7f7f7] text-[#231F20] hover:bg-[#D2BB8A]/20',
                  )}
                >
                  {sub.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Painel de filtros (expansível) */}
        {showFilters && (
          <div
            id="filter-panel"
            role="region"
            aria-label="Painel de filtros"
            className={surfaceClasses({ className: 'mx-4 mb-3 flex flex-col gap-3 bg-white px-4 py-4' })}
          >
            {/* Preço */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8A6A3A] font-bold mb-2">Preço</p>
              <div className="flex flex-wrap gap-2">
                {PRICE_FILTERS.map((filter) => {
                  const isActive = filter.minPrice === minPrice && filter.maxPrice === maxPrice
                  return (
                    <Button
                      key={filter.key}
                      type="button"
                      onClick={() => setPriceFilter(filter.minPrice, filter.maxPrice)}
                      variant={isActive ? 'primary' : 'outline'}
                      size="sm"
                      className="h-auto min-h-10 px-3 py-2 text-xs"
                    >
                      {filter.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Classificação mercadológica (progressiva) */}
            {level1Options.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#8A6A3A] font-bold mb-2">Classificação</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={classification01}
                    onChange={(e) => setMercadologicalFilter(1, e.target.value)}
                    className="flex-1 text-xs font-semibold"
                  >
                    <option value="">Nível 1</option>
                    {level1Options.map((item) => (
                      <option key={item.value} value={item.value}>{item.value}</option>
                    ))}
                  </Select>

                  {classification01 && level2Options.length > 0 && (
                    <Select
                      value={classification02}
                      onChange={(e) => setMercadologicalFilter(2, e.target.value)}
                      className="flex-1 text-xs font-semibold"
                    >
                      <option value="">Nível 2</option>
                      {level2Options.map((item) => (
                        <option key={item.value} value={item.value}>{item.value}</option>
                      ))}
                    </Select>
                  )}

                  {classification02 && level3Options.length > 0 && (
                    <Select
                      value={classification03}
                      onChange={(e) => setMercadologicalFilter(3, e.target.value)}
                      className="flex-1 text-xs font-semibold"
                    >
                      <option value="">Nível 3</option>
                      {level3Options.map((item) => (
                        <option key={item.value} value={item.value}>{item.value}</option>
                      ))}
                    </Select>
                  )}

                  {classification03 && level4Options.length > 0 && (
                    <Select
                      value={classification04}
                      onChange={(e) => setMercadologicalFilter(4, e.target.value)}
                      className="flex-1 text-xs font-semibold"
                    >
                      <option value="">Nível 4</option>
                      {level4Options.map((item) => (
                        <option key={item.value} value={item.value}>{item.value}</option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <Button
                type="button"
                onClick={clearAllFilters}
                variant="ghost"
                size="sm"
                className="self-start text-xs underline underline-offset-2"
              >
                Limpar tudo
              </Button>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Contagem de resultados */}
        {!isLoading && (
          <p className="text-sm text-gray-500 mb-4">
            {q ? (
              <>
                <span className="font-semibold text-[#231F20]">{total}</span> resultado{total !== 1 ? 's' : ''} para &quot;
                <span className="text-[#5D082A]">{q}</span>&quot;
                {cat && <> em <span className="font-medium">{categoryLabel}</span></>}
                {selectedPriceLabel && <> · <span className="font-medium">{selectedPriceLabel}</span></>}
              </>
            ) : (
              <>
                <span className="font-semibold text-[#231F20]">{total}</span> produto{total !== 1 ? 's' : ''}
                {cat && <> em <span className="font-medium">{categoryLabel}</span></>}
                {selectedPriceLabel && <> · <span className="font-medium">{selectedPriceLabel}</span></>}
              </>
            )}
          </p>
        )}

        {hasActiveFilters && activeFilterLabels.length > 0 && (
          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="shrink-0 rounded-md border border-[#D2BB8A]/50 bg-[#FBFAF7] px-3 py-2 text-xs font-semibold text-[#5D082A]"
              >
                {label}
              </span>
            ))}
            <Button
              type="button"
              onClick={clearAllFilters}
              variant="outline"
              size="sm"
              className="h-auto shrink-0 px-3 py-2 text-xs font-bold"
            >
              Limpar
            </Button>
          </div>
        )}

        {/* Sugestões rápidas — só quando sem filtro ativo */}
        {!hasActiveFilters && !isLoading && (
          <div className="flex flex-wrap gap-2 mb-5">
            {QUICK_SEARCHES.map((item) => (
              <Button
                key={item}
                type="button"
                onClick={() => chooseSuggestion(item)}
                variant="subtle"
                size="sm"
                className="h-auto px-3 py-1.5 text-xs"
              >
                {item}
              </Button>
            ))}
          </div>
        )}

        {/* Grade de produtos */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-2">
            <SkeletonCard count={10} />
          </div>
        ) : allProducts.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-gray-500">Não achamos esse produto por aqui</p>
            <p className="text-sm mt-1">Tente outra palavra, escolha uma categoria ou ajuste o preço</p>
            <Button
              type="button"
              onClick={() => chooseSuggestion('ofertas da semana')}
              className="mt-4"
            >
              Ver ofertas da semana
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

            <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
              {isFetchingNextPage && <Loader2 className="animate-spin text-[#5D082A]" size={24} />}
            </div>

            {!hasNextPage && allProducts.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-2">
                {allProducts.length} produto{allProducts.length !== 1 ? 's' : ''} carregado{allProducts.length !== 1 ? 's' : ''}
              </p>
            )}
          </>
        )}
      </main>
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur md:hidden">
          <Link
            to="/cart"
            className={buttonVariants({ className: 'flex min-h-14 w-full justify-between px-4 text-white shadow-lg' })}
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
    </div>
  )
}
