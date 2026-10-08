import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Clock, Film, Loader2, Minus, Plus, Scale, Search, Share2, ShoppingCart, Store, Truck } from 'lucide-react'
import { useProduct, useCart, useProductRecommendations, useSmartSubstitutes } from '../hooks/useCart'
import type { Product } from '../types'
import { formatPrice, formatProductTitle } from '../utils/format'
import { formatProductQuantity, getProductPricePresentation, getUnitReference } from '../utils/productPricing'
import { getProductCardViewModel, type ProductCardViewModel } from '../utils/productCard'
import { useDeliveryOperation, useSaleWeekday } from '../hooks/useDeliveryOperation'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useKnownZoneFreeAbove } from '../hooks/useKnownZoneFreeAbove'
import { WINE_STYLE_LABEL, WINE_TYPE_LABEL, wineFacts } from '../utils/wine'
import { trackEvent } from '../utils/analytics'
import { SEO, StructuredData } from '../components/SEO'
import { getProductDetailSections } from '../utils/productDetailSchema'
import { erpIdFromSlug, productPath } from '../utils/productUrl'
import { CMS_CATEGORY_TO_RULE_ID, HOME_CATEGORY_RULES, normalizeCategoryCode, toCategoryUrlParam } from '../utils/homeCategories'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { readDeliveryVerification, subscribeDeliveryVerification } from '../services/deliveryVerification'
import { StoreProductCard } from '../components/StoreProductCard'
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder'
import { useAuth } from '../hooks/useAuth'
import { NEAR_EXPIRY_NOTE, useNearExpiryProductIds } from '../hooks/useCMS'
import NotificationBell from '../components/NotificationBell'
import { ProductRecipeShelf } from '../components/RecipeShelf'
import { Button, buttonVariants } from '../components/ui/button'

// Pagina do produto refeita em 07/10/2026 (revisao de UI/UX do storefront,
// padrao dos apps lideres de supermercado, celular primeiro): foto em
// destaque, barra de compra sempre fixa embaixo com quantidade e total, preco
// por kg/L, prazo de entrega, "Compre junto" logo depois do preco e
// compartilhar no WhatsApp.

// Missoes (tagsEcommerce da AntenorApi) que viram o titulo do bloco de
// sugestoes -- "Monte seu churrasco" vende mais que "Compre junto".
// Tags de atributo (linha-premium, diet-light, integral...) ficam de fora.
// Mesma ordem do MISSION_TAGS do backend (products.service.ts).
const MISSIONS: Array<[string, string]> = [
  ['churrasco', 'Monte seu churrasco'],
  ['queijos-e-vinhos', 'Queijos & vinhos'],
  ['boteco-em-casa', 'Boteco em casa'],
  ['cafe-da-manha', 'Café da manhã completo'],
  ['lanche-rapido', 'Lanche rápido'],
  ['sobremesa', 'Hora da sobremesa'],
]

const IMAGE_VERSION = '3' // 01/10/2026: URL nova na borda, com o cache de 5 min no navegador.
const imageCandidates = (base: string) => ['webp', 'jpg', 'jpeg', 'png'].map((ext) => `${base}.${ext}?v=${IMAGE_VERSION}`)

/** "sex., 10/10": ultimo dia da oferta, em Brasilia (o fim vem como 23:59:59 de la). */
const promoEndLabel = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/**
 * Departamento do produto, com o nome da pagina que o link abre. Ate
 * 07/10/2026 o caminho mostrava a secao do ERP ("Manteigas & Requeijao") com
 * link para o departamento inteiro: o site nao tem pagina de secao.
 */
const departmentCrumb = (product: Product) => {
  if (product.category === 'ADEGA_VINHOS_ESPUMANTES') return { label: 'Adega', to: '/adega' }
  const ruleId = CMS_CATEGORY_TO_RULE_ID[normalizeCategoryCode(product.category || '')]
  const label = HOME_CATEGORY_RULES.find((rule) => rule.id === ruleId)?.label
  return label && product.category ? { label, to: `/mercado?cat=${toCategoryUrlParam(product.category)}` } : null
}

/**
 * Estado de compra compartilhado entre a barra fixa do celular e a caixa de
 * compra do computador. Antes de por no carrinho o cliente escolhe a
 * quantidade e ve o total no botao; depois, o seletor mexe direto no carrinho.
 */
function usePurchase(product: Product | undefined) {
  const { cart, addItem, updateQuantity, removeItem, subtotal, count } = useCart()
  const [pending, setPending] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number>()
  const quantity = product ? cart.find((item) => item.productId === product.id)?.quantity || 0 : 0

  useEffect(() => setPending(1), [product?.id])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const track = (qty: number) => {
    if (!product) return
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, { name: product.name, price: product.price, quantity: qty, source: 'SEARCH' })
  }

  return {
    quantity,
    shown: quantity > 0 ? quantity : pending,
    justAdded,
    subtotal,
    count,
    add() {
      if (!product) return
      addItem(product, pending)
      track(pending)
      setJustAdded(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setJustAdded(false), 1600)
    },
    increase() {
      if (!product) return
      if (quantity > 0) {
        addItem(product, 1)
        track(1)
      } else setPending((n) => n + 1)
    },
    decrease() {
      if (!product) return
      if (quantity > 1) updateQuantity(product.id, quantity - 1)
      else if (quantity === 1) removeItem(product.id)
      else setPending((n) => Math.max(1, n - 1))
    },
    /** Quantidade direta (meia caixa / caixa do vinho): antes de comprar so escolhe; no carrinho, ajusta. */
    setQuantity(n: number) {
      if (!product) return
      if (quantity > 0) updateQuantity(product.id, n)
      else setPending(n)
    },
  }
}

// Vinho: garrafa, meia caixa e caixa (o "1un/6un/12un" que ficava no card da
// Adega e punha 6 garrafas no carrinho com um toque, 07/10/2026). Aqui so
// escolhe a quantidade; quem compra e o botao.
const WINE_QUANTITIES: Array<[number, string]> = [[1, '1 garrafa'], [6, 'Meia caixa · 6'], [12, 'Caixa · 12']]
function WineQuantityPicker({ purchase }: { purchase: Purchase }) {
  return (
    <div role="group" aria-label="Quantidade de garrafas" className="flex flex-wrap gap-2">
      {WINE_QUANTITIES.map(([n, label]) => {
        const active = purchase.shown === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => purchase.setQuantity(n)}
            aria-pressed={active}
            className={`h-9 rounded-full border px-3.5 text-xs font-bold transition-colors ${active ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#E8D7B0] bg-white text-[#231F20] hover:border-[#D2BB8A]'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
type Purchase = ReturnType<typeof usePurchase>

function ProductHeader({ onBack, product }: { onBack: () => void; product?: Product }) {
  const { count } = useCart()
  const { user } = useAuth()

  // O cliente chega pelo WhatsApp: compartilhar o produto e o caminho de volta.
  const share = async () => {
    if (!product) return
    const url = `${window.location.origin}${productPath(product)}`
    const title = formatProductTitle(product.name)
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        /* cancelado pelo cliente */
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, '_blank', 'noopener')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-2 py-2 sm:px-4">
        <button type="button" onClick={onBack} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
          <ArrowLeft size={22} />
        </button>
        <Link
          to="/mercado"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E8D7B0] bg-[#FBF7F0] px-3.5 text-sm text-gray-500 transition-colors hover:border-[#D2BB8A]"
        >
          <Search size={17} className="shrink-0 text-[#5d4f33]" />
          <span className="truncate">Buscar no mercado</span>
        </Link>
        {product && (
          <button type="button" onClick={share} aria-label="Compartilhar produto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <Share2 size={20} />
          </button>
        )}
        <Link
          to="/carrinho"
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
      </div>
    </header>
  )
}

/** Foto em destaque; com duas fotos, desliza com o dedo (pontos embaixo). */
function ProductGallery({ product, viewModel }: { product: Product; viewModel: ProductCardViewModel }) {
  const main = useMemo(() => imageCandidates(`/uploads/products/${product.ean}`), [product.ean])
  const second = useMemo(() => imageCandidates(`/uploads/products/${product.ean}_2`), [product.ean])
  const [mainIndex, setMainIndex] = useState(0)
  const [mainFailed, setMainFailed] = useState(false)
  const [secondIndex, setSecondIndex] = useState(0)
  const [secondState, setSecondState] = useState<'probing' | 'ok' | 'none'>('probing')
  const [active, setActive] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMainIndex(0)
    setMainFailed(false)
    setSecondIndex(0)
    setSecondState('probing')
    setActive(0)
    scroller.current?.scrollTo({ left: 0 })
  }, [product.ean])

  const photos = [main[mainIndex], ...(secondState === 'ok' ? [second[secondIndex]] : [])]
  const title = formatProductTitle(product.name)

  return (
    <div className="relative bg-white lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#E8D7B0]/70">
      {mainFailed ? (
        <div className="flex h-[40vh] max-h-[380px] min-h-[260px] items-center justify-center lg:aspect-square lg:h-auto lg:max-h-none">
          <ProductImagePlaceholder size="lg" className="rounded-xl py-12" />
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {photos.map((src, i) => (
            <div key={i} className="flex h-[40vh] max-h-[380px] min-h-[260px] w-full shrink-0 snap-center items-center justify-center lg:aspect-square lg:h-auto lg:max-h-none">
              <img
                src={src}
                alt={i === 0 ? title : `${title}, foto ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-contain p-6"
                onError={() => {
                  if (i > 0) return setSecondState('none')
                  if (mainIndex < main.length - 1) setMainIndex((n) => n + 1)
                  else setMainFailed(true)
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Sonda a foto 2 fora da tela: o nginx responde 200 com o SVG "produto
          sem foto" quando o arquivo nao existe, entao confere o tipo real. */}
      {secondState === 'probing' && !mainFailed && (
        <img
          src={second[secondIndex]}
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={() => {
            fetch(second[secondIndex], { method: 'HEAD' })
              .then((res) => {
                if (!/svg/i.test(res.headers.get('content-type') || '')) return setSecondState('ok')
                if (secondIndex < second.length - 1) setSecondIndex((n) => n + 1)
                else setSecondState('none')
              })
              .catch(() => setSecondState('none'))
          }}
          onError={() => (secondIndex < second.length - 1 ? setSecondIndex((n) => n + 1) : setSecondState('none'))}
        />
      )}

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
        {viewModel.isOnSale && viewModel.discountPct >= 1 && (
          <span className="rounded-lg bg-[#5D082A] px-2.5 py-1 text-sm font-black text-white shadow-sm">-{viewModel.discountPct}%</span>
        )}
        {viewModel.saleDaysText && (
          <span className="rounded-lg bg-[#D2BB8A] px-2.5 py-1 text-xs font-bold text-[#231F20] shadow-sm">Só {viewModel.saleDaysText}</span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver foto ${i + 1}`}
              onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })}
              className={`h-2 rounded-full transition-all ${active === i ? 'w-5 bg-[#5D082A]' : 'w-2 bg-[#D2BB8A]'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PriceBlock({ product, viewModel }: { product: Product; viewModel: ProductCardViewModel }) {
  const price = getProductPricePresentation(product)
  // Vinho por litro so atrapalha quem escolhe garrafa; o resto mostra o R$/kg ou R$/L.
  const unitReference = product.category === 'ADEGA_VINHOS_ESPUMANTES' ? '' : getUnitReference(product)
  const promoUntil = viewModel.isOnSale ? promoEndLabel(product.promotionalPriceValidUntil) : ''
  const nearExpiryIds = useNearExpiryProductIds()

  return (
    <div className="space-y-1">
      {viewModel.originalPrice && (
        <p className="text-sm text-gray-500">
          de <span className="line-through">{formatPrice(viewModel.originalPrice)}</span> por
        </p>
      )}
      <p className="flex items-baseline gap-1 text-[#5D082A]">
        <span className="text-base font-bold">{price.currencySymbol}</span>
        <span className="text-[34px] font-black leading-none tracking-tight">{price.value}</span>
        {price.suffix && <span className="ml-0.5 text-sm font-medium text-gray-500">{price.suffix}</span>}
      </p>
      {unitReference && <p className="text-xs text-gray-500">Equivale a {unitReference}</p>}
      {promoUntil && (
        <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#5D082A]">
          <Clock size={13} /> Oferta válida até {promoUntil}
        </p>
      )}
      {nearExpiryIds.has(product.id) && <p className="text-xs text-gray-500">{NEAR_EXPIRY_NOTE}</p>}
    </div>
  )
}

/** Prazo e frete: o que mais pesa na decisao de comprar no app (entrega hoje?). */
function ServiceRows() {
  const status = useDeliveryOperation()
  const { openModal } = useDeliveryVerificationModal()
  const [verification, setVerification] = useState(() => readDeliveryVerification())
  useEffect(() => subscribeDeliveryVerification(() => setVerification(readDeliveryVerification())), [])
  const calc = verification?.calc
  const place = calc?.locality || calc?.zoneName || verification?.address?.neighborhood
  const change = (label: string) => (
    <button type="button" onClick={() => openModal()} className="font-semibold text-[#5D082A] underline underline-offset-2">
      {label}
    </button>
  )

  let fee: React.ReactNode
  if (!calc) fee = <>{change('Informe seu CEP')} e veja o frete</>
  else if (calc.outOfArea) fee = <>Ainda não entregamos {place ? `em ${place}` : 'no seu endereço'} · {change('trocar')}</>
  else {
    const value = calc.fee ?? 0
    fee = (
      <>
        {value > 0 ? `Frete ${formatPrice(value)}` : 'Frete grátis'}
        {place ? ` em ${place}` : ''}
        {value > 0 && calc.freeAbove ? ` · grátis acima de ${formatPrice(calc.freeAbove)}` : ''} · {change('trocar')}
      </>
    )
  }

  return (
    <ul className="divide-y divide-[#E8D7B0]/60 rounded-2xl border border-[#E8D7B0]/70 bg-[#FBFAF7] text-sm">
      <li className="flex gap-3 px-4 py-3">
        <Truck size={20} className="mt-0.5 shrink-0 text-[#5D082A]" />
        <div className="min-w-0">
          <p className="font-semibold text-[#231F20]">{status.message}</p>
          <p className="text-[#5d4f33]">{fee}</p>
          {status.note && <p className="text-xs text-[#8a6a3a]">{status.note}</p>}
        </div>
      </li>
      <li className="flex gap-3 px-4 py-3">
        <Store size={20} className="mt-0.5 shrink-0 text-[#5D082A]" />
        <p className="text-[#5d4f33]"><span className="font-semibold text-[#231F20]">Retirada grátis</span> na loja</p>
      </li>
    </ul>
  )
}

function QuantityStepper({ label, onDecrease, onIncrease, size = 'lg' }: { label: string; onDecrease: () => void; onIncrease: () => void; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12' : 'h-11'
  return (
    <div className={`flex ${box} shrink-0 items-center rounded-xl border border-[#E8D7B0] bg-white`}>
      <button type="button" onClick={onDecrease} aria-label="Diminuir quantidade" className={`flex ${box} w-11 items-center justify-center text-[#5D082A] active:scale-90`}>
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-[44px] text-center text-base font-black tabular-nums text-[#231F20]">{label}</span>
      <button type="button" onClick={onIncrease} aria-label="Aumentar quantidade" className={`flex ${box} w-11 items-center justify-center text-[#5D082A] active:scale-90`}>
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  )
}

/** Botao principal: "Adicionar · R$ 45,80" antes, "Ver carrinho · subtotal" depois. */
function PurchaseActions({ product, purchase, size = 'lg' }: { product: Product; purchase: Purchase; size?: 'md' | 'lg' }) {
  const price = getProductPricePresentation(product)
  const label = formatProductQuantity(product, purchase.shown)
  const height = size === 'lg' ? 'h-12' : 'h-11'
  return (
    <div className="flex items-center gap-2.5">
      <QuantityStepper label={label} onDecrease={purchase.decrease} onIncrease={purchase.increase} size={size} />
      {purchase.quantity === 0 ? (
        <Button onClick={purchase.add} className={`${height} flex-1 justify-between gap-2 rounded-xl px-4 text-[15px]`}>
          <span className="inline-flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Adicionar</span>
          <span className="font-black tabular-nums">{formatPrice(price.displayPrice * purchase.shown)}</span>
        </Button>
      ) : (
        <Link to="/carrinho" className={buttonVariants({ variant: 'primary', className: `${height} flex-1 justify-between gap-2 rounded-xl px-4 text-[15px]` })}>
          {purchase.justAdded ? (
            <span className="inline-flex items-center gap-2"><Check className="h-5 w-5" /> Adicionado</span>
          ) : (
            <span>Ver carrinho</span>
          )}
          <span className="font-black tabular-nums">{formatPrice(purchase.subtotal)}</span>
        </Link>
      )}
    </div>
  )
}

function UnavailableNote({ product, viewModel }: { product: Product; viewModel: ProductCardViewModel }) {
  return (
    <p className="text-sm font-semibold text-[#8a6a3a]">
      {viewModel.offDay
        ? `Vendido só ${viewModel.saleDaysText}`
        : product.active === false || viewModel.missingFractionStep
          ? 'Indisponível no momento'
          : 'Sem estoque no momento'}
    </p>
  )
}

/**
 * Barra de compra do celular, sempre visivel (como iFood/Rappi): a pagina do
 * produto nao tem o menu de baixo. Mostra quanto falta para o frete gratis --
 * o empurrao para mais um item na hora em que o cliente decide.
 */
function MobilePurchaseBar({ product, viewModel, purchase, hasAlike }: { product: Product; viewModel: ProductCardViewModel; purchase: Purchase; hasAlike: boolean }) {
  const zoneFreeAbove = useKnownZoneFreeAbove()
  const freeShipping = useFreeShipping(purchase.subtotal, zoneFreeAbove)
  const showFreeShipping = purchase.count > 0 && freeShipping.enabled && !freeShipping.achieved

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8D7B0] bg-white/95 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur lg:hidden">
      {showFreeShipping && (
        <div className="border-b border-[#E8D7B0]/70 bg-[#FDF8F0] px-4 py-1.5">
          <p className="text-[11px] font-medium text-[#5d4f33]">
            Faltam <strong className="text-[#5D082A]">{formatPrice(freeShipping.remaining)}</strong> para frete grátis
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#E8D7B0]/70">
            <div className="h-full rounded-full bg-[#5D082A] transition-all duration-500" style={{ width: `${freeShipping.pct}%` }} />
          </div>
        </div>
      )}
      <div className="px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
        {viewModel.outOfStock ? (
          hasAlike ? (
            <a href="#parecidos" className={buttonVariants({ variant: 'primary', className: 'h-11 w-full rounded-xl' })}>Ver parecidos disponíveis</a>
          ) : (
            <Link to="/mercado" className={buttonVariants({ variant: 'primary', className: 'h-11 w-full rounded-xl' })}>Continuar comprando</Link>
          )
        ) : (
          <PurchaseActions product={product} purchase={purchase} size="md" />
        )}
      </div>
    </div>
  )
}

function ProductCarousel({ id, title, products, link, className = '' }: { id?: string; title: string; products: Product[]; link?: { to: string; label: string }; className?: string }) {
  if (products.length === 0) return null
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mb-3 flex items-center justify-between px-4 lg:px-0">
        <h2 className="text-lg font-bold text-[#231F20]">{title}</h2>
        {link && (
          <Link to={link.to} className="inline-flex items-center text-xs font-bold text-[#5D082A] hover:underline">
            {link.label} <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="hide-scrollbar flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 lg:scroll-px-0 lg:px-0">
        {products.map((item) => (
          <StoreProductCard key={item.id} product={item} source="SEARCH" variant="carousel" />
        ))}
      </div>
    </section>
  )
}

function DetailsCard({ product }: { product: Product }) {
  const sections = getProductDetailSections(product)
  const facts = sections.filter((s) => s.facts.some((f) => f.label))
  const notes = sections.filter((s) => !s.facts.some((f) => f.label))
  const code = product.ean ? (
    <p className="text-xs text-gray-500">
      {/^\d{8,14}$/.test(product.ean) ? 'Código de barras (EAN)' : 'Código'}: <span className="font-mono">{product.ean}</span>
    </p>
  ) : null
  if (sections.length === 0) return code
  return (
    <article className="space-y-4 rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
      {facts.map((section) => (
        <div key={section.id}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D082A]">{section.title}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {section.facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="font-semibold text-[#231F20]">{fact.label}</dt>
                <dd className="text-[#5d4f33]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {notes.map((section) => (
        <div key={section.id}>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#5D082A]">{section.title}</h2>
          {section.facts.map((fact) => (
            <p key={fact.value} className="text-sm leading-relaxed text-[#5d4f33]">{fact.value}</p>
          ))}
        </div>
      ))}
      {/* Peso e producao propria tem codigo interno curto (ex.: 2701), nao
          codigo de barras: aparece como "Codigo" (pedido do Jonathan, 01/10/2026). */}
      {code}
    </article>
  )
}

export default function ProductDetail() {
  const { id: legacyId = '', slug = '' } = useParams()
  // /p/<nome>-<erpProductId> (URL limpa) ou /produto/<cuid> (links antigos).
  const id = slug ? erpIdFromSlug(slug) : legacyId
  const navigate = useNavigate()
  const location = useLocation()
  const { data: product, isLoading } = useProduct(id)
  const { data: recommendations = [] } = useProductRecommendations(product?.id ?? '', 8)
  const { data: substitutes = [] } = useSmartSubstitutes(product?.id ?? '', 8)
  const saleWeekday = useSaleWeekday()
  const purchase = usePurchase(product)

  // Link antigo ou slug desatualizado (nome mudou) -> troca pela URL canonica
  // sem criar entrada nova no historico.
  useEffect(() => {
    if (!product) return
    const canonicalPath = productPath(product)
    if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true, state: location.state })
  }, [product, location.pathname, location.state, navigate])

  // VIEW_PRODUCT existia no tipo e nunca disparava: sem ele nao ha funil
  // "viu -> adicionou". Um evento por produto aberto.
  useEffect(() => {
    if (product?.id) trackEvent('VIEW_PRODUCT', 'PRODUCT', product.id, { name: product.name, price: product.price })
  }, [product?.id])

  // Abrir outro produto pela vitrine comeca do topo.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [product?.id])

  const backTo = (location.state as { from?: string } | null)?.from || '/mercado'
  // ponytail: navigate(-1) volta pra pagina real de origem (preserva scroll/filtros);
  // so cai no backTo fixo quando nao ha historico dentro do site (link direto/aba nova)
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(backTo)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#5D082A]" size={44} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white pb-16">
        <ProductHeader onBack={goBack} />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-[#231F20]">Produto não encontrado</h1>
          <p className="mt-2 text-[#5d4f33]">Esse item pode ter sido removido ou está indisponível no momento.</p>
          <Link to={backTo} className={buttonVariants({ variant: 'primary', size: 'md', className: 'mt-6' })}>
            {backTo === '/adega' ? 'Voltar para a Adega' : 'Voltar para o Mercado'}
          </Link>
        </main>
      </div>
    )
  }

  const title = formatProductTitle(product.name)
  const price = getProductPricePresentation(product)
  const viewModel = getProductCardViewModel(product, saleWeekday)
  const categoryCrumb = departmentCrumb(product)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const imageUrl = imageCandidates(`/uploads/products/${product.ean}`)[0]
  const unitSuffix = product.isFractional && price.unitLabel !== 'un' ? `/${price.unitLabel}` : ''
  // O alternativeDescription do ERP e nota de fracionamento, nao descricao
  // (ia parar no Google e na previa do WhatsApp). Mesmo texto do servidor.
  const description = `${title} por ${formatPrice(price.unitPrice)}${unitSuffix} no Antenor & Filhos. Peça pelo site e receba em casa.`

  // Titulo de missao so quando todos os itens sao da missao; senao a vitrine
  // dizia "Cafe da manha completo" e mostrava arroz e farinha (07/10/2026).
  const shelf = recommendations.filter((item) => item.id !== product.id)
  const mission = MISSIONS.find(([tag]) => product.tags?.includes(tag))
  const missionShelf = Boolean(mission && shelf.length > 0 && shelf.every((item) => item.tags?.includes(mission[0])))
  const alike = substitutes.filter((item) => item.id !== product.id)

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image: `${origin}${imageUrl}`,
    sku: String(product.erpProductId ?? product.ean),
    // GTIN so com codigo de barras de verdade; peso e producao propria usam codigo interno curto.
    gtin: /^\d{8,14}$/.test(product.ean || '') ? product.ean : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: price.unitPrice.toFixed(2),
      availability: viewModel.outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'Antenor & Filhos' },
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
      ...(categoryCrumb ? [{ '@type': 'ListItem', position: 2, name: categoryCrumb.label, item: `${origin}${categoryCrumb.to}` }] : []),
      { '@type': 'ListItem', position: categoryCrumb ? 3 : 2, name: title },
    ],
  }

  const buyTogether = (
    <ProductCarousel
      title={missionShelf && mission ? mission[1] : 'Compre junto'}
      products={shelf}
      link={missionShelf && mission ? { to: `/mercado?tag=${mission[0]}`, label: 'Ver tudo' } : undefined}
    />
  )

  return (
    <div className="min-h-screen bg-[#FBFAF7] pb-40 lg:pb-16">
      <SEO
        title={title}
        description={description}
        canonical={productPath(product)}
        type="product"
        image={imageUrl}
        keywords={[categoryCrumb?.label, product.name].filter(Boolean).join(', ')}
      />
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <ProductHeader onBack={goBack} product={product} />

      <main className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-10 lg:px-4 lg:pt-8">
        <div className="lg:sticky lg:top-24">
          <ProductGallery product={product} viewModel={viewModel} />
          {product.videoUrl && (
            <div className="mt-4 px-4 lg:px-0">
              <ProductVideoEmbed url={product.videoUrl} />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="relative -mt-4 space-y-4 rounded-t-3xl bg-[#FBFAF7] px-4 pt-5 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-0">
            <div className="space-y-2">
              {categoryCrumb && (
                <nav aria-label="Você está em">
                  <Link to={categoryCrumb.to} className="inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-[#8a6a3a] hover:text-[#5D082A]">
                    {categoryCrumb.label} <ChevronRight size={13} />
                  </Link>
                </nav>
              )}
              <h1 className="text-[22px] font-bold leading-snug text-[#231F20] lg:text-3xl">{title}</h1>
            </div>

            <PriceBlock product={product} viewModel={viewModel} />

            {product.isFractional && !viewModel.missingFractionStep && (
              <p className="flex gap-2 rounded-xl bg-[#F8F4EA] px-3 py-2.5 text-xs leading-relaxed text-[#5d4f33]">
                <Scale size={16} className="mt-0.5 shrink-0 text-[#8a6a3a]" />
                <span>
                  Vendido por peso, em porções de {price.portionLabel}. O valor final segue o peso conferido na separação.
                </span>
              </p>
            )}

            {product.category === 'ADEGA_VINHOS_ESPUMANTES' && !viewModel.outOfStock && <WineQuantityPicker purchase={purchase} />}

            {/* Computador: caixa de compra na coluna; no celular quem compra e a barra fixa. */}
            <div className="hidden lg:block">
              {viewModel.outOfStock ? (
                <div className="rounded-2xl border border-[#E8D7B0] bg-[#FBF7F0] px-4 py-4">
                  <UnavailableNote product={product} viewModel={viewModel} />
                  <p className="mt-1 text-xs text-[#8a6a3a]">
                    {viewModel.offDay ? 'Volte para pedir num desses dias.' : alike.length ? 'Veja abaixo opções parecidas disponíveis.' : 'Volte mais tarde ou procure no Mercado.'}
                  </p>
                </div>
              ) : (
                <PurchaseActions product={product} purchase={purchase} />
              )}
            </div>

            {viewModel.outOfStock && (
              <div className="rounded-2xl border border-[#E8D7B0] bg-[#FBF7F0] px-4 py-3 lg:hidden">
                <UnavailableNote product={product} viewModel={viewModel} />
                <p className="mt-0.5 text-xs text-[#8a6a3a]">
                  {viewModel.offDay ? 'Volte para pedir num desses dias.' : alike.length ? 'Veja abaixo opções parecidas disponíveis.' : 'Volte mais tarde ou procure no Mercado.'}
                </p>
              </div>
            )}

            <ServiceRows />
          </section>

          {/* Indisponivel: o que da para levar no lugar vem antes de tudo. */}
          {viewModel.outOfStock && <ProductCarousel id="parecidos" title="Parecidos disponíveis" products={alike} className="lg:hidden" />}

          {/* Vinho: quem compra decide pela ficha, entao ela vem antes da vitrine. */}
          {product.wineProfile && (
            <div className="px-4 lg:hidden">
              <WineSheet product={product} />
            </div>
          )}

          {/* Celular: o "Compre junto" logo depois do preco (impulso); no computador vai embaixo, largo. */}
          <div className="lg:hidden">{buyTogether}</div>

          <div className="space-y-4 px-4 lg:px-0">
            {product.wineProfile && (
              <div className="hidden lg:block">
                <WineSheet product={product} />
              </div>
            )}
            <DetailsCard product={product} />
          </div>
        </div>
      </main>

      <div className="mx-auto mt-8 max-w-6xl space-y-8 lg:px-4">
        {viewModel.outOfStock && <ProductCarousel id="parecidos-desktop" title="Parecidos disponíveis" products={alike} className="hidden lg:block" />}
        <div className="hidden lg:block">{buyTogether}</div>
        <ProductRecipeShelf productId={product.id} className="px-4 lg:px-0" />
        {!viewModel.outOfStock && <ProductCarousel title="Parecidos com este" products={alike} />}
      </div>

      <MobilePurchaseBar product={product} viewModel={viewModel} purchase={purchase} hasAlike={alike.length > 0} />
    </div>
  )
}

// Ficha do vinho (03/10/2026): para o novato, a descricao curta e o basico;
// para quem conhece, as notas de degustacao abrem num toque.
function WineSheet({ product }: { product: Product }) {
  const p = product.wineProfile!
  const f = wineFacts(product)
  const facts = [
    ['Tipo', [f.tipo ? WINE_TYPE_LABEL[f.tipo] : '', f.estilo ? WINE_STYLE_LABEL[f.estilo] : ''].filter(Boolean).join(' · ')],
    ['Uvas', f.uvas.join(', ')],
    ['Origem', [p.regiaoDenominacao, p.pais].filter(Boolean).join(', ')],
    ['Produtor', p.produtor || ''],
    ['Classificação', p.classificacao || ''],
    ['Teor alcoólico', p.teorAlcoolico || ''],
    ['Servir a', p.temperaturaServico || ''],
    ['Guarda', p.guarda || ''],
  ].filter(([, v]) => v)
  return (
    <article className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5D082A]">Sobre este vinho</h2>
      {p.descricaoCurta && <p className="mb-3 text-sm leading-relaxed text-[#231F20]">{p.descricaoCurta}</p>}
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-[#231F20]">{label}</dt>
              <dd className="text-[#5d4f33]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.harmonizacao && (
        <p className="mt-3 text-sm leading-relaxed text-[#5d4f33]">
          <span className="font-semibold text-[#231F20]">Combina com: </span>
          {p.harmonizacao}
        </p>
      )}
      {p.notasDegustacao && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[#5D082A]">Notas de degustação</summary>
          <p className="mt-1.5 leading-relaxed text-[#5d4f33]">{p.notasDegustacao}</p>
        </details>
      )}
    </article>
  )
}

function ProductVideoEmbed({ url }: { url: string }) {
  const embedUrl = useMemo(() => {
    // YouTube: https://youtu.be/xxx ou https://www.youtube.com/watch?v=xxx
    const ytShort = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
    const ytWatch = url.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/)
    const ytId = (ytShort || ytWatch)?.[1]
    if (ytId) return `https://www.youtube.com/embed/${ytId}`

    // Instagram: https://www.instagram.com/reel/xxx ou /p/xxx
    const igMatch = url.match(/instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/)
    if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed`

    // TikTok: https://www.tiktok.com/@user/video/xxx
    const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
    if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`

    return null
  }, [url])

  if (!embedUrl) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8D7B0]/70 bg-white">
      <div className="flex items-center gap-2 border-b border-[#E8D7B0]/60 bg-[#FBF7F0] px-4 py-2">
        <Film size={16} className="text-[#5D082A]" />
        <span className="text-xs font-bold uppercase tracking-wide text-[#5d4f33]">Demonstração do Produto</span>
      </div>
      <div className="relative aspect-video bg-black">
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="Vídeo do produto"
        />
      </div>
    </div>
  )
}
