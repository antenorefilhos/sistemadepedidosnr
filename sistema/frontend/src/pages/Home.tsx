import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useHomeShelves } from '../hooks/useHomeShelves'
import {
  CATEGORY_ICONS,
  getCategoryHref,
  resolveBannerLink,
  buildOverlayGradient,
  buildOverlaySolid,
} from '../utils/homeCategories'
import { useProducts, useCart, useRebuyRecommendations, useRecommendationShowcase } from '../hooks/useCart'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useAuth } from '../hooks/useAuth'
import { useCommercialTaxonomy, useStoreBanners, useTopSellingProducts, usePromotionCampaigns, type StoreBannerCMS } from '../hooks/useCMS'
import { HeroSlider, type HeroSlideCMS } from '../components/HeroSlider'
import { useDeliveryAddress } from '../hooks/useDeliveryAddress'
import { useDeliveryOperation } from '../hooks/useDeliveryOperation'
import { useBrand } from '../hooks/useBrand'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { useQuery } from '@tanstack/react-query'
import { resolveApiUrl, productsAPI, cmsAPI } from '../services/api'
import type { Product } from '../types'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductShelf } from '../components/ProductShelf'
import { SkeletonCard, SkeletonHero } from '../components/Skeleton'
import { trackEvent } from '../utils/analytics'
import {
  Search, ShoppingCart, User, ArrowRight, Sparkles, MapPin, Clock,
  Apple, Croissant, Beef, Flame, Candy, Pizza, ShoppingBag, MessageCircle, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO, StructuredData } from '../components/SEO'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { Footer } from '../components/Footer'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

type PromoBannerView = {
  id?: string
  title: string
  badge?: string
  highlightNote?: string
  highlightedProduct?: Product
  description?: string
  image: string
  ctaLabel?: string
  ctaTo?: string
  align?: 'left' | 'right'
  overlayColor?: string
  validUntil?: string
  sponsorName?: string
}

// dd/mm -- o ano so importa se a vigencia passar de 1 ano, o que nao e o
// caso de encarte (dura dias/semanas), entao fica fora pra nao poluir o badge.
const formatValidUntil = (isoDate: string) => {
  const date = new Date(isoDate)
  return `Válido até ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

export default function Home() {
  const navigate = useNavigate()
  const touchStartX = useRef(0)
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const scrollCategories = useCallback((direction: 'left' | 'right') => {
    const el = categoryScrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' })
  }, [])
  const prefersReducedMotion = usePrefersReducedMotion()
  // Monta apenas a arvore do viewport atual (mobile OU desktop) em vez de
  // renderizar as duas e esconder uma com CSS — evita ~2x cards no DOM.
  const isDesktop = useIsDesktop()

  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: storeBanners } = useStoreBanners()
  const { data: promotionCampaigns } = usePromotionCampaigns()
  const highlightedCampaign = useMemo(
    () => (promotionCampaigns || []).find((c) => c.highlightInHome && c.items.length > 0),
    [promotionCampaigns],
  )
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
  // Endpoint dedicado (nao pagina em 80 como o catalogo geral) -- sem isso a
  // vitrine "Ofertas para hoje" so via as promocoes que por acaso caissem na
  // primeira pagina alfabetica de ~2500 produtos, quase nunca acontecia com
  // o catalogo real (funcionava "sempre" local so porque o catalogo de teste
  // e pequeno o bastante pra caber inteiro numa pagina).
  const { data: promotionalProducts = [] } = useQuery({
    queryKey: ['products-promotions-home'],
    queryFn: async () => (await productsAPI.getPromotions()).data as Product[],
    staleTime: 1000 * 60 * 5,
  })

  const productsList = (products || []) as Product[]

  // Fonte unica pro carrossel hero: StoreBanner slot=hero (unifica o que
  // antes vinha de HeroSlide -- ver TASK_DEV_SPRINT_ADMIN_SEARCH_BANNERS_SOLIDCOM_ENCARTES.md).
  const activeHeroSlides = useMemo<HeroSlideCMS[]>(
    () =>
      (storeBanners || [])
        .filter((item) => item.active !== false && item.slot === 'hero' && item.desktopImageUrl)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((item) => ({
          id: item.id,
          title: item.title || item.name || 'Destaque',
          tag: item.badgeText || undefined,
          description: item.description || undefined,
          ctaLabel: item.ctaLabel || undefined,
          imageUrl: resolveApiUrl(item.desktopImageUrl),
          link: resolveBannerLink(item.linkValue, item.linkType),
          sponsorName: item.sponsorName || undefined,
          active: item.active,
          order: item.order,
        })),
    [storeBanners],
  )

  const handleHeaderAddressClick = useCallback(() => {
    openDeliveryVerificationModal()
  }, [openDeliveryVerificationModal])

  const handleHeaderAddressTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault() // bloqueia ghost click do iOS
    openDeliveryVerificationModal()
  }, [openDeliveryVerificationModal])

  // Busca da Home: leva para /mercado com o termo ja aplicado (a pagina de
  // busca le ?q=). Campo real e focavel por teclado; sem termo, so abre o mercado.
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const query = String(new FormData(e.currentTarget).get('q') || '').trim()
    navigate(query ? `/mercado?q=${encodeURIComponent(query)}` : '/mercado')
  }, [navigate])

  const {
    categorized,
    homeCategories,
    featuredCommercialSection,
    bestSellers,
    rebuyShelf,
    offersShelf,
    freshShelf,
    fairShelf,
    churrascoOccasionShelf,
    recurringShelf,
  } = useHomeShelves({
    productsList,
    cmsCategories,
    topSellingProducts,
    rebuyProducts,
    marginShowcase,
    promotionalProducts,
  })

  // Vitrines de intencao do grid desktop (xl:grid-cols-3). Filtra vazias ANTES de
  // renderizar: ProductShelf ja retorna null sem produto, mas a celula do grid so
  // deixa de existir de fato quando a vitrine nunca entra no array — e o wrapper
  // some por inteiro (sem margem de space-y sobrando) se todas estiverem vazias.
  const intentShelves = useMemo(() => ([
    {
      key: 'rebuy',
      eyebrow: user ? 'Historico de compra' : 'Compra recorrente',
      title: user ? 'Recompre em poucos cliques' : 'Mais fáceis de repetir',
      icon: ShoppingCart,
      products: rebuyShelf.slice(0, 6),
      to: '/mercado',
    },
    {
      key: 'offers',
      eyebrow: 'Ofertas e oportunidade',
      title: 'Melhores escolhas de hoje',
      icon: Sparkles,
      products: offersShelf.slice(0, 6),
      to: '/promocoes',
    },
    {
      key: 'fresh',
      eyebrow: 'Frescos e balcão',
      title: 'Para levar fresco agora',
      icon: Apple,
      products: freshShelf.slice(0, 6),
      to: '/mercado?cat=hortifruti',
    },
    {
      key: 'churrasco',
      eyebrow: 'Ocasião pronta',
      title: 'Churrasco sem garimpo',
      icon: Flame,
      products: churrascoOccasionShelf.slice(0, 6),
      to: '/mercado?q=churrasco',
    },
    {
      key: 'fair',
      eyebrow: 'Feira e hortifruti',
      title: 'Reposição fresca da semana',
      icon: Apple,
      products: fairShelf.slice(0, 6),
      to: '/mercado?cat=hortifruti',
    },
    {
      key: 'recurring',
      eyebrow: 'Compra recorrente',
      title: 'Itens que sempre voltam',
      icon: ShoppingBag,
      products: recurringShelf.slice(0, 6),
      to: '/mercado?q=recorrentes',
    },
  ]).filter((shelf) => shelf.products.length > 0), [
    user, rebuyShelf, offersShelf, freshShelf, churrascoOccasionShelf, fairShelf, recurringShelf,
  ])

  const [currentSlide, setCurrentSlide] = useState(0)
  // Tarja/popup fechados ficam fechados so pela sessao (sessionStorage) --
  // reaparecem na proxima visita, diferente de um "nunca mais mostrar" perene.
  const [tarjaDismissedIds, setTarjaDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('tarja-dismissed') || '[]')
    } catch {
      return []
    }
  })
  const [popupDismissedIds, setPopupDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('popup-dismissed') || '[]')
    } catch {
      return []
    }
  })
  const [popupVisible, setPopupVisible] = useState(false)

  const slides = useMemo(() => {
    if (!storeBanners || storeBanners.length === 0) return []

    const activeSlides = storeBanners
      .filter((item: StoreBannerCMS) => item.active !== false && item.slot === 'hero' && item.desktopImageUrl)
      .sort((a: StoreBannerCMS, b: StoreBannerCMS) => (a.order || 0) - (b.order || 0))

    return activeSlides.map((item: StoreBannerCMS) => ({
      id: item.id,
      title: item.title || item.name || 'Destaque',
      tag: 'Destaque',
      description: item.description || 'Ofertas e destaques escolhidos para facilitar sua compra e fazer render mais.',
      image: resolveApiUrl(item.desktopImageUrl),
      link: resolveBannerLink(item.linkValue, item.linkType),
      button: item.ctaLabel || 'Ver oferta',
    }))
  }, [storeBanners])

  // Fonte unica pros banners intercalados: StoreBanner slot=intercalado
  // (unifica o que antes vinha de PromoBanner).
  const promoBanners = useMemo<PromoBannerView[]>(() => {
    if (!Array.isArray(storeBanners) || storeBanners.length === 0) return []

    return storeBanners
      .filter((item) => item.active !== false && item.slot === 'intercalado' && item.desktopImageUrl)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((item) => ({
        id: item.id,
        title: item.title || item.name || 'Destaque',
        badge: item.badgeText || undefined,
        highlightNote: item.highlightNote || undefined,
        highlightedProduct: item.highlightedProduct || undefined,
        description: item.description || undefined,
        image: resolveApiUrl(item.desktopImageUrl),
        ctaLabel: item.ctaLabel || 'Aproveitar',
        ctaTo: resolveBannerLink(item.linkValue, item.linkType),
        align: item.align || 'left',
        overlayColor: item.overlayColor || undefined,
        validUntil: item.campaignEndDate ? formatValidUntil(item.campaignEndDate) : undefined,
        sponsorName: item.sponsorName || undefined,
      }))
  }, [storeBanners])

  // Tarja informativa (slot=tarja) -- so o primeiro banner ativo, exibido
  // como faixa fina no topo da pagina. Vinha sendo cadastrado no admin desde
  // a unificacao dos banners mas nunca teve consumidor no storefront.
  const tarjaBanner = useMemo<PromoBannerView | undefined>(() => {
    if (!Array.isArray(storeBanners) || storeBanners.length === 0) return undefined
    const item = storeBanners
      .filter((b) => b.active !== false && b.slot === 'tarja' && b.desktopImageUrl)
      .sort((a, b) => (a.order || 0) - (b.order || 0))[0]
    if (!item) return undefined
    return {
      id: item.id,
      title: item.title || item.name || 'Aviso',
      badge: item.badgeText || undefined,
      description: item.description || undefined,
      image: resolveApiUrl(item.desktopImageUrl),
      ctaLabel: item.ctaLabel || undefined,
      ctaTo: resolveBannerLink(item.linkValue, item.linkType),
      overlayColor: item.overlayColor || undefined,
      sponsorName: item.sponsorName || undefined,
    }
  }, [storeBanners])

  // Popup (slot=popup) -- so o primeiro banner ativo, mesmo mecanismo de
  // "so o primeiro" e mesmo gap de nunca ter tido consumidor no storefront.
  const popupBanner = useMemo<PromoBannerView | undefined>(() => {
    if (!Array.isArray(storeBanners) || storeBanners.length === 0) return undefined
    const item = storeBanners
      .filter((b) => b.active !== false && b.slot === 'popup' && b.desktopImageUrl)
      .sort((a, b) => (a.order || 0) - (b.order || 0))[0]
    if (!item) return undefined
    return {
      id: item.id,
      title: item.title || item.name || 'Oferta especial',
      badge: item.badgeText || undefined,
      description: item.description || undefined,
      image: resolveApiUrl(item.desktopImageUrl),
      ctaLabel: item.ctaLabel || 'Aproveitar',
      ctaTo: resolveBannerLink(item.linkValue, item.linkType),
      overlayColor: item.overlayColor || undefined,
      sponsorName: item.sponsorName || undefined,
    }
  }, [storeBanners])

  // Banners intercalados (slot=intercalado, geridos em Loja > Banners),
  // agrupados em pares e distribuidos entre as prateleiras de produto -- em
  // vez de amontoados no topo/fim da pagina. Mesmo array usado no desktop
  // (lado a lado, md:grid-cols-2) e no mobile (carrossel horizontal com snap,
  // ver PromoBannerPair).
  const promoPairs = useMemo(() => {
    const pairs: PromoBannerView[][] = []
    for (let i = 0; i < promoBanners.length; i += 2) {
      pairs.push(promoBanners.slice(i, i + 2))
    }
    return pairs
  }, [promoBanners])

  // Garante que o primeiro banner intercalado do mobile NUNCA apareca colado
  // direto no Hero: rebuyShelf (sem historico) e highlightedCampaign (sem
  // encarte em destaque) costumam vir vazios ao mesmo tempo, e offersShelf
  // pode teoricamente vir vazio tambem (loja sem promocao ativa). Nesse caso
  // raro, pula o 1o par de banners no mobile -- ele reaparece mais adiante,
  // ja com freshShelf (catalogo geral, praticamente sempre populado) antes.
  const hasMobileLeadContent = rebuyShelf.length > 0 || Boolean(highlightedCampaign) || offersShelf.length > 0

  // Ponto de ajuda/contato da Home (heuristica "ajuda e documentacao": a Home nao
  // tinha nenhum contato). Reaproveita o mesmo padrao ja usado em Account.tsx:
  // contactWhatsapp do CMS (Admin > Marca), com fallback para VITE_CONTACT_WHATSAPP.
  const whatsappHelpUrl = useMemo(() => {
    const digits = (brand.contactWhatsapp || import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '')
    const message = encodeURIComponent('Olá! Preciso de ajuda com meu pedido no site.')
    // TODO: numero real do WhatsApp — nao configurado hoje em contactWhatsapp (Admin >
    // Marca) nem em VITE_CONTACT_WHATSAPP (.env). Assim que houver um numero, o link
    // passa a funcionar sozinho; ate la aponta para um placeholder inerte.
    return digits ? `https://wa.me/${digits}?text=${message}` : '#whatsapp-nao-configurado'
  }, [brand.contactWhatsapp])

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'HOME', 'General')
  }, [])

  // Popup abre com um pequeno delay (nao trava o primeiro paint nem parece
  // intrusivo abrindo instantaneo) e so se ainda nao foi fechado nesta sessao.
  useEffect(() => {
    if (!popupBanner?.id || popupDismissedIds.includes(popupBanner.id)) return
    const timer = window.setTimeout(() => setPopupVisible(true), 1500)
    return () => window.clearTimeout(timer)
  }, [popupBanner?.id, popupDismissedIds])

  const dismissTarja = useCallback((id: string) => {
    setTarjaDismissedIds((prev) => {
      const next = [...prev, id]
      sessionStorage.setItem('tarja-dismissed', JSON.stringify(next))
      return next
    })
  }, [])

  const dismissPopup = useCallback((id: string) => {
    setPopupVisible(false)
    setPopupDismissedIds((prev) => {
      const next = [...prev, id]
      sessionStorage.setItem('popup-dismissed', JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    if (slides.length <= 1 || prefersReducedMotion) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [slides.length, prefersReducedMotion])

  // Schema.org Data
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": brand.storeName || "Antenor & Filhos",
    "description": "Qualidade, Tradição e Elegância. Açougue, Adega e Padaria Artesanal.",
    "url": window.location.origin,
    "logo": `${window.location.origin}/branding/logo-bordo.png`,
  }

  if (productsLoading && !productsList.length) {
    return (
      <div className="min-h-screen bg-white">
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
    <div className="min-h-screen bg-white">
      <SEO 
        title={`${brand.storeName} - mercado online, acougue, padaria e adega`}
        description="Carnes selecionadas, vinhos que impressionam e pão fresquinho. Tudo que você precisa para comprar bem e comer melhor."
        canonical="/"
      />
      <StructuredData data={organizationSchema} />
      <h1 className="sr-only">
        {brand.storeName} - mercado online com acougue, padaria, adega e ofertas
      </h1>

      {tarjaBanner && !tarjaDismissedIds.includes(tarjaBanner.id || '') && (
        <TarjaStrip banner={tarjaBanner} onDismiss={() => tarjaBanner.id && dismissTarja(tarjaBanner.id)} />
      )}

      {popupBanner && popupVisible && (
        <PopupBanner banner={popupBanner} onDismiss={() => popupBanner.id && dismissPopup(popupBanner.id)} />
      )}

      {/* ── MOBILE HEADER (< md) ── */}
      {!isDesktop && (
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
                  {deliveryAddressLabel || 'Escolher endereço de entrega'}
                </span>
              </span>
            </Button>
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/cart" className="relative p-1.5" aria-label={`Carrinho com ${count} itens`}>
                <ShoppingCart size={22} className="text-white" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#D2BB8A] text-[#5D082A] text-label font-black rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
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
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-3 bg-white rounded-lg px-4 h-11 focus-within:ring-2 focus-within:ring-[#D2BB8A]"
          >
            <button type="submit" aria-label="Buscar" className="shrink-0 text-[#5D082A]">
              <Search size={16} />
            </button>
            <input
              type="search"
              name="q"
              aria-label="Buscar produto"
              placeholder="Buscar produto aqui..."
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#231F20] outline-none placeholder:text-[#6B7280]"
            />
          </form>
        </div>
        {/* Mobile Category Chips */}
        {homeCategories.length > 0 && (
          <div className="bg-white border-b border-gray-100 px-4">
            <div
              className="flex overflow-x-auto no-scrollbar py-3 gap-3 snap-x"
              style={{ touchAction: 'pan-x' }}
            >
              {homeCategories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.id] || CATEGORY_ICONS.default
                return (
                  <Link
                    key={category.id}
                    to={getCategoryHref(category)}
                    style={{ touchAction: 'manipulation' }}
                    className="snap-start shrink-0 flex flex-col items-center gap-1 min-w-[64px] text-center cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#F3ECE0] flex items-center justify-center border border-[#E8D7B0]/60 text-[#5D082A] group-active:scale-95 transition-transform duration-150">
                      <IconComponent size={24} strokeWidth={1.8} />
                    </div>
                    <span className="text-label font-semibold text-[#231F20] leading-tight line-clamp-2">{category.shortLabel}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>
      )}

      {/* ── DESKTOP TOP BAR + HEADER (md+) ── */}
      {isDesktop && (
      <div className="hidden md:block sticky top-0 z-50">
        <div className="bg-[#F8F4EA] border-b border-[#D2BB8A]/30">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
            <Button
              type="button"
              onClick={handleHeaderAddressClick}
              variant="outline"
              size="sm"
              className="h-8 max-w-full justify-start bg-white/70 px-3 py-1 text-caption text-[#5d4f33] hover:bg-white"
            >
              <MapPin size={14} className="shrink-0 text-[#5D082A]" />
              <span className="truncate">
                {deliveryAddressLabel || 'Escolher endereço de entrega'}
              </span>
            </Button>
            <div className={`inline-flex h-8 max-w-full items-center gap-2 rounded-lg border px-3 text-caption ${deliveryOperation.isOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#D2BB8A]/60 bg-[#FBFAF7] text-[#5d4f33]'}`}>
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
          
            <form
              role="search"
              onSubmit={handleSearchSubmit}
              className="mx-6 flex h-10 flex-1 items-center gap-2 rounded-lg border border-[#D2BB8A]/50 bg-white/95 px-4 transition-colors focus-within:border-[#D2BB8A] focus-within:ring-2 focus-within:ring-[#D2BB8A]/40"
            >
              <button type="submit" aria-label="Buscar" className="shrink-0 text-[#5D082A]">
                <Search size={16} />
              </button>
              <input
                type="search"
                name="q"
                aria-label="Buscar produto"
                placeholder="Buscar produto aqui..."
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#231F20] outline-none placeholder:text-[#6B7280]"
              />
            </form>
          
            <div className="flex items-center gap-4">
            <Link to="/cart" className="relative p-2 text-white hover:text-[#D2BB8A] transition-colors" aria-label={`Carrinho com ${count} itens`}>
              <ShoppingCart size={24} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D2BB8A] text-[#5D082A] text-label font-bold rounded-full w-4 h-4 flex items-center justify-center">
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
      )}

      {/* Hero Slider — escondido no mobile, substituído pela seção Popular */}
      {isDesktop && slides.length > 0 && <div
        className="hidden md:block relative h-[420px] sm:h-[520px] md:h-[620px] overflow-hidden bg-[#231F20]"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (diff > 50) setCurrentSlide((prev) => (prev + 1) % slides.length)
          else if (diff < -50) setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
        }}
      >
            {slides.map((slide: { id?: string; title: string; tag?: string; description?: string; button?: string; image?: string; link?: string }, index: number) => (
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
                  {slide.link && <Link
                    to={slide.link}
                    onClick={() => { if (slide.id) cmsAPI.storeBanners.registerClick(slide.id).catch(() => {}) }}
                    className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto text-sm sm:text-base' })}
                  >
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
      {isDesktop && homeCategories.length > 0 && (
        <div className="hidden md:block border-b border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 relative group/cats">
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              aria-label="Categorias anteriores"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-[#5D082A] opacity-0 group-hover/cats:opacity-100 transition-opacity hover:bg-[#FBF7F0] disabled:opacity-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div ref={categoryScrollRef} className="flex overflow-x-auto no-scrollbar py-3 px-1 gap-3 snap-x scroll-smooth">
              {homeCategories.map((category) => {
                const IconComponent = CATEGORY_ICONS[category.id] || CATEGORY_ICONS.default
                return (
                  <Link
                    key={category.id}
                    to={getCategoryHref(category)}
                    className="snap-start shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg bg-[#FBF7F0] border border-[#E8D7B0]/40 hover:bg-[#F3E7C9] hover:border-[#D2BB8A] hover:scale-105 transition-all duration-200 min-w-[90px] text-center group cursor-pointer"
                  >
                    <IconComponent size={20} className="text-[#5D082A] group-hover:scale-110 transition-transform duration-200" strokeWidth={1.8} />
                    <span className="text-caption font-semibold text-[#5d4f33] group-hover:text-[#5D082A] transition-colors leading-tight line-clamp-2 whitespace-pre-wrap">
                      {category.shortLabel}
                    </span>
                  </Link>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              aria-label="Próximas categorias"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-[#5D082A] opacity-0 group-hover/cats:opacity-100 transition-opacity hover:bg-[#FBF7F0]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE MAIN — vitrines de intencao ── */}
      {!isDesktop && (
      <>
      {/* Hero primeiro: e a vitrine de entrada, nao faz sentido enterrada
          depois de 7 prateleiras de produto. */}
      {activeHeroSlides.length > 0 ? (
        <section className="md:hidden mx-4 mt-4 mb-4">
          <HeroSlider slides={activeHeroSlides} />
        </section>
      ) : featuredCommercialSection && (
        <section className="md:hidden mx-4 mt-4 mb-4">
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

      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title={user ? 'Recomprar rapidinho' : 'Atalhos para repetir'}
        eyebrow={user ? 'Histórico do cliente' : 'Mais pedidos da loja'}
        icon={ShoppingCart}
        products={rebuyShelf}
        to="/mercado"
        linkLabel="Ver mais"
      />

      {highlightedCampaign && (
        <ProductShelf
          className="md:hidden px-4 pt-5 pb-2"
          title={highlightedCampaign.name}
          eyebrow="Encarte da semana"
          icon={Sparkles}
          products={highlightedCampaign.items}
          to="/promocoes"
          linkLabel="Ver encarte"
        />
      )}

      {/* "Ofertas para hoje" fica ANTES do primeiro banner de proposito: rebuyShelf
          e highlightedCampaign acima costumam vir vazios (sem historico/sem
          encarte em destaque), e sem uma vitrine real aqui o Hero ficava colado
          direto no banner intercalado -- 2-3 banners empilhados sem nenhum
          produto entre eles antes do usuario ver qualquer coisa pra comprar. */}
      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title="Ofertas para hoje"
        eyebrow="Preco e margem"
        icon={Sparkles}
        products={offersShelf}
        to="/promocoes"
        linkLabel="Promos"
      />

      {/* Banners intercalados: espalhados em pares entre as vitrines em vez
          de bunched num carrossel unico -- da o respiro visual que chama
          atencao enquanto o cliente rola a pagina. hasMobileLeadContent
          garante que este 1o par nunca fique colado direto no Hero. */}
      {hasMobileLeadContent && <PromoBannerPair banners={promoPairs[0]} className="md:hidden mx-4 mb-4" />}

      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title="Frescos da loja"
        eyebrow="Açougue e padaria"
        icon={Apple}
        products={freshShelf}
        to="/mercado?cat=hortifruti"
        linkLabel="Ver frescos"
      />

      <PromoBannerPair banners={promoPairs[1]} className="md:hidden mx-4 mb-4" />

      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title="Feira da semana"
        eyebrow="Hortifruti e frescos"
        icon={Apple}
        products={fairShelf}
        to="/mercado?cat=hortifruti"
        linkLabel="Ver feira"
      />

      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title="Recorrentes da casa"
        eyebrow="Itens que sempre voltam"
        icon={ShoppingBag}
        products={recurringShelf}
        to="/mercado?q=recorrentes"
        linkLabel="Ver itens"
      />

      <PromoBannerPair banners={promoPairs[2]} className="md:hidden mx-4 mb-4" />

      <ProductShelf
        className="md:hidden px-4 pt-5 pb-2"
        title="Mais Pedidos"
        eyebrow="Dados de pedidos"
        icon={Sparkles}
        products={bestSellers}
        to="/mercado"
        linkLabel="Ver todos"
      />

      {/* Mobile — Mais seções de produto */}
      <ProductShelf
        className="md:hidden px-4 pb-2"
        title="Churrasco e ocasião"
        eyebrow="Ocasião pronta"
        icon={Flame}
        products={churrascoOccasionShelf}
        to="/mercado?q=churrasco"
        linkLabel="Ver todos"
      />

      <ProductShelf
        className="md:hidden px-4 pb-2"
        title="Padaria & Pães Artesanais"
        eyebrow="Forno da casa"
        icon={Croissant}
        products={categorized.padaria}
        to="/mercado?q=padaria"
        linkLabel="Ver todos"
      />

      <ProductShelf
        className="md:hidden px-4 pb-2"
        title="Tudo do Mercado"
        eyebrow="Catálogo completo"
        icon={ShoppingBag}
        products={[...categorized.outros, ...categorized.bebidas].slice(0, 12)}
        to="/mercado"
        linkLabel="Ver todos"
      />
      </>
      )}

      {/* ── DESKTOP MAIN ── */}
      {isDesktop && (
      <main className="hidden md:block max-w-7xl mx-auto px-4 py-8 space-y-12 pb-24">
        
        {/* Hero principal ja aparece na tira do topo (StoreBanner slot=hero,
            logo abaixo do header) -- este bloco so cobre a ausencia dele. */}
        {slides.length === 0 && featuredCommercialSection && (
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

        {/* Vitrine 1: recompra/ofertas/frescos/churrasco/feira/recorrentes */}
        {intentShelves.length > 0 && (
        <div className="space-y-10">
          {intentShelves.map((shelf) => (
            <ProductShelf
              key={shelf.key}
              layout="carousel"
              eyebrow={shelf.eyebrow}
              title={shelf.title}
              icon={shelf.icon}
              products={shelf.products}
              to={shelf.to}
            />
          ))}
        </div>
        )}

        {/* Par de banners 1 */}
        <PromoBannerPair banners={promoPairs[0]} />

        {/* Vitrine 2: mais vendidos */}
        {bestSellers.length > 0 && (
        <section className="fade-in-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <span className="text-label uppercase tracking-widest text-[#8A6A3A] font-bold">Dados de pedidos</span>
              <h3 className="text-3xl font-bold luxury-text flex items-center gap-2 text-[#231F20]">
                <Sparkles size={24} className="text-[#5D082A]" /> Mais Vendidos
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
              <span className="text-label uppercase tracking-widest text-[#8A6A3A] font-bold">Especialidade da Casa</span>
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

        {/* Vitrine 3: churrasco, padaria, carnes e consumo rapido */}
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

        {/* Par de banners 2 */}
        <PromoBannerPair banners={promoPairs[1]} />

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

        {/* Par de banners 3 */}
        <PromoBannerPair banners={promoPairs[2]} />

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
      )}

      {/* ── Ajuda / contato — discreto, aponta para o WhatsApp da loja ── */}
      <section className="px-4 py-6 md:px-0">
        <div className="md:max-w-7xl md:mx-auto">
          <a
            href={whatsappHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#D2BB8A]/40 bg-[#F8F4EA] px-4 py-3 text-caption font-semibold text-[#5D082A] transition-colors hover:bg-[#F3E7C9]"
          >
            <MessageCircle size={16} className="shrink-0" />
            Precisa de ajuda? Fale com a gente no WhatsApp
          </a>
        </div>
      </section>

      <Footer />

      {/* ── MOBILE Bottom Navigation ── */}
      {!isDesktop && (
      <>
      <MobileBottomNav />
      </>
      )}
    </div>
  )
}

/**
 * Faixa fina no topo da pagina (slot=tarja) -- avisos tipo "frete gratis
 * acima de X" ou regras da loja. Tinta uniforme (buildOverlaySolid) em vez
 * do gradiente diagonal do PromoBanner: o conteudo aqui se espalha pela
 * largura toda, um fade lateral deixaria o texto do lado direito ilegivel.
 */
function TarjaStrip({ banner, onDismiss }: { banner: PromoBannerView; onDismiss: () => void }) {
  const handleCtaClick = () => {
    if (banner.id) cmsAPI.storeBanners.registerClick(banner.id).catch(() => {})
  }
  return (
    <div className="relative w-full overflow-hidden">
      <img src={banner.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0" style={{ background: buildOverlaySolid(banner.overlayColor || '#231F20') }} />
      <div className="relative z-10 mx-auto flex min-h-[52px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 md:min-h-[64px] md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {banner.badge && (
            <Badge tone="gold" className="hidden h-auto shrink-0 border-[#D2BB8A] bg-[#D2BB8A] px-2.5 py-1 text-[#231F20] sm:inline-flex">
              {banner.badge}
            </Badge>
          )}
          <p className="truncate text-sm font-semibold text-white md:text-base">{banner.title}</p>
          {banner.description && (
            <p className="hidden truncate text-xs text-white/80 md:block md:text-sm">{banner.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {banner.ctaLabel && banner.ctaTo && (
            <Link
              to={banner.ctaTo}
              onClick={handleCtaClick}
              className="whitespace-nowrap rounded-full border border-white bg-white/95 px-3 py-1 text-xs font-bold text-[#5D082A] hover:bg-white md:text-sm"
            >
              {banner.ctaLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar aviso"
            className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Popup (slot=popup) -- modal simples, sem lib de dialog externa (mesmo
 * padrao ja usado no admin StoreBannersManager.tsx: fixed inset-0 + backdrop
 * clicavel + fechar por X/Escape). Abre com delay (ver useEffect no Home) e
 * fica fechado pelo resto da sessao depois de dispensado.
 */
function PopupBanner({ banner, onDismiss }: { banner: PromoBannerView; onDismiss: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onDismiss])

  const handleCtaClick = () => {
    if (banner.id) cmsAPI.storeBanners.registerClick(banner.id).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-[#F7F0E4] shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <X size={16} />
        </button>
        <div className="relative aspect-[3/2] w-full">
          <img src={banner.image} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: buildOverlaySolid(banner.overlayColor || '#231F20', 0.35) }} />
        </div>
        <div className="space-y-2 p-5 text-left">
          {banner.badge && (
            <Badge tone="gold" className="h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
              {banner.badge}
            </Badge>
          )}
          <h3 className="text-xl font-bold text-[#231F20] luxury-text">{banner.title}</h3>
          {banner.description && <p className="text-sm text-[#5d4f33]">{banner.description}</p>}
          {banner.ctaLabel && banner.ctaTo && (
            <Link
              to={banner.ctaTo}
              onClick={handleCtaClick}
              className={buttonVariants({ variant: 'primary', size: 'lg', className: 'mt-2 w-full justify-center bg-[#5D082A] text-white hover:bg-[#7B1038]' })}
            >
              {banner.ctaLabel}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/** Par de banners intercalados -- lado a lado no desktop (md:grid-cols-2), empilhado no mobile. */
function PromoBannerPair({ banners, className }: { banners?: PromoBannerView[]; className?: string }) {
  if (!banners || banners.length === 0) return null
  // Mobile: carrossel horizontal com snap -- 2 banners empilhados verticalmente
  // (grid-cols-1) viravam uma parede de imagem gigante entre vitrines, sem
  // nenhum produto no meio. Desktop mantem o grid 2 colunas lado a lado de sempre.
  const single = banners.length === 1
  return (
    <div
      className={`flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 ${className || ''}`}
    >
      {banners.map((banner) => (
        <div
          key={banner.id}
          className={`shrink-0 snap-start md:w-auto md:shrink md:snap-align-none ${single ? 'w-full' : 'w-[78%] sm:w-[65%]'}`}
        >
          <PromoBanner
            image={banner.image}
            alt={banner.title}
            badge={banner.badge}
            highlightNote={banner.highlightNote}
            highlightedProduct={banner.highlightedProduct}
            title={banner.title}
            description={banner.description}
            ctaLabel={banner.ctaLabel}
            ctaTo={banner.ctaTo}
            align={banner.align}
            overlayColor={banner.overlayColor}
            validUntil={banner.validUntil}
            sponsorName={banner.sponsorName}
          />
        </div>
      ))}
    </div>
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
  overlayColor,
  validUntil,
  sponsorName,
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
  overlayColor?: string
  validUntil?: string
  sponsorName?: string
}) {
  const tone = overlayColor || '#231F20'
  return (
    <section className="fade-in-section">
      <div className={surfaceClasses({ tone: 'warm', className: 'relative min-h-[260px] overflow-hidden bg-[#F7F0E4] md:min-h-[320px]' })}>
        <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div
          className="absolute inset-0"
          style={{ background: buildOverlayGradient(tone) }}
        />
        {sponsorName && (
          <span className="absolute right-3 top-3 z-10 rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            Patrocinado por {sponsorName}
          </span>
        )}
        <div className={`relative z-10 flex h-full items-end p-6 md:p-8 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>
          <div className="max-w-lg space-y-3">
            {(badge || validUntil) && (
              <div className="flex flex-wrap items-center gap-2">
                {badge && (
                  <Badge tone="gold" className="h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                    {badge}
                  </Badge>
                )}
                {validUntil && (
                  <Badge className="h-auto border-white/40 bg-black/30 px-3 py-1 text-white backdrop-blur-sm">
                    {validUntil}
                  </Badge>
                )}
              </div>
            )}
            <h3 className="text-2xl font-bold text-white md:text-4xl luxury-text">{title}</h3>
            {description && <p className="text-sm leading-relaxed text-white/85 md:text-base">{description}</p>}
            {highlightedProduct && (
              <div className="rounded-lg border border-white/30 bg-white/85 p-3 text-left shadow-xl backdrop-blur-sm">
                <p className="text-caption font-black uppercase tracking-[0.16em] text-[#5D082A]">Produto Exaltado</p>
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

