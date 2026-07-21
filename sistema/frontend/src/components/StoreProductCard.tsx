import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { ProductImagePlaceholder } from './ProductImagePlaceholder'
import { useCart } from '../hooks/useCart'
import type { Product } from '../types'
import { formatPrice, formatProductTitle } from '../utils/format'
import { getProductCardViewModel } from '../utils/productCard'
import { formatProductQuantity, getProductPricePresentation } from '../utils/productPricing'
import { trackEvent } from '../utils/analytics'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { cn } from '../lib/cn'

type StoreProductCardProps = {
  product: Product
  source: 'HOME' | 'SEARCH'
  variant?: 'carousel' | 'grid'
  analyticsMeta?: Record<string, unknown>
}

export function StoreProductCard({
  product,
  source,
  variant = 'grid',
  analyticsMeta,
}: StoreProductCardProps) {
  const { cart, addItem, removeItem, updateQuantity } = useCart()
  const [imgError, setImgError] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)
  const [unitMode, setUnitMode] = useState<'unit' | 'weight'>('unit')

  const cartItem = cart.find((item) => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  const imageBaseUrl = `/uploads/products/${product.ean}`
  const imageVersion = '2'
  const imageCandidates = [`${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`]
    .map((url) => `${url}?v=${imageVersion}`)
  const imageUrl = imageCandidates[imageIndex]
  const viewModel = useMemo(() => getProductCardViewModel(product), [product])
  const pricePresentation = useMemo(() => getProductPricePresentation(product), [product])
  const displayQuantity = useMemo(() => {
    if (!product.isFractional) return `${quantity}`
    if (unitMode === 'unit') return `${quantity}`
    return formatProductQuantity(product, quantity)
  }, [product, quantity, unitMode])

  const fireAddToCartEvent = () => {
    trackEvent('ADD_TO_CART', 'PRODUCT', product.id, {
      name: product.name,
      price: product.price,
      source,
      ...(analyticsMeta || {}),
    })
  }

  const handleAdd = () => {
    addItem(product, 1)
    fireAddToCartEvent()
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span className="line-clamp-2">{formatProductTitle(product.name)} no carrinho</span>
          <button
            type="button"
            onClick={() => {
              removeItem(product.id)
              toast.dismiss(t.id)
            }}
            className="shrink-0 rounded-md border border-[#D2BB8A]/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#D2BB8A] hover:bg-[#D2BB8A]/15"
          >
            Desfazer
          </button>
        </span>
      ),
      { id: `add-${product.id}` },
    )
  }

  const handleDecrease = () => {
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1)
      return
    }
    removeItem(product.id)
  }

  const handleIncrease = () => {
    addItem(product, 1)
    fireAddToCartEvent()
  }

  const badgeColorClass = ({
    urgent: 'border-red-600 bg-red-600 text-white',
    promo: 'border-emerald-500 bg-emerald-500 text-white',
    frozen: 'border-sky-500 bg-sky-500 text-white',
    pet: 'border-violet-600 bg-violet-600 text-white',
    tobacco: 'border-zinc-700 bg-zinc-700 text-white',
    top: 'border-orange-500 bg-orange-500 text-white',
    default: 'border-[#5D082A] bg-[#5D082A] text-white',
  } as Record<string, string>)[viewModel.badgeVariant] ?? 'border-[#5D082A] bg-[#5D082A] text-white'

  const isCarousel = variant === 'carousel'

  return (
    <article
      className={surfaceClasses({
        interactive: true,
        className: cn(
          'group flex h-full flex-col overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-[2.5px] hover:border-[#D2BB8A]',
          isCarousel ? 'w-[160px] md:w-[220px] shrink-0 snap-start' : 'w-full',
        ),
      })}
    >
      {/* Imagem + botao + badges */}
      <div className="relative aspect-square overflow-hidden bg-gray-50 border-b border-[#E8D7B0]/30">
        <Link
          to={`/produto/${product.id}`}
          className="absolute inset-0 flex items-center justify-center"
          aria-label={`Ver detalhes de ${formatProductTitle(product.name)}`}
        >
          {!imgError ? (
            <img
              src={imageUrl}
              alt={product.name}
              width={200}
              height={200}
              className="w-full h-full object-contain p-1.5 group-hover:scale-[1.03] transition-transform duration-300"
              onError={() => {
                if (imageIndex < imageCandidates.length - 1) {
                  setImageIndex((prev) => prev + 1)
                  return
                }
                setImgError(true)
              }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <ProductImagePlaceholder size="md" />
          )}
        </Link>

        {/* Overlay indisponivel */}
        {viewModel.outOfStock && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/10 pb-3 pointer-events-none">
            <span className="rounded-md border border-white/45 bg-white/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3f3f46] backdrop-blur-md">
              Indisponivel
            </span>
          </div>
        )}

        {/* Badge top-left */}
        {!viewModel.outOfStock && (viewModel.badgeText || viewModel.isFractional) && (
          <div className="absolute left-2 top-2 flex flex-col gap-1 pointer-events-none">
            {viewModel.badgeText && (
              <Badge className={cn('w-fit text-[9px] tracking-[0.12em]', badgeColorClass)}>
                {viewModel.badgeText}
              </Badge>
            )}
            {viewModel.isFractional && (
              <Badge tone="neutral" className="w-fit normal-case tracking-normal">
                Pesavel
              </Badge>
            )}
          </div>
        )}

        {/* Botao + flutuante */}
        {!viewModel.outOfStock && quantity === 0 && (
          <Button
            onClick={handleAdd}
            size="icon"
            className="absolute bottom-2 right-2 z-10 h-11 w-11 rounded-full hover:scale-110"
            aria-label={`Adicionar ${formatProductTitle(product.name)} ao carrinho`}
          >
            <Plus className="h-5 w-5" strokeWidth={2.8} />
          </Button>
        )}
      </div>

      {/* Unidade/Peso Toggle — reserva espaço fixo para alinhar cards (M11-D fix) */}
      <div className="flex justify-center w-full px-2 pt-2 gap-2 min-h-[2.25rem]">
        {product.isFractional && (
          <>
            <Button
              onClick={() => setUnitMode('unit')}
              variant={unitMode === 'unit' ? 'primary' : 'subtle'}
              size="sm"
              className="h-8 flex-1 rounded-full"
            >
              Unidade
            </Button>
            <Button
              onClick={() => setUnitMode('weight')}
              variant={unitMode === 'weight' ? 'primary' : 'subtle'}
              size="sm"
              className="h-8 flex-1 rounded-full"
            >
              Peso
            </Button>
          </>
        )}
      </div>

      {/* Informacoes do produto */}
      <div className="flex flex-1 flex-col p-3">
        <div className="space-y-1 min-h-[4.35rem]">
          {viewModel.eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A6A3A]">
              {viewModel.eyebrow}
            </p>
          )}

          <Link to={`/produto/${product.id}`} className="block">
            <h3 className="font-sans text-[13px] font-semibold leading-snug text-[#231F20] line-clamp-3 hover:text-[#5D082A] transition-colors">
              {formatProductTitle(viewModel.title)}
            </h3>
          </Link>

          <p className={`text-[11px] leading-relaxed line-clamp-1 min-h-[1rem] ${viewModel.helperText ? 'text-gray-400' : 'text-transparent select-none'}`}>
            {viewModel.helperText || '\u00a0'}
          </p>
        </div>

        <div className="mt-auto pt-0 flex flex-col justify-end">
          {/* Bloco de preco */}
          <div className="px-0.5 py-0">
            {viewModel.referenceText && (
              <p className="mb-0.5 text-[10px] font-medium leading-none text-gray-500">
                {viewModel.referenceText}
              </p>
            )}

            <div className="flex items-baseline gap-0.5 leading-none">
              <span className="text-[11px] font-semibold text-[#5D082A]">{pricePresentation.currencySymbol}</span>
              <p className="text-[1.82rem] font-bold leading-none text-[#5D082A] tracking-[-0.02em]">
                {pricePresentation.value}
              </p>
              {pricePresentation.suffix && (
                <span className="text-[11px] font-medium leading-none text-gray-600">
                  {pricePresentation.suffix}
                </span>
              )}
            </div>

            {viewModel.originalPrice && (
              <div className="mt-1.5 flex items-center gap-2">
                {viewModel.discountPct >= 5 && (
                  <span className="rounded-sm bg-[#F3E3EC] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#5D082A]">
                    {viewModel.discountPct}% OFF
                  </span>
                )}
                <p className="text-[11px] font-medium leading-none text-gray-400 line-through">
                  {formatPrice(viewModel.originalPrice)}
                </p>
              </div>
            )}
          </div>

          {/* Controles - qty + */}
          {!viewModel.outOfStock && quantity > 0 && (
            <div className="mt-1 flex items-center rounded-lg border border-[#E8D7B0]/80 bg-[#FBF7F0] p-1">
              <Button
                onClick={handleDecrease}
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-white"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4" strokeWidth={2.4} />
              </Button>

              <div className="flex flex-1 flex-col items-center justify-center">
                <span className="text-sm font-black leading-none text-[#231F20]">{displayQuantity}</span>
                <span className="text-[9px] uppercase tracking-[0.14em] text-gray-500">no carrinho</span>
              </div>

              <Button
                onClick={handleIncrease}
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-white"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
