import { useProducts, useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useStoreBanners } from '../hooks/useCMS'
import { findWineCategoryBanner, resolveBannerLink } from '../utils/homeCategories'
import { PromoBanner } from '../components/PromoBanner'
import { resolveApiUrl } from '../services/api'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import type { Product } from '../types'
import { getProductPricePresentation } from '../utils/productPricing'
import { trackEvent } from '../utils/analytics'
import { ArrowLeft, ShoppingCart, Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useEffect, useState } from 'react'
import { SEO, StructuredData } from '../components/SEO'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

const normalizeUppercaseDisplayText = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return ''

  const letters = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []
  if (letters.length === 0) return text

  const upperCount = letters.filter((char) => char === char.toUpperCase()).length
  const upperRatio = upperCount / letters.length

  // Converte quando o texto vier predominantemente em caixa alta do ERP.
  if (upperRatio < 0.6) return text

  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatWineDescription = (value?: string | null) => {
  const normalized = normalizeUppercaseDisplayText(value)
  return normalized || 'Reserva Especial Antenor'
}

const formatWineTitle = (value?: string | null) => normalizeUppercaseDisplayText(value)

type WineSubcategory = 'all' | 'tinto' | 'branco' | 'rose' | 'suave' | 'espumante' | 'champagne'

const WINE_CATEGORIES: Array<{ key: WineSubcategory; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'tinto', label: 'Tintos' },
  { key: 'branco', label: 'Brancos' },
  { key: 'rose', label: 'Rosés' },
  { key: 'suave', label: 'Suaves' },
  { key: 'espumante', label: 'Espumantes' },
  { key: 'champagne', label: 'Champagne' },
]

const normalizeWineText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()

const filterWineByCategory = (wine: Product, subcat: WineSubcategory): boolean => {
  if (subcat === 'all') return true
  const normalized = normalizeWineText(`${wine.name} ${wine.alternativeDescription || ''}`)

  switch (subcat) {
    case 'tinto':
      return normalized.includes('TINTO')
    case 'branco':
      return normalized.includes('BRANCO') || normalized.includes('CHARDONNAY') || normalized.includes('SAUVIGNON BLANC')
    case 'rose':
      return normalized.includes('ROSE') || normalized.includes('ROSADO')
    case 'suave':
      return normalized.includes('SUAVE')
    case 'espumante':
      return normalized.includes('ESPUMANTE') || normalized.includes('PROSECCO') || normalized.includes('BRUT') || normalized.includes('MOSCATEL')
    case 'champagne':
      return normalized.includes('CHAMPAGNE') || normalized.includes('CHAMPANHE') || normalized.includes('CHANDON')
    default:
      return true
  }
}

export default function WinePage() {
  const { data: products, isLoading } = useProducts(undefined, 'ADEGA_VINHOS_ESPUMANTES')
  const { count } = useCart()
  const { user } = useAuth()
  // A Adega tem rota propria (/adega), sem ?cat= na URL, entao o banner e
  // achado pelo nome da categoria -- mesma regra que manda um banner de
  // categoria da Adega apontar pra ca (ver findWineCategoryBanner).
  const { data: storeBanners } = useStoreBanners()
  const wineBanner = useMemo(() => findWineCategoryBanner(storeBanners), [storeBanners])
  const [selectedSubcat, setSelectedSubcat] = useState<WineSubcategory>('all')

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'CATEGORY', 'VINHOS')
  }, [])

  const vinhos = useMemo(() => {
    return (products || []) as Product[]
  }, [products])

  const subcatCounts = useMemo(() => {
    const counts = new Map<WineSubcategory, number>()
    for (const cat of WINE_CATEGORIES) {
      counts.set(cat.key, cat.key === 'all' ? vinhos.length : vinhos.filter((w) => filterWineByCategory(w, cat.key)).length)
    }
    return counts
  }, [vinhos])

  const filteredVinhos = useMemo(
    () => vinhos.filter((wine) => filterWineByCategory(wine, selectedSubcat)),
    [vinhos, selectedSubcat],
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#231F20]">
        <Loader2 className="animate-spin text-[#D2BB8A]" size={48} />
      </div>
    )
  }

  // Schema for Breadcrumbs
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": window.location.origin
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Adega",
        "item": `${window.location.origin}/vinhos`
      }
    ]
  }

  return (
    <div className="min-h-screen bg-[#231F20] text-white">
      <SEO 
        title="Adega Antenor | Vinhos de Luxo" 
        description="Vinhos escolhidos para presentear, comemorar e surpreender. Descubra rótulos que valem a pena levar para casa."
      />
      <StructuredData data={breadcrumbSchema} />
      {/* Header Specialized -- glassmorphism escuro com acabamento dourado */}
      <header className="fixed top-0 w-full z-50 border-b border-[#D2BB8A]/20 bg-[#120e0e]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-[#D2BB8A] hover:scale-110 transition-transform" aria-label="Voltar para Home">
            <ArrowLeft size={24} />
          </Link>
          <div className="text-center flex-1">
             <h1 className="luxury-text text-xl font-extrabold tracking-[0.2em] uppercase bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-transparent">
               Adega Antenor & Filhos
             </h1>
             <p className="text-label font-normal text-[#D2BB8A]/60 -mt-1 tracking-widest uppercase">Since 1979</p>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/cart" className="relative p-2 text-[#D2BB8A]" aria-label={`Carrinho com ${count} itens`}>
              <ShoppingCart size={24} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-[#231F20] text-label font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>
            {user && (
              <div className="[&_[data-bell-trigger]]:text-[#D2BB8A] [&_[data-bell-trigger]]:hover:bg-white/10">
                <NotificationBell />
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Luxury Hero Section */}
        <section className="relative h-[60vh] flex items-end pb-12">
           <img 
             src="/banners/vinhos.png" 
             alt="Luxury Wine Selection - Adega Antenor & Filhos" 
             className="absolute inset-0 w-full h-full object-cover opacity-60" 
             loading="eager"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-[#231F20] via-transparent to-[#231F20]/30" />
           <div className="relative z-10 max-w-7xl mx-auto px-6 w-full fade-in-section">
              <span className="flex items-center gap-2 text-[#D2BB8A] text-xs font-bold tracking-widest uppercase mb-4">
                 <Sparkles size={14} /> Seleção Especial
              </span>
              <h2 className="text-4xl md:text-6xl font-medium tracking-tight leading-tight luxury-text mb-8 bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-transparent">Cada taça conta <br/>uma história</h2>
              <p className="max-w-lg text-white/70 text-sm italic leading-relaxed">
                Não é só vinho. É escolha, cuidado e sabor de verdade. Aqui você encontra rótulos para presentear bem ou aproveitar um momento especial.
              </p>
           </div>
        </section>

        {/* Wine Subcategory Filter */}
        <section className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2" role="group" aria-label="Filtrar por tipo de vinho">
            {WINE_CATEGORIES.map((cat) => {
              const isActive = selectedSubcat === cat.key
              const count = subcatCounts.get(cat.key) || 0
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedSubcat(cat.key)}
                  disabled={count === 0}
                  aria-pressed={isActive}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'border-[#D2BB8A] bg-[#D2BB8A] text-[#231F20]'
                      : count === 0
                        ? 'border-white/10 text-white/20 cursor-not-allowed'
                        : 'border-[#D2BB8A]/30 bg-[#1C1917] text-[#F3E7C9] hover:border-[#D2BB8A] hover:bg-[#D2BB8A]/10'
                  }`}
                >
                  {cat.label}
                  <span className={isActive ? 'text-[#231F20]/60' : 'text-[#D2BB8A]/50'}>({count})</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Banner de categoria (StoreBanner slot=category apontando pra Adega).
            Fica abaixo do hero e do filtro, nao no topo: o hero da Adega ja e
            a peca de identidade da pagina, e um segundo bloco grande logo
            acima dele disputaria a mesma atencao. Aqui ele le como destaque
            comercial dentro da Adega, antes dos rotulos. */}
        {wineBanner && (
          <section className="max-w-7xl mx-auto px-4 pt-8">
            <PromoBanner
              bannerId={wineBanner.id}
              image={resolveApiUrl(wineBanner.desktopImageUrl)}
              alt={wineBanner.title || wineBanner.name || 'Destaque da Adega'}
              badge={wineBanner.badgeText || undefined}
              title={wineBanner.title || wineBanner.name || 'Destaque'}
              description={wineBanner.description || undefined}
              ctaLabel={wineBanner.ctaLabel || undefined}
              ctaTo={resolveBannerLink(wineBanner.linkValue, wineBanner.linkType)}
              align={wineBanner.align || 'left'}
              overlayColor={wineBanner.overlayColor || undefined}
              sponsorName={wineBanner.sponsorName || undefined}
            />
          </section>
        )}

        {/* Wine Grid */}
        <section className="max-w-7xl mx-auto px-4 py-16">
          {filteredVinhos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <span className="text-4xl grayscale opacity-40">🍷</span>
              <p className="luxury-text text-lg text-[#D2BB8A]">Nenhum rótulo encontrado nesta categoria</p>
              <p className="text-sm text-white/40">Explore outra seleção ou volte para "Todos".</p>
              <Button
                onClick={() => setSelectedSubcat('all')}
                variant="ghost"
                className="mt-2 rounded-full border border-[#D2BB8A]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#D2BB8A] hover:bg-[#D2BB8A]/10"
              >
                Ver todos os vinhos
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {filteredVinhos.map((vinho) => (
                <WineCard key={vinho.id} product={vinho} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer exclusivo da Adega -- paleta mais escura que o resto da pagina, acabamento dourado nobre */}
      <footer className="border-t border-[#D2BB8A]/20 bg-[#1C1917]">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <p className="luxury-text text-3xl font-extrabold tracking-[0.15em] uppercase bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-transparent">
            Adega Antenor & Filhos
          </p>
          <p className="mt-2 text-label uppercase tracking-widest text-[#D2BB8A]/50">Desde 1979</p>
          <div className="mx-auto mt-6 h-px w-16 bg-[#D2BB8A]/30" />
          <p className="mt-6 text-sm text-white/40">
            Estrada União e Indústria, Pedro do Rio, Petrópolis - RJ
          </p>
          <Link to="/" className="mt-6 inline-block text-xs font-semibold uppercase tracking-widest text-[#D2BB8A] hover:underline">
            Voltar ao mercado
          </Link>
        </div>
      </footer>
      <MobileBottomNav />
    </div>
  )
}

const WINE_QUANTITY_STEPS = [1, 6, 12] as const
type WineQuantityStep = (typeof WINE_QUANTITY_STEPS)[number]

function WineCard({ product }: { product: Product }) {
  const { cart, addItem, removeItem, updateQuantity } = useCart()
  const cartItem = cart.find(item => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [step, setStep] = useState<WineQuantityStep>(1)

  const imageBaseUrl = `/uploads/products/${product.ean}`
  const imageCandidates = [`${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`]
    .map((url) => `${url}?v=2`)
  const imageUrl = imageCandidates[imageIndex]

  const handleDecrease = () => {
    if (quantity > step) {
      updateQuantity(product.id, quantity - step)
    } else {
      removeItem(product.id)
    }
  }

  const handleIncrease = () => {
    addItem(product, step)
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price })
  }

  const handleSelectStep = (nextStep: WineQuantityStep) => {
    setStep(nextStep)
    if (quantity > 0) {
      updateQuantity(product.id, nextStep)
    } else {
      addItem(product, nextStep)
      trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price })
    }
  }

  return (
    <div className="group flex flex-col fade-in-section h-full">
       {/* 1:1 Photo Container */}
       <div className="relative aspect-square overflow-hidden mb-4 shadow-2xl rounded-xl bg-gradient-to-b from-[#FAF7F2] to-[#F2EDE4] border border-[#D2BB8A]/30 transition-colors duration-300 hover:border-[#D2BB8A]">
         <Link
            to={`/produto/${product.id}`}
            state={{ from: '/adega' }}
          className="absolute inset-0 z-[1]"
          aria-label={`Ver detalhes de ${product.name}`}
         />
          <div className="absolute inset-0 flex items-center justify-center text-6xl grayscale opacity-20 group-hover:opacity-40 transition-all duration-700 group-hover:scale-110">
             🍷
          </div>
          {!imgError && (
            <img
              src={imageUrl}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
              onError={() => {
                if (imageIndex < imageCandidates.length - 1) {
                  setImageIndex((prev) => prev + 1)
                  return
                }
                setImgError(true)
              }}
            />
          )}
          
          {/* Badge Overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.badges && (
              <Badge tone="gold" className="h-5 bg-[#D2BB8A] text-[#231F20] text-label shadow-lg">
                {product.badges}
              </Badge>
            )}
          </div>

          <Button
            onClick={handleIncrease}
            variant="ghost"
            className="absolute inset-0 z-[2] h-auto rounded-lg bg-black/0 p-0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100"
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            <div className="bg-[#D2BB8A] text-[#231F20] p-3 rounded-full scale-50 group-hover:scale-100 transition-transform">
              <ShoppingCart size={20} />
            </div>
          </Button>
       </div>

       {/* Info Below */}
       <div className="flex flex-col flex-1 px-1">
          <div className="mb-3">
             <Link to={`/produto/${product.id}`} state={{ from: '/adega' }} className="block">
               <h3 className="luxury-text text-base text-white line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-[#D2BB8A] transition-colors">
                 {formatWineTitle(product.name)}
               </h3>
             </Link>
             <p className="text-label text-white/40 italic mt-1 line-clamp-1">
               {formatWineDescription(product.alternativeDescription)}
             </p>
          </div>
          
          <div className="mt-auto pt-3 border-t border-white/5">
             <div className="flex items-center gap-1 mb-2" role="group" aria-label="Quantidade por lote">
               {WINE_QUANTITY_STEPS.map((n) => (
                 <button
                   key={n}
                   type="button"
                   onClick={() => handleSelectStep(n)}
                   className={`text-[10px] font-bold px-2 py-1.5 rounded-full border transition-colors ${
                     step === n
                       ? 'bg-[#D2BB8A] text-[#231F20] border-[#D2BB8A]'
                       : 'border-[#D2BB8A]/30 text-[#D2BB8A]/70 hover:border-[#D2BB8A]'
                   }`}
                   aria-pressed={step === n}
                 >
                   {n}un
                 </button>
               ))}
             </div>
             <div className="flex flex-wrap items-center gap-y-1">
                <span className="text-lg font-bold text-[#D2BB8A] whitespace-nowrap">
                 {getProductPricePresentation(product).fullLabel}
                </span>

                {/* Altura E largura fixas reservadas: alterna add/stepper sem mudar o tamanho do card.
                    ml-auto + flex-wrap: em cards estreitos o controle cai pra linha de baixo
                    (sempre, independente da quantidade) em vez do preco quebrar no meio do texto. */}
                <div className="ml-auto flex h-8 w-20 shrink-0 items-center justify-end">
                  {quantity === 0 ? (
                     <Button
                       onClick={handleIncrease}
                       variant="ghost"
                       size="icon"
                       className="relative h-8 w-8 rounded-full border border-[#D2BB8A]/20 bg-white/5 text-[#D2BB8A] hover:bg-[#D2BB8A] hover:text-[#231F20] before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
                       aria-label="Adicionar ao carrinho"
                     >
                       +
                     </Button>
                  ) : (
                     <div className="flex h-8 items-center gap-1 bg-white/5 rounded-lg border border-[#D2BB8A]/20 p-0.5">
                       <Button
                         onClick={handleDecrease}
                         variant="ghost"
                         size="icon"
                         className="relative h-6 w-6 text-[#D2BB8A] hover:bg-white/10 before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
                         aria-label="Diminuir quantidade"
                       >
                         -
                       </Button>
                       <span className="text-xs font-bold text-white min-w-[15px] text-center">
                         {quantity}
                       </span>
                       <Button
                         onClick={handleIncrease}
                         variant="ghost"
                         size="icon"
                         className="relative h-6 w-6 text-[#D2BB8A] hover:bg-white/10 before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
                         aria-label="Aumentar quantidade"
                       >
                         +
                       </Button>
                     </div>
                  )}
                </div>
             </div>
          </div>
       </div>
    </div>
  )
}
