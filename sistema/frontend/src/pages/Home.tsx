import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAutoScroll } from '../hooks/useAutoScroll'
import {
  CATEGORY_ICONS,
  CMS_CATEGORY_TO_RULE_ID,
  HOME_CATEGORY_RULES,
  HOME_COMMERCIAL_PRIORITY,
  RULE_ID_TO_CMS_CODE,
  normalizeCategoryCode,
  normalizeWineLink,
  toCategoryUrlParam,
  type HomeCategoryRule,
} from '../utils/homeCategories'
import { useProducts, useCart, useRebuyRecommendations, useRecommendationShowcase } from '../hooks/useCart'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useAuth } from '../hooks/useAuth'
import { useCommercialTaxonomy, useStoreBanners, useTopSellingProducts, type StoreBannerCMS } from '../hooks/useCMS'
import { useDeliveryAddress } from '../hooks/useDeliveryAddress'
import { useDeliveryOperation } from '../hooks/useDeliveryOperation'
import { useBrand } from '../hooks/useBrand'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { resolveApiUrl } from '../services/api'
import type { Product } from '../types'
import { StoreProductCard } from '../components/StoreProductCard'
import { SkeletonCard, SkeletonHero } from '../components/Skeleton'
import { trackEvent } from '../utils/analytics'
import {
  Search, ShoppingCart, User, ArrowRight, Sparkles, MapPin, Clock, Home as HomeIcon,
  Apple, Croissant, Beef, Flame, Candy, Pizza, ShoppingBag
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO, StructuredData } from '../components/SEO'
import NotificationBell from '../components/NotificationBell'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

type PromoBannerView = {
  title: string
  badge?: string
  highlightNote?: string
  highlightedProduct?: Product
  description?: string
  image: string
  ctaLabel?: string
  ctaTo?: string
  align?: 'left' | 'right'
}

export default function Home() {
  const navigate = useNavigate()
  const touchStartX = useRef(0)
  const categoriesScrollRef = useRef<HTMLDivElement | null>(null)
  
  // Refs para auto-scroll dos carrosséis mobile
  const bestSellersScrollRef = useRef<HTMLDivElement | null>(null)
  const rebuyScrollRef = useRef<HTMLDivElement | null>(null)
  const offersScrollRef = useRef<HTMLDivElement | null>(null)
  const freshScrollRef = useRef<HTMLDivElement | null>(null)
  const fairScrollRef = useRef<HTMLDivElement | null>(null)
  const recurringScrollRef = useRef<HTMLDivElement | null>(null)
  const churrascoScrollRef = useRef<HTMLDivElement | null>(null)
  const padariaScrollRef = useRef<HTMLDivElement | null>(null)
  const tudoMercadoScrollRef = useRef<HTMLDivElement | null>(null)

  // Ativar auto-scroll nos carrosséis mobile
  useAutoScroll(bestSellersScrollRef)
  useAutoScroll(rebuyScrollRef)
  useAutoScroll(offersScrollRef)
  useAutoScroll(freshScrollRef)
  useAutoScroll(fairScrollRef)
  useAutoScroll(recurringScrollRef)
  useAutoScroll(churrascoScrollRef)
  useAutoScroll(padariaScrollRef)
  useAutoScroll(tudoMercadoScrollRef)

  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: storeBanners } = useStoreBanners()
  const { data: cmsCategories } = useCommercialTaxonomy()
  const { data: topSellingProducts } = useTopSellingProducts(8)
  const { count, subtotal } = useCart()
  const freeShipping = useFreeShipping(subtotal)
  const { user } = useAuth()
  const { deliveryAddressLabel } = useDeliveryAddress()
  const deliveryOperation = useDeliveryOperation()
  const brand = useBrand()
  const { openModal: openDeliveryVerificationModal } = useDeliveryVerificationModal()
  const { data: rebuyProducts = [] } = useRebuyRecommendations(user?.id, 10)
  const { data: marginShowcase = [] } = useRecommendationShowcase(undefined, 12)

  const productsList = (products || []) as Product[]

  const handleHeaderAddressClick = useCallback(() => {
    openDeliveryVerificationModal()
  }, [openDeliveryVerificationModal])

  const handleHeaderAddressTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault() // bloqueia ghost click do iOS
    openDeliveryVerificationModal()
  }, [openDeliveryVerificationModal])

  interface CMSCategoryConfig {
    rule: HomeCategoryRule
    limit: number
    priority: number
    productCount: number
    curatedProducts: Product[]
  }

  // Tipo local para itens vindos da API CMS (sem contrato forte)
  type CMSCategoryItem = {
    active?: boolean
    code?: string
    name?: string
    limit?: number
    priority?: number
    productCount?: number
    curatedProducts?: Array<{ product?: Product }>
  }

  const enabledHomeRules = useMemo(() => {
    const list = Array.isArray(cmsCategories) ? cmsCategories : []
    const configs: CMSCategoryConfig[] = []

    list
      .filter((item: CMSCategoryItem) => item?.active !== false)
      .forEach((item: CMSCategoryItem) => {
        const categoryCode = String(item?.code || item?.name || '')
        const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(categoryCode)]
        if (ruleId) {
          const rule = HOME_CATEGORY_RULES.find(r => r.id === ruleId)
          if (rule) {
            configs.push({
              rule,
              limit: item?.limit ?? 6,
              priority: item?.priority ?? 0,
              productCount: Number(item?.productCount ?? 0),
              curatedProducts: Array.isArray(item?.curatedProducts)
                ? (item.curatedProducts as Product[])
                : [],
            })
          }
        }
      })

    // Sort by priority (ascending, 0 is highest)
    if (configs.length === 0) {
      return HOME_CATEGORY_RULES.map(rule => ({
        rule,
        limit: 6,
        priority: HOME_COMMERCIAL_PRIORITY[rule.id] ?? 999,
        productCount: 0,
        curatedProducts: [],
      }))
    }

    return configs.sort((a, b) => a.priority - b.priority)
  }, [cmsCategories])

  const categorized = useMemo(() => {
    const bucketByRule = new Map<string, Product[]>()
    const limitsMap = new Map<string, number>()
    const enabledRuleIds = new Set(enabledHomeRules.map((config) => config.rule.id))
    const sectionRuleIds = new Set(['praticos', 'doces', 'churrasco', 'carnes', 'hortifruti', 'padaria', 'bebidas'])
    const usedProductIds = new Set<string>()
    
    enabledHomeRules.forEach((config) => {
      const curated = (config.curatedProducts || []).filter((product) => {
        if (!product?.id || usedProductIds.has(product.id)) return false
        usedProductIds.add(product.id)
        return true
      })

      bucketByRule.set(config.rule.id, curated)
      limitsMap.set(config.rule.id, config.limit)
    })

    const unmatched: Product[] = []

    for (const product of productsList) {
      if (usedProductIds.has(product.id)) continue

      const categoryRuleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(product.category || '')]

      if (categoryRuleId && enabledRuleIds.has(categoryRuleId)) {
        usedProductIds.add(product.id)
        if (sectionRuleIds.has(categoryRuleId)) {
          bucketByRule.get(categoryRuleId)?.push(product)
        } else {
          unmatched.push(product)
        }
      } else {
        unmatched.push(product)
      }
    }

    // Apply limits to each category
    const applyLimit = (products: Product[], limit: number) => products.slice(0, limit)

    return {
      consumoRapido: applyLimit(bucketByRule.get('praticos') || [], limitsMap.get('praticos') || 6),
      guloseimas: applyLimit(bucketByRule.get('doces') || [], limitsMap.get('doces') || 6),
      churrasco: applyLimit(bucketByRule.get('churrasco') || [], limitsMap.get('churrasco') || 6),
      carnesDiaADia: applyLimit(bucketByRule.get('carnes') || [], limitsMap.get('carnes') || 6),
      feira: applyLimit(bucketByRule.get('hortifruti') || [], limitsMap.get('hortifruti') || 8),
      padaria: applyLimit(bucketByRule.get('padaria') || [], limitsMap.get('padaria') || 6),
      bebidas: applyLimit(bucketByRule.get('bebidas') || [], limitsMap.get('bebidas') || 6),
      outros: unmatched,
    }
  }, [productsList, enabledHomeRules])

  const homeCategories = useMemo(() => {
    const categories = enabledHomeRules
      .map((config) => {
        const count = (config.curatedProducts?.length || 0) > 0
          ? config.curatedProducts.length
          : config.productCount

        return {
          id: config.rule.id,
          label: config.rule.label,
          query: config.rule.query,
          count,
          priority: config.priority,
        }
      })
      .filter((category) => category.count > 0)
      .sort((a, b) => a.priority - b.priority)

    return categories
  }, [productsList, enabledHomeRules])

  const featuredCommercialSection = useMemo(() => {
    const hasProducts = (config: { productCount: number; curatedProducts?: Product[] }) =>
      (config.curatedProducts?.length || 0) > 0 || config.productCount > 0

    const preferred = enabledHomeRules.find((config) => config.rule.id === 'vinhos' && hasProducts(config))
    const fallback = enabledHomeRules.find((config) => hasProducts(config))
    const selected = preferred || fallback

    if (!selected) return null

    const cleanLabel = selected.rule.label.replace(/^\S+\s*/, '').trim()
    const cmsCode = RULE_ID_TO_CMS_CODE[selected.rule.id] || selected.rule.id.toUpperCase()
    const isWine = selected.rule.id === 'vinhos'

    return {
      badge: isWine ? 'Adega Exclusiva' : 'Selecao Especial',
      title: isWine ? 'Vinhos para toda ocasião' : `${cleanLabel} em destaque`,
      description: isWine
        ? 'Uma seleção pronta para impressionar, presentear e completar pedidos especiais.'
        : `Produtos selecionados da categoria ${cleanLabel.toLowerCase()} para completar seus pedidos.`,
      ctaLabel: isWine ? 'Acessar Adega' : `Ver ${cleanLabel}`,
      ctaTo: isWine ? '/adega' : `/mercado?cat=${toCategoryUrlParam(cmsCode)}`,
    }
  }, [enabledHomeRules])

  const [currentSlide, setCurrentSlide] = useState(0)

  const bestSellers = useMemo(() => {
    const fromAnalytics = Array.isArray(topSellingProducts)
      ? topSellingProducts
          .map((item) => item?.product)
          .filter((product): product is Product => Boolean(product))
      : []

    if (fromAnalytics.length > 0) {
      return fromAnalytics.slice(0, 8)
    }

    const fallback = [
      ...categorized.churrasco,
      ...categorized.carnesDiaADia,
      ...categorized.padaria,
      ...categorized.guloseimas,
      ...categorized.bebidas,
      ...categorized.consumoRapido,
      ...categorized.outros,
    ]

    const seen = new Set<string>()
    return fallback.filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    }).slice(0, 8)
  }, [topSellingProducts, categorized])

  const uniqueProducts = useCallback((items: Product[], limit: number) => {
    const seen = new Set<string>()
    return items
      .filter((product) => {
        if (!product?.id || seen.has(product.id)) return false
        seen.add(product.id)
        return true
      })
      .slice(0, limit)
  }, [])

  const rebuyShelf = useMemo(() => {
    const fallback = [...bestSellers, ...categorized.outros]
    return uniqueProducts(rebuyProducts.length > 0 ? rebuyProducts : fallback, 10)
  }, [bestSellers, categorized.outros, rebuyProducts, uniqueProducts])

  const offersShelf = useMemo(() => {
    const promotional = productsList.filter((product) =>
      typeof product.promotionalPrice === 'number' &&
      product.promotionalPrice > 0 &&
      product.promotionalPrice < product.price,
    )
    return uniqueProducts([...promotional, ...marginShowcase, ...bestSellers], 10)
  }, [bestSellers, marginShowcase, productsList, uniqueProducts])

  const freshShelf = useMemo(() => {
    return uniqueProducts([...categorized.feira, ...categorized.carnesDiaADia, ...categorized.padaria, ...categorized.outros], 10)
  }, [categorized.carnesDiaADia, categorized.feira, categorized.outros, categorized.padaria, uniqueProducts])

  const fairShelf = useMemo(() => {
    return uniqueProducts([...categorized.feira, ...freshShelf], 10)
  }, [categorized.feira, freshShelf, uniqueProducts])

  const churrascoOccasionShelf = useMemo(() => {
    return uniqueProducts([...categorized.churrasco, ...categorized.carnesDiaADia, ...categorized.bebidas], 10)
  }, [categorized.bebidas, categorized.carnesDiaADia, categorized.churrasco, uniqueProducts])

  const recurringShelf = useMemo(() => {
    const pantry = productsList.filter((product) => {
      const haystack = `${product.category || ''} ${product.name || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      return ['arroz', 'feijao', 'acucar', 'cafe', 'leite', 'limpeza', 'papel', 'detergente', 'sabao'].some((term) => haystack.includes(term))
    })
    return uniqueProducts([...rebuyProducts, ...pantry, ...bestSellers], 10)
  }, [bestSellers, productsList, rebuyProducts, uniqueProducts])

  const slides = useMemo(() => {
    if (!storeBanners || storeBanners.length === 0) return []

    const activeSlides = storeBanners
      .filter((item: StoreBannerCMS) => item.active !== false && item.type === 'full' && item.imageUrl)
      .sort((a: StoreBannerCMS, b: StoreBannerCMS) => (a.order || 0) - (b.order || 0))

    return activeSlides.map((item: StoreBannerCMS) => ({
      title: item.title || item.name || 'Destaque',
      tag: 'Destaque',
      description: 'Ofertas e destaques escolhidos para facilitar sua compra e fazer render mais.',
      image: resolveApiUrl(item.imageUrl),
      link: normalizeWineLink(item.link || '#'),
      button: 'Ver oferta',
    }))
  }, [storeBanners])

  const promoBanners = useMemo<PromoBannerView[]>(() => {
    if (!storeBanners || storeBanners.length === 0) return []

    return storeBanners
      .filter((item: StoreBannerCMS) => item.active !== false && item.type !== 'full' && item.imageUrl)
      .sort((a: StoreBannerCMS, b: StoreBannerCMS) => (a.order || 0) - (b.order || 0))
      .map((item: StoreBannerCMS) => ({
        title: item.title || item.name || 'Destaque',
        badge: 'Destaque',
        description: 'Ofertas e destaques da semana para facilitar sua compra.',
        image: resolveApiUrl(item.imageUrl),
        ctaLabel: 'Aproveitar',
        ctaTo: item.link || '/mercado',
        align: 'left' as const,
      }))
  }, [storeBanners])

  const getPromoBanner = (index: number) => promoBanners[index] || null
  const promoBanner1 = getPromoBanner(0)
  const promoBanner2 = getPromoBanner(1)
  const promoBanner3 = getPromoBanner(2)

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'HOME', 'General')
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [slides.length])

  useEffect(() => {
    const interval = setInterval(() => {
      const container = categoriesScrollRef.current
      if (!container) return
      const maxScroll = container.scrollWidth - container.clientWidth
      if (maxScroll <= 0) return
      if (container.scrollLeft >= maxScroll - 8) {
        container.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        container.scrollBy({ left: 112, behavior: 'smooth' })
      }
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  // Schema.org Data
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": brand.storeName || "Antenor & Filhos",
    "description": "Qualidade, Tradição e Elegaância. Açougue, Adega e Padaria Artesanal.",
    "url": window.location.origin,
    "logo": `${window.location.origin}/branding/logo-bordo.png`,
  }

  if (productsLoading && !productsList.length) {
    return (
      <div className="min-h-screen bg-white font-outfit">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
          <SkeletonHero />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <SkeletonCard count={10} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-outfit">
      <SEO 
        title={`${brand.storeName} - mercado online, acougue, padaria e adega`}
        description="Carnes selecionadas, vinhos que impressionam e pão fresquinho. Tudo que você precisa para comprar bem e comer melhor."
        canonical="/"
      />
      <StructuredData data={organizationSchema} />
      <h1 className="sr-only">
        {brand.storeName} - mercado online com acougue, padaria, adega e ofertas
      </h1>

      {/* ── MOBILE HEADER (< md) ── */}
      <header className="md:hidden sticky top-0 z-50">
        <div className="bg-[#5D082A] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            {/* Logo + endereço */}
            <Button
              type="button"
              onClick={handleHeaderAddressClick}
              onTouchStart={handleHeaderAddressTouchStart}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              variant="ghost"
              className="mr-2 h-auto min-h-[44px] min-w-0 flex-1 justify-start rounded-none p-0 text-left hover:bg-transparent"
            >
              {brand.logoMobileUrl ? (
                <img
                  src={resolveApiUrl(brand.logoMobileUrl) ?? brand.logoMobileUrl}
                  alt={brand.storeName}
                  className="h-7 w-7 object-contain shrink-0 pointer-events-none"
                />
              ) : (
                <span className="text-lg shrink-0 pointer-events-none">🏦</span>
              )}
              <span className="flex items-center gap-1 text-white/85 text-xs min-w-0 pointer-events-none">
                <MapPin size={12} className="text-[#D2BB8A] shrink-0" />
                <span className="truncate">
                  {deliveryAddressLabel || 'Enviar para: CLIQUE AQUI'}
                </span>
              </span>
            </Button>
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/cart" className="relative p-1.5" aria-label={`Carrinho com ${count} itens`}>
                <ShoppingCart size={22} className="text-white" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#D2BB8A] text-[#5D082A] text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
                )}
                {freeShipping.enabled && freeShipping.achieved && (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full w-2.5 h-2.5 border border-white" title="Frete grátis conquistado!" />
                )}
              </Link>
              {user ? (
                <div className="[&_button]:text-white [&_button]:hover:bg-white/10 [&_button_svg]:text-white [&_button_span]:bg-[#D2BB8A] [&_button_span]:text-[#5D082A]">
                  <NotificationBell />
                </div>
              ) : (
                <Link to="/login" className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <User size={17} className="text-white" />
                </Link>
              )}
            </div>
          </div>
          {/* Mobile Search Bar */}
          <div
            className="flex items-center gap-3 bg-white rounded-lg px-4 h-11 cursor-text"
            onClick={() => navigate('/mercado')}
          >
            <Search size={16} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-400 select-none">Buscar produto aqui...</span>
          </div>
        </div>
        {/* Mobile Category Chips */}
        {homeCategories.length > 0 && (
          <div className="bg-white border-b border-gray-100">
            <div
              className="flex overflow-x-auto no-scrollbar px-4 py-3 gap-3 snap-x"
              style={{ touchAction: 'pan-x' }}
            >
              {homeCategories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.id] || CATEGORY_ICONS.default
                const name = category.label.replace(/^\S+\s*/, '')
                return (
                  <Link
                    key={category.id}
                    to={`/mercado?cat=${toCategoryUrlParam(RULE_ID_TO_CMS_CODE[category.id] || category.id.toUpperCase())}`}
                    style={{ touchAction: 'manipulation' }}
                    className="snap-start shrink-0 flex flex-col items-center gap-1 min-w-[64px] text-center cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#F3ECE0] flex items-center justify-center border border-[#E8D7B0]/60 text-[#5D082A] group-active:scale-95 transition-transform duration-150">
                      <IconComponent size={24} strokeWidth={1.8} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#231F20] leading-tight line-clamp-2">{name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── DESKTOP TOP BAR + HEADER (md+) ── */}
      <div className="hidden md:block sticky top-0 z-50">
        <div className="bg-[#F8F4EA] border-b border-[#D2BB8A]/30">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
            <Button
              type="button"
              onClick={handleHeaderAddressClick}
              variant="outline"
              size="sm"
              className="h-8 max-w-full justify-start bg-white/70 px-3 py-1 text-[11px] text-[#5d4f33] hover:bg-white"
            >
              <MapPin size={14} className="shrink-0 text-[#5D082A]" />
              <span className="truncate">
                {deliveryAddressLabel || 'Enviar para: CLIQUE AQUI'}
              </span>
            </Button>
            <div className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1 text-[11px] ${deliveryOperation.isOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#D2BB8A]/60 bg-[#FBFAF7] text-[#5d4f33]'}`}>
              <Clock size={14} className="shrink-0" />
              <span className="truncate">
                {deliveryOperation.headline}: {deliveryOperation.countdownLabel || deliveryOperation.detail}
              </span>
            </div>
          </div>
        </div>

        <header className="bg-[#5D082A] border-b border-[#4a0621]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {/* Mobile: logo mobile branco ou inicial */}
            {brand.logoMobileUrl ? (
              <img
                src="/branding/logo-branco.png"
                alt={brand.storeName}
                className="h-9 w-9 object-contain sm:hidden"
              />
            ) : (
              <span className="text-3xl sm:hidden">🏬</span>
            )}
            {/* Desktop/tablet: logo desktop branco ou nome */}
            {brand.logoDesktopUrl ? (
              <img
                src="/branding/logo-horizontal-branco.png"
                alt={brand.storeName}
                className="hidden sm:block h-9 max-w-[180px] object-contain"
              />
            ) : (
              <span className="hidden sm:block text-xl font-bold tracking-tight text-white">
                {brand.storeName.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: brand.primaryColor }}>
                  {brand.storeName.split(' ').slice(-1)[0]}
                </span>
              </span>
            )}
            {/* Fallback mobile sem logo: nome texto */}
            {!brand.logoMobileUrl && (
              <span className="sm:hidden text-xl font-bold tracking-tight text-white">
                {brand.storeName.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: brand.primaryColor }}>
                  {brand.storeName.split(' ').slice(-1)[0]}
                </span>
              </span>
            )}
          </Link>
          
            <div
              className="flex-1 mx-6 flex items-center gap-2 rounded-lg border border-[#D2BB8A]/50 bg-white/95 px-4 h-10 cursor-text hover:border-[#D2BB8A] transition-colors"
              onClick={() => navigate('/mercado')}
            >
              <Search size={16} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 select-none">Buscar produto aqui...</span>
            </div>
          
            <div className="flex items-center gap-4">
            <Link to="/cart" className="relative p-2 text-white hover:text-[#D2BB8A] transition-colors" aria-label={`Carrinho com ${count} itens`}>
              <ShoppingCart size={24} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D2BB8A] text-[#5D082A] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <div className="[&_button]:text-white [&_button]:hover:bg-white/10 [&_button_svg]:text-white [&_button_span]:bg-[#D2BB8A] [&_button_span]:text-[#5D082A]">
                <NotificationBell />
              </div>
            ) : (
              <Link to="/login" className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-full transition-all">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden border border-white/20">
                  <User size={18} className="text-white" />
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-white">Entrar</span>
              </Link>
            )}
            </div>
          </div>
        </header>
      </div>

      {/* Hero Slider — escondido no mobile, substituído pela seção Popular */}
      {slides.length > 0 && <div
        className="hidden md:block relative h-[340px] sm:h-[430px] md:h-[520px] overflow-hidden bg-[#231F20]"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (diff > 50) setCurrentSlide((prev) => (prev + 1) % slides.length)
          else if (diff < -50) setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
        }}
      >
            {slides.map((slide: { title: string; tag?: string; description?: string; button?: string; image?: string; link?: string }, index: number) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
            <img 
              src={slide.image} 
              alt={slide.title} 
              className="w-full h-full object-cover opacity-60"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#231F20] via-[#231F20]/40 to-transparent" />
            
            <div className="absolute inset-0 z-10 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center gap-3 sm:gap-4">
              <div className="max-w-xl">
                <Badge tone="gold" className="mb-3 h-auto w-fit gap-1.5 border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                  <Sparkles size={11} /> {slide.tag}
                </Badge>
                <h2 className="text-2xl sm:text-4xl md:text-6xl font-bold text-white mb-3 luxury-text tracking-tight leading-tight">
                  {slide.title}
                </h2>
                <p className="text-white/80 mb-5 sm:mb-7 text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-none">
                  {slide.description}
                </p>
                <div className="flex items-center gap-3">
                  {slide.link && <Link to={slide.link} className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto text-sm sm:text-base' })}>
                    {slide.button} <ArrowRight size={16} />
                  </Link>}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {slides.map((_: Record<string, unknown>, index: number) => (
            <Button
              key={index}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Ir para slide ${index + 1}`}
              variant="ghost"
              size="icon"
              className={`h-2 rounded-full p-0 transition-all hover:bg-white/40 ${
                index === currentSlide ? 'bg-[#D2BB8A] w-6' : 'bg-white/30 w-2'
              }`}
            />
          ))}
        </div>
      </div>}

      {/* Categorias abaixo do banner — apenas desktop */}
      {homeCategories.length > 0 && (
        <div className="hidden md:block border-b border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div
              ref={categoriesScrollRef}
              className="flex overflow-x-auto no-scrollbar py-3 gap-3 snap-x"
            >
              {homeCategories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.id] || CATEGORY_ICONS.default
                const name = category.label.replace(/^\S+\s*/, '')
                return (
                  <Link
                    key={category.id}
                    to={`/mercado?cat=${toCategoryUrlParam(RULE_ID_TO_CMS_CODE[category.id] || category.id.toUpperCase())}`}
                    className="snap-start shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg bg-[#FBF7F0] border border-[#E8D7B0]/40 hover:bg-[#F3E7C9] hover:border-[#D2BB8A] hover:scale-105 transition-all duration-200 min-w-[90px] text-center group cursor-pointer"
                  >
                    <IconComponent size={20} className="text-[#5D082A] group-hover:scale-110 transition-transform duration-200" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold text-[#5d4f33] group-hover:text-[#5D082A] transition-colors leading-tight line-clamp-2 whitespace-pre-wrap">
                      {name}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE MAIN — seção Popular Now ── */}
      {rebuyShelf.length > 0 && (
        <MobileProductShelf
          title={user ? 'Recomprar rapidinho' : 'Atalhos para repetir'}
          subtitle={user ? 'Historico do cliente' : 'Mais pedidos da loja'}
          icon={ShoppingCart}
          products={rebuyShelf}
          to="/mercado"
          linkLabel="Ver mais"
          scrollRef={rebuyScrollRef}
        />
      )}

      {offersShelf.length > 0 && (
        <MobileProductShelf
          title="Ofertas para hoje"
          subtitle="Preco e margem"
          icon={Sparkles}
          products={offersShelf}
          to="/promocoes"
          linkLabel="Promos"
          scrollRef={offersScrollRef}
        />
      )}

      {freshShelf.length > 0 && (
        <MobileProductShelf
          title="Frescos da loja"
          subtitle="Acougue e padaria"
          icon={Apple}
          products={freshShelf}
          to="/mercado?cat=hortifruti"
          linkLabel="Ver frescos"
          scrollRef={freshScrollRef}
        />
      )}

      {fairShelf.length > 0 && (
        <MobileProductShelf
          title="Feira da semana"
          subtitle="Hortifruti e frescos"
          icon={Apple}
          products={fairShelf}
          to="/mercado?cat=hortifruti"
          linkLabel="Ver feira"
          scrollRef={fairScrollRef}
        />
      )}

      {recurringShelf.length > 0 && (
        <MobileProductShelf
          title="Recorrentes da casa"
          subtitle="Itens que sempre voltam"
          icon={ShoppingBag}
          products={recurringShelf}
          to="/mercado?q=recorrentes"
          linkLabel="Ver itens"
          scrollRef={recurringScrollRef}
        />
      )}

      {bestSellers.length > 0 && (
        <section className="md:hidden px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#231F20]">Mais Pedidos</h2>
            <Link to="/mercado" className="text-xs text-[#5D082A] font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={13} />
            </Link>
          </div>
          <div ref={bestSellersScrollRef} className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x -mx-4 px-4">
            {bestSellers.map(product => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Promo Banner */}
      {promoBanner1 && (
        <section className="md:hidden mx-4 mb-4">
          <div className="relative overflow-hidden rounded-2xl min-h-[140px]">
            <img src={promoBanner1.image} alt={promoBanner1.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#231F20]/80 to-transparent" />
            <div className="relative z-10 p-5 flex flex-col justify-end h-full min-h-[140px]">
              {promoBanner1.badge && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D2BB8A] mb-1">{promoBanner1.badge}</span>
              )}
              <p className="text-white font-bold text-base leading-tight mb-3">{promoBanner1.title}</p>
              {promoBanner1.ctaTo && (
                <Link to={promoBanner1.ctaTo} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'self-start border-white bg-white text-xs font-bold text-[#5D082A] hover:bg-[#F3E7C9]' })}>
                  {promoBanner1.ctaLabel ?? 'Ver mais'}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {featuredCommercialSection && (
        <section className="md:hidden mx-4 mb-4">
          <div className={surfaceClasses({ tone: 'dark', className: 'overflow-hidden border-[#D2BB8A]/40 bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] p-5 shadow-xl' })}>
            <div className="flex flex-col gap-4">
              <div>
                <Badge tone="gold" className="mb-3 h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                  {featuredCommercialSection.badge}
                </Badge>
                <h3 className="text-xl font-bold text-white luxury-text mb-2">{featuredCommercialSection.title}</h3>
                <p className="text-white/80 text-sm">{featuredCommercialSection.description}</p>
              </div>
              <Link to={featuredCommercialSection.ctaTo} className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full text-sm' })}>
                {featuredCommercialSection.ctaLabel} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Mobile — Mais seções de produto */}
      {churrascoOccasionShelf.length > 0 && (
        <section className="md:hidden px-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#231F20] flex items-center gap-2">
              <Flame size={18} className="text-[#5D082A]" /> Churrasco e ocasião
            </h2>
            <Link to="/mercado?q=churrasco" className="text-xs text-[#5D082A] font-semibold flex items-center gap-0.5">Ver todos <ArrowRight size={13} /></Link>
          </div>
          <div ref={churrascoScrollRef} className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x -mx-4 px-4">
            {churrascoOccasionShelf.map(product => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>
        </section>
      )}

      {categorized.padaria.length > 0 && (
        <section className="md:hidden px-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#231F20] flex items-center gap-2">
              <Croissant size={18} className="text-[#5D082A]" /> Padaria & Pães Artesanais
            </h2>
            <Link to="/mercado?q=padaria" className="text-xs text-[#5D082A] font-semibold flex items-center gap-0.5">Ver todos <ArrowRight size={13} /></Link>
          </div>
          <div ref={padariaScrollRef} className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x -mx-4 px-4">
            {categorized.padaria.map(product => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>
        </section>
      )}

      {(categorized.outros.length > 0 || categorized.bebidas.length > 0) && (
        <section className="md:hidden px-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#231F20] flex items-center gap-2">
              <ShoppingBag size={18} className="text-[#5D082A]" /> Tudo do Mercado
            </h2>
            <Link to="/mercado" className="text-xs text-[#5D082A] font-semibold flex items-center gap-0.5">Ver todos <ArrowRight size={13} /></Link>
          </div>
          <div ref={tudoMercadoScrollRef} className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x -mx-4 px-4">
            {[...categorized.outros, ...categorized.bebidas].map(product => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>
        </section>
      )}

      {/* ── DESKTOP MAIN ── */}
      <main className="hidden md:block max-w-7xl mx-auto px-4 py-8 space-y-12 pb-24">
        
        {featuredCommercialSection && (
          <section className="fade-in-section">
            <div className={surfaceClasses({ tone: 'dark', className: 'overflow-hidden border-[#D2BB8A]/40 bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] p-6 shadow-xl md:p-8' })}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="max-w-2xl">
                  <Badge tone="gold" className="mb-3 h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                    {featuredCommercialSection.badge}
                  </Badge>
                  <h3 className="text-2xl md:text-4xl font-bold text-white luxury-text mb-2">{featuredCommercialSection.title}</h3>
                  <p className="text-white/80 text-sm md:text-base">{featuredCommercialSection.description}</p>
                </div>
                <Link to={featuredCommercialSection.ctaTo} className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'whitespace-nowrap' })}>
                  {featuredCommercialSection.ctaLabel} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          {rebuyShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow={user ? 'Historico de compra' : 'Compra recorrente'}
              title={user ? 'Recompre em poucos cliques' : 'Mais fáceis de repetir'}
              icon={ShoppingCart}
              products={rebuyShelf.slice(0, 6)}
              to="/mercado"
            />
          )}
          {offersShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow="Ofertas e oportunidade"
              title="Melhores escolhas de hoje"
              icon={Sparkles}
              products={offersShelf.slice(0, 6)}
              to="/promocoes"
            />
          )}
          {freshShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow="Frescos e balcão"
              title="Para levar fresco agora"
              icon={Apple}
              products={freshShelf.slice(0, 6)}
              to="/mercado?cat=hortifruti"
            />
          )}
          {churrascoOccasionShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow="Ocasião pronta"
              title="Churrasco sem garimpo"
              icon={Flame}
              products={churrascoOccasionShelf.slice(0, 6)}
              to="/mercado?q=churrasco"
            />
          )}
          {fairShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow="Feira e hortifruti"
              title="Reposição fresca da semana"
              icon={Apple}
              products={fairShelf.slice(0, 6)}
              to="/mercado?cat=hortifruti"
            />
          )}
          {recurringShelf.length > 0 && (
            <DesktopIntentShelf
              eyebrow="Compra recorrente"
              title="Itens que sempre voltam"
              icon={ShoppingBag}
              products={recurringShelf.slice(0, 6)}
              to="/mercado?q=recorrentes"
            />
          )}
        </div>

        {bestSellers.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-[#D2BB8A] font-bold">Dados de pedidos</span>
              <h3 className="text-3xl font-bold luxury-text flex items-center gap-2 text-[#231F20]">
                <Sparkles size={24} className="text-[#D2BB8A]" /> Mais Vendidos
              </h3>
            </div>
            <Link to="/mercado" className="text-xs text-[#5D082A] font-bold flex items-center gap-1 hover:underline whitespace-nowrap">
              Ver catálogo <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
            {bestSellers.map(product => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>
        </section>
        )}

        {/* Category: CHURRASCO */}
        {categorized.churrasco.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-[#D2BB8A] font-bold">Especialidade da Casa</span>
              <h3 className="text-3xl font-bold luxury-text flex items-center gap-2 text-[#231F20]">
                <Flame size={24} className="text-[#5D082A]" /> Seleção para Churrasco
              </h3>
            </div>
            <Link to="/mercado?q=churrasco" className="text-xs text-[#5D082A] font-bold flex items-center gap-1 hover:underline whitespace-nowrap">
              Ver mais <ArrowRight size={14} />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
             {categorized.churrasco.map(product => (
               <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
             ))}
          </div>
        </section>
        )}

        {promoBanner1 && (
          <PromoBanner
            image={promoBanner1.image}
            alt={promoBanner1.title}
            badge={promoBanner1.badge}
            highlightNote={promoBanner1.highlightNote}
            highlightedProduct={promoBanner1.highlightedProduct}
            title={promoBanner1.title}
            description={promoBanner1.description}
            ctaLabel={promoBanner1.ctaLabel}
            ctaTo={promoBanner1.ctaTo}
            align={promoBanner1.align}
          />
        )}

        {/* Category: PADARIA */}
        {categorized.padaria.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <Link to="/mercado?q=padaria" className="cursor-pointer hover:opacity-80 transition-opacity">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-[#231F20]">
              <Croissant size={22} className="text-[#5D082A]" /> Padaria & Pães Artesanais
            </h3>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
             {categorized.padaria.map(product => (
               <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
             ))}
          </div>
        </section>
        )}

        {/* Category: CARNES DIA A DIA */}
        {categorized.carnesDiaADia.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <Link to="/mercado?q=carnes" className="cursor-pointer hover:opacity-80 transition-opacity">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-[#231F20]">
              <Beef size={22} className="text-[#5D082A]" /> Carnes para o Dia a Dia
            </h3>
            </Link>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar snap-x">
             {categorized.carnesDiaADia.map(product => (
               <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
             ))}
          </div>
        </section>
        )}

        {/* Category: CONSUMO RAPIDO */}
        {categorized.consumoRapido.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <Link to="/mercado?q=praticos" className="cursor-pointer hover:opacity-80 transition-opacity">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-[#231F20]">
              <Pizza size={22} className="text-[#5D082A]" /> Fome de Agora
            </h3>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
             {categorized.consumoRapido.map(product => (
               <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
             ))}
          </div>
        </section>
        )}

        {promoBanner2 && (
          <PromoBanner
            image={promoBanner2.image}
            alt={promoBanner2.title}
            badge={promoBanner2.badge}
            highlightNote={promoBanner2.highlightNote}
            highlightedProduct={promoBanner2.highlightedProduct}
            title={promoBanner2.title}
            description={promoBanner2.description}
            ctaLabel={promoBanner2.ctaLabel}
            ctaTo={promoBanner2.ctaTo}
            align={promoBanner2.align}
          />
        )}

        {/* Category: GULOSEIMAS */}
        {categorized.guloseimas.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <Link to="/mercado?q=guloseimas" className="cursor-pointer hover:opacity-80 transition-opacity">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-[#231F20]">
              <Candy size={22} className="text-[#5D082A]" /> Guloseimas & Snacks
            </h3>
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
             {categorized.guloseimas.map(product => (
               <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
             ))}
          </div>
        </section>
        )}

        {promoBanner3 && (
          <PromoBanner
            image={promoBanner3.image}
            alt={promoBanner3.title}
            badge={promoBanner3.badge}
            highlightNote={promoBanner3.highlightNote}
            highlightedProduct={promoBanner3.highlightedProduct}
            title={promoBanner3.title}
            description={promoBanner3.description}
            ctaLabel={promoBanner3.ctaLabel}
            ctaTo={promoBanner3.ctaTo}
            align={promoBanner3.align}
          />
        )}

          {/* General Grid */}
          <section className="pt-8">
             <h3 className="text-xl font-bold text-[#5d4f33] flex items-center gap-2 mb-8 border-b pb-4">
               <ShoppingBag size={20} className="text-[#5D082A]" /> Tudo do Mercado
             </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
               {categorized.outros.map(product => (
                 <StoreProductCard key={product.id} product={product} source="HOME" variant="grid" />
               ))}
               {categorized.bebidas.map(product => (
                 <StoreProductCard key={product.id} product={product} source="HOME" variant="grid" />
               ))}
            </div>
         </section>
      </main>

      {/* ── MOBILE Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-xl">
        <div className="grid grid-cols-5 h-16">
          <Link to="/" className="flex flex-col items-center justify-center gap-0.5 text-[#5D082A] cursor-pointer">
            <HomeIcon size={21} className="fill-[#5D082A]" />
            <span className="text-[10px] font-semibold">Home</span>
          </Link>
          <Link to="/mercado" className="flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-[#5D082A] transition-colors cursor-pointer">
            <Search size={21} />
            <span className="text-[10px] font-medium">Buscar</span>
          </Link>
          <Link to="/promocoes" className="flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-[#5D082A] transition-colors cursor-pointer">
            <Flame size={21} />
            <span className="text-[10px] font-medium">Promos</span>
          </Link>
          <Link to="/cart" className="flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-[#5D082A] transition-colors relative cursor-pointer">
            <ShoppingCart size={21} />
            {count > 0 && (
              <span className="absolute top-2 right-4 bg-[#5D082A] text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
            )}
            {freeShipping.enabled && freeShipping.achieved && (
              <span className="absolute top-1.5 right-3 bg-emerald-500 rounded-full w-2.5 h-2.5 border-2 border-white" />
            )}
            <span className="text-[10px] font-medium">Carrinho</span>
          </Link>
          <Link to={user ? '/account' : '/login'} className="flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-[#5D082A] transition-colors cursor-pointer">
            <User size={21} />
            <span className="text-[10px] font-medium">{user ? 'Conta' : 'Entrar'}</span>
          </Link>
        </div>
      </nav>

      {/* Mobile bottom padding para não tapar conteúdo com nav */}
      <div className="md:hidden h-16" />
    </div>
  )
}

function MobileProductShelf({
  title,
  subtitle,
  icon: Icon,
  products,
  to,
  linkLabel,
  scrollRef,
}: {
  title: string
  subtitle: string
  icon: React.ComponentType<any>
  products: Product[]
  to: string
  linkLabel: string
  scrollRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <section className="md:hidden px-4 pt-5 pb-2">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <span className="block text-[10px] uppercase tracking-widest text-[#8A6A3A] font-bold">{subtitle}</span>
          <h2 className="text-base font-bold text-[#231F20] flex items-center gap-2">
            <Icon size={18} className="text-[#5D082A]" />
            <span className="truncate">{title}</span>
          </h2>
        </div>
        <Link to={to} className="shrink-0 text-xs text-[#5D082A] font-semibold flex items-center gap-0.5">
          {linkLabel} <ArrowRight size={13} />
        </Link>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x -mx-4 px-4">
        {products.map(product => (
          <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
        ))}
      </div>
    </section>
  )
}

function DesktopIntentShelf({
  eyebrow,
  title,
  icon: Icon,
  products,
  to,
}: {
  eyebrow: string
  title: string
  icon: React.ComponentType<any>
  products: Product[]
  to: string
}) {
  return (
    <section className="fade-in-section min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-[#8A6A3A] font-bold">{eyebrow}</span>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-[#231F20]">
            <Icon size={20} className="shrink-0 text-[#5D082A]" />
            <span className="truncate">{title}</span>
          </h2>
        </div>
        <Link to={to} className="shrink-0 text-xs text-[#5D082A] font-bold hover:underline">
          Ver
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map(product => (
          <StoreProductCard key={product.id} product={product} source="HOME" variant="grid" />
        ))}
      </div>
    </section>
  )
}

function PromoBanner({
  image,
  alt,
  badge,
  highlightNote,
  highlightedProduct,
  title,
  description,
  ctaLabel,
  ctaTo,
  align = 'left',
}: {
  image: string
  alt: string
  badge?: string
  highlightNote?: string
  highlightedProduct?: Product
  title: string
  description?: string
  ctaLabel?: string
  ctaTo?: string
  align?: 'left' | 'right'
}) {
  return (
    <section className="fade-in-section">
      <div className={surfaceClasses({ tone: 'warm', className: 'relative min-h-[260px] overflow-hidden bg-[#F7F0E4] md:min-h-[320px]' })}>
        <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#231F20]/82 via-[#231F20]/45 to-transparent" />
        <div className={`relative z-10 flex h-full items-end p-6 md:p-8 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>
          <div className="max-w-lg space-y-3">
            {badge && (
              <Badge tone="gold" className="h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                {badge}
              </Badge>
            )}
            <h3 className="text-2xl font-bold text-white md:text-4xl luxury-text">{title}</h3>
            {description && <p className="text-sm leading-relaxed text-white/85 md:text-base">{description}</p>}
            {highlightedProduct && (
              <div className="rounded-lg border border-white/30 bg-white/85 p-3 text-left shadow-xl backdrop-blur-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5D082A]">Produto Exaltado</p>
                <p className="mt-1 text-sm font-bold text-[#231F20]">{highlightedProduct.name}</p>
                {highlightNote && <p className="mt-1 text-xs text-[#5D082A]">{highlightNote}</p>}
                <Link
                  to={`/mercado?q=${encodeURIComponent(highlightedProduct.name)}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#5D082A] hover:underline"
                >
                  Ver item <ArrowRight size={12} />
                </Link>
              </div>
            )}
            {ctaLabel && ctaTo && (
              <Link to={ctaTo} className={buttonVariants({ variant: 'outline', size: 'lg', className: 'border-white bg-white text-sm font-bold text-[#5D082A] hover:bg-[#F3E7C9]' })}>
                {ctaLabel}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
