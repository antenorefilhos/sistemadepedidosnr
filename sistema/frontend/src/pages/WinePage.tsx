import { useCart } from '../hooks/useCart'
import { useQuery } from '@tanstack/react-query'
import { productsAPI } from '../services/api'
import { PRICE_BANDS, WINE_STYLE_LABEL, wineFacts, wineSubtitle, type WineFacts } from '../utils/wine'
import { useAuth } from '../hooks/useAuth'
import { useStoreBanners } from '../hooks/useCMS'
import { productPath } from '../utils/productUrl'
import { findWineCategoryBanner, resolveBannerLink } from '../utils/homeCategories'
import { PromoBanner } from '../components/PromoBanner'
import { resolveApiUrl } from '../services/api'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { BackToTopButton } from '../components/BackToTopButton'
import type { Product } from '../types'
import { getProductPricePresentation } from '../utils/productPricing'
import { trackEvent } from '../utils/analytics'
import { ArrowLeft, ShoppingCart, Loader2, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
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

// Filtros pela ficha do vinho (03/10/2026): tipo, estilo, pais, uva e preco.
// Antes era palavra no nome ("CHANDON" contava como champagne). O estado fica
// na URL, entao o link filtrado pode ser compartilhado e o voltar funciona.
type WineSubcategory = 'all' | 'tinto' | 'branco' | 'rose' | 'espumante' | 'suave'

const WINE_CATEGORIES: Array<{ key: WineSubcategory; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'tinto', label: 'Tintos' },
  { key: 'branco', label: 'Brancos' },
  { key: 'rose', label: 'Rosés' },
  { key: 'espumante', label: 'Espumantes' },
  { key: 'suave', label: 'Suaves' },
]

const matchesSubcat = (f: WineFacts, subcat: WineSubcategory): boolean => {
  if (subcat === 'all') return true
  if (subcat === 'suave') return f.estilo === 'suave'
  if (subcat === 'rose') return f.tipo === 'rosé'
  return f.tipo === subcat
}

type WineSort = 'nome' | 'menor' | 'maior'
const SORTS: Array<{ key: WineSort; label: string }> = [
  { key: 'nome', label: 'Nome (A–Z)' },
  { key: 'menor', label: 'Menor preço' },
  { key: 'maior', label: 'Maior preço' },
]
const priceOf = (p: Product) => (p.promotionalPrice && p.promotionalPrice < p.price ? p.promotionalPrice : p.price)

const selectClass =
  'h-10 min-w-0 rounded-full border border-[#D2BB8A]/30 bg-[#1C1917] px-3 text-xs font-semibold text-[#F3E7C9] outline-none focus:border-[#D2BB8A]'

export default function WinePage() {
  // Lista inteira da Adega (ate 100) para os filtros contarem tudo.
  const { data: products, isLoading } = useQuery({
    queryKey: ['adega', 100],
    queryFn: async () => {
      const r = await productsAPI.getAll(undefined, 1, 100, 'ADEGA_VINHOS_ESPUMANTES')
      const body = r.data as { data?: Product[] } | Product[]
      return (Array.isArray(body) ? body : body.data ?? []) as Product[]
    },
    staleTime: 1000 * 60 * 5,
  })
  const { count } = useCart()
  const { user } = useAuth()
  // A Adega tem rota propria (/adega), sem ?cat= na URL, entao o banner e
  // achado pelo nome da categoria -- mesma regra que manda um banner de
  // categoria da Adega apontar pra ca (ver findWineCategoryBanner).
  const { data: storeBanners } = useStoreBanners()
  const wineBanner = useMemo(() => findWineCategoryBanner(storeBanners), [storeBanners])
  const [params, setParams] = useSearchParams()
  const selectedSubcat = (WINE_CATEGORIES.some((c) => c.key === params.get('tipo')) ? params.get('tipo') : 'all') as WineSubcategory
  const country = params.get('pais') || ''
  const grape = params.get('uva') || ''
  const band = params.get('preco') || ''
  const sort = (SORTS.some((s) => s.key === params.get('ordem')) ? params.get('ordem') : 'nome') as WineSort
  const setFilter = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value && value !== 'all' && !(key === 'ordem' && value === 'nome')) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const setSelectedSubcat = (v: WineSubcategory) => setFilter('tipo', v)
  const hasFilters = Boolean(country || grape || band || selectedSubcat !== 'all')

  useEffect(() => {
    trackEvent('VIEW_CATEGORY', 'CATEGORY', 'VINHOS')
  }, [])

  const vinhos = useMemo(() => ((products || []) as Product[]).map((p) => ({ p, f: wineFacts(p) })), [products])

  // Cada filtro conta sobre o resultado dos OUTROS filtros (faceta), para nunca
  // oferecer uma opcao que leva a lista vazia.
  const passes = (x: { p: Product; f: WineFacts }, skip?: string) => {
    if (skip !== 'tipo' && !matchesSubcat(x.f, selectedSubcat)) return false
    if (skip !== 'pais' && country && x.f.pais !== country) return false
    if (skip !== 'uva' && grape && !x.f.uvas.includes(grape)) return false
    if (skip !== 'preco' && band) {
      const b = PRICE_BANDS.find((pb) => pb.key === band)
      const v = priceOf(x.p)
      if (b && !(v >= b.min && v < b.max)) return false
    }
    return true
  }

  const subcatCounts = useMemo(() => {
    const base = vinhos.filter((x) => passes(x, 'tipo'))
    return new Map(WINE_CATEGORIES.map((c) => [c.key, base.filter((x) => matchesSubcat(x.f, c.key)).length]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinhos, country, grape, band])

  const facet = (key: 'pais' | 'uva') => {
    const counts = new Map<string, number>()
    for (const x of vinhos.filter((v) => passes(v, key))) {
      const values = key === 'pais' ? (x.f.pais ? [x.f.pais] : []) : x.f.uvas
      for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
  }
  const countryOptions = useMemo(() => facet('pais'), [vinhos, selectedSubcat, grape, band]) // eslint-disable-line react-hooks/exhaustive-deps
  const grapeOptions = useMemo(() => facet('uva'), [vinhos, selectedSubcat, country, band]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredVinhos = useMemo(() => {
    const list = vinhos.filter((x) => passes(x))
    const byName = (a: { p: Product }, b: { p: Product }) => a.p.name.localeCompare(b.p.name, 'pt-BR')
    list.sort(sort === 'menor' ? (a, b) => priceOf(a.p) - priceOf(b.p) || byName(a, b) : sort === 'maior' ? (a, b) => priceOf(b.p) - priceOf(a.p) || byName(a, b) : byName)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinhos, selectedSubcat, country, grape, band, sort])

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
          {/* JON-168 (Auditoria 360): 24x24 ficava abaixo do alvo minimo de 44x44. */}
          <Link
            to="/"
            className="-ml-2.5 flex min-h-11 min-w-11 items-center justify-center text-[#D2BB8A] transition-transform hover:scale-110"
            aria-label="Voltar para Home"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="text-center flex-1">
             <h1 className="luxury-text text-xl font-extrabold tracking-wide uppercase bg-gradient-to-r from-[#D2BB8A] via-[#F3E7C9] to-[#D2BB8A] bg-clip-text text-transparent">
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
             src="/media/vinhos.jpg"
             alt="Luxury Wine Selection - Adega Antenor & Filhos"
             className="absolute inset-0 w-full h-full object-cover opacity-60"
             loading="eager"
             onError={(e) => {
               // Rede instavel derruba o carregamento sem avisar -- sem isso
               // a secao inteira fica com fundo vazio ate o usuario recarregar
               // a pagina inteira. Uma tentativa com cache-buster resolve o
               // caso comum (resposta parcial/corrompida em cache); se falhar
               // de novo, desiste -- sem loop.
               const img = e.currentTarget
               if (img.dataset.retried) return
               img.dataset.retried = '1'
               img.src = `/media/vinhos.jpg?retry=${Date.now()}`
             }}
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
                  {/* JON-161 (Auditoria 360): as duas variantes com opacidade
                      reduzida mediam 3,30:1/3,42:1, abaixo do 4,5:1 de texto
                      pequeno -- cor solida (sem /50 ou /60) resolve as duas. */}
                  <span className={isActive ? 'text-[#231F20]' : 'text-[#D2BB8A]'}>({count})</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" role="group" aria-label="Mais filtros">
            <select aria-label="País" value={country} onChange={(e) => setFilter('pais', e.target.value)} className={selectClass}>
              <option value="">Todos os países</option>
              {countryOptions.map(([c, n]) => (
                <option key={c} value={c}>{c} ({n})</option>
              ))}
            </select>
            <select aria-label="Uva" value={grape} onChange={(e) => setFilter('uva', e.target.value)} className={selectClass}>
              <option value="">Todas as uvas</option>
              {grapeOptions.map(([g, n]) => (
                <option key={g} value={g}>{g} ({n})</option>
              ))}
            </select>
            <select aria-label="Faixa de preço" value={band} onChange={(e) => setFilter('preco', e.target.value)} className={selectClass}>
              <option value="">Qualquer preço</option>
              {PRICE_BANDS.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
            <select aria-label="Ordenar" value={sort} onChange={(e) => setFilter('ordem', e.target.value)} className={selectClass}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            {hasFilters && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className="col-span-2 h-10 rounded-full px-3 text-xs font-semibold uppercase tracking-wider text-[#D2BB8A] underline-offset-4 hover:underline sm:col-span-1">
                Limpar filtros
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-white/50">{filteredVinhos.length} {filteredVinhos.length === 1 ? 'rótulo' : 'rótulos'}</p>
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
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                variant="ghost"
                className="mt-2 rounded-full border border-[#D2BB8A]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#D2BB8A] hover:bg-[#D2BB8A]/10"
              >
                Ver todos os vinhos
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {filteredVinhos.map(({ p, f }) => (
                <WineCard key={p.id} product={p} facts={f} />
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
      <BackToTopButton />
    </div>
  )
}

const WINE_QUANTITY_STEPS = [1, 6, 12] as const
type WineQuantityStep = (typeof WINE_QUANTITY_STEPS)[number]

function WineCard({ product, facts }: { product: Product; facts: WineFacts }) {
  const { cart, addItem, removeItem, updateQuantity } = useCart()
  const cartItem = cart.find(item => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  const [imageIndex, setImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [step, setStep] = useState<WineQuantityStep>(1)

  const imageBaseUrl = `/uploads/products/${product.ean}`
  const imageCandidates = [`/thumbs/products/${product.ean}.webp`, `${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`]
    .map((url) => `${url}?v=3`)
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
            to={productPath(product)}
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
             <Link to={productPath(product)} state={{ from: '/adega' }} className="block">
               <h3 className="luxury-text text-base text-white line-clamp-2 leading-tight min-h-[2.5rem] group-hover:text-[#D2BB8A] transition-colors">
                 {formatWineTitle(product.name)}
               </h3>
             </Link>
             <p className="text-label text-white/60 mt-1 line-clamp-1">
               {wineSubtitle(facts) || formatWineDescription(product.alternativeDescription)}
               {facts.estilo && facts.estilo !== 'seco' && facts.tipo !== 'espumante' ? ` · ${WINE_STYLE_LABEL[facts.estilo]}` : ''}
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
