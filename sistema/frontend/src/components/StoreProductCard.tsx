import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Flame } from 'lucide-react'
import toast from 'react-hot-toast'
import { ProductImagePlaceholder } from './ProductImagePlaceholder'
import { useCart } from '../hooks/useCart'
import type { Product } from '../types'
import { productPath } from '../utils/productUrl'
import { formatPrice, formatProductTitle } from '../utils/format'
import { getProductCardViewModel } from '../utils/productCard'
import { fractionNote } from '../utils/productDetailSchema'
import { useSaleWeekday } from '../hooks/useDeliveryOperation'
import { formatProductQuantity, getPackageSize, getProductPricePresentation, getUnitReference } from '../utils/productPricing'
import { trackEvent } from '../utils/analytics'
import { cn } from '../lib/cn'

type StoreProductCardProps = {
  product: Product
  source: 'HOME' | 'SEARCH'
  /** carousel: vitrine horizontal | grid: lista em colunas | row: destaque largo (vitrine com 1 ou 2 itens). */
  variant?: 'carousel' | 'grid' | 'row'
  analyticsMeta?: Record<string, unknown>
}

// Card refeito em 07/10/2026 (revisao de UI/UX do storefront, padrao dos apps
// lideres de supermercado): preco antes do nome (o cliente escaneia preco),
// "+" que vira seletor de quantidade em cima da foto (o card nao cresce ao
// comprar), selo "-25%" no lugar de "Promocao", e no carrossel 2 cards e meio
// por tela no celular -- o pedaco do terceiro mostra que a vitrine rola.
// Sai o selo "Pesavel" e o texto cru do ERP ("Precos de produtos pesaveis
// podem sofrer variacao"): o preco ja diz "/500 g" e a linha de baixo da o kg.

const BADGE_CLASS: Record<string, string> = {
  urgent: 'bg-[#E53E3E] text-white',
  promo: 'bg-[#5D082A] text-white',
  frozen: 'bg-sky-500 text-white',
  pet: 'bg-violet-600 text-white',
  tobacco: 'bg-zinc-700 text-white',
  top: 'bg-orange-500 text-white',
  // Etiqueta do admin (Importado, Premium, Luxo...): o dourado da adega.
  label: 'bg-[#D2BB8A] text-[#231F20]',
  default: 'bg-[#5D082A] text-white',
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

  const cartItem = cart.find((item) => item.productId === product.id)
  const quantity = cartItem?.quantity || 0
  const imageBaseUrl = `/uploads/products/${product.ean}`
  // 3 (01/10/2026): URL nova na borda, com o cache de 5 min no navegador.
  const imageVersion = '3'
  const imageCandidates = [`/thumbs/products/${product.ean}.webp`, `${imageBaseUrl}.webp`, `${imageBaseUrl}.jpg`, `${imageBaseUrl}.jpeg`, `${imageBaseUrl}.png`]
    .map((url) => `${url}?v=${imageVersion}`)
  const imageUrl = imageCandidates[imageIndex]
  const saleWeekday = useSaleWeekday()
  const viewModel = useMemo(() => getProductCardViewModel(product, saleWeekday), [product, saleWeekday])
  const price = useMemo(() => getProductPricePresentation(product), [product])
  const title = formatProductTitle(product.name)
  // Pesavel mostra o peso no carrinho ("1,25 kg").
  const displayQuantity = formatProductQuantity(product, quantity)
  // Linha de apoio: no pesavel, preco do kg e quanto a porcao rende; nos
  // outros, o tamanho da embalagem e o preco do kg/L (08/10/2026) -- o nome
  // corta em duas linhas e a medida, no fim dele, sumia.
  const note = product.isFractional ? fractionNote(product.alternativeDescription) : ''
  const detail = product.isFractional
    ? [viewModel.referenceText, note].filter(Boolean).join(' · ')
    : [getPackageSize(product), getUnitReference(product)].filter(Boolean).join(' · ')
  const badge = viewModel.badgeVariant === 'promo' && viewModel.discountPct >= 1 ? `-${viewModel.discountPct}%` : viewModel.badgeText

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
          <span className="line-clamp-2">{title} no carrinho</span>
          <button
            type="button"
            onClick={() => {
              removeItem(product.id)
              toast.dismiss(t.id)
            }}
            className="shrink-0 rounded-md border border-[#D2BB8A]/60 px-2 py-1 text-caption font-semibold uppercase tracking-wide text-[#D2BB8A] hover:bg-[#D2BB8A]/15"
          >
            Desfazer
          </button>
        </span>
      ),
      { id: `add-${product.id}`, duration: 1500, position: 'top-center' },
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

  const isRow = variant === 'row'

  const image = (
    <div className={cn('relative shrink-0 overflow-hidden bg-white', isRow ? 'h-28 w-28 rounded-xl' : 'aspect-square w-full')}>
      <Link to={productPath(product)} className="absolute inset-0 flex items-center justify-center" aria-label={`Ver detalhes de ${title}`}>
        {!imgError ? (
          <img
            src={imageUrl}
            alt={product.name}
            width={200}
            height={200}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
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

      {viewModel.outOfStock ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-white/40 pb-2">
          <span className="whitespace-nowrap rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3f3f46] shadow-sm">
            {viewModel.unavailableLabel}
          </span>
        </div>
      ) : (
        badge && (
          <span
            className={cn(
              'pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black leading-none',
              BADGE_CLASS[viewModel.badgeVariant] ?? BADGE_CLASS.default,
            )}
          >
            {viewModel.badgeVariant === 'urgent' && <Flame className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />}
            {badge}
          </span>
        )
      )}

      {/* "+" vira seletor de quantidade no mesmo lugar: o card nao muda de altura ao comprar. */}
      {!viewModel.outOfStock && !isRow && (
        quantity === 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            aria-label={`Adicionar ${title} ao carrinho`}
            className="absolute bottom-1.5 right-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#5D082A] text-white shadow-md transition-transform hover:scale-110 active:scale-95 before:absolute before:-inset-1 before:content-['']"
          >
            <Plus className="h-5 w-5" strokeWidth={2.8} />
          </button>
        ) : (
          <QuantityPill label={displayQuantity} onDecrease={handleDecrease} onIncrease={handleIncrease} className="absolute inset-x-1.5 bottom-1.5 z-10" />
        )
      )}
    </div>
  )

  const priceBlock = (
    <div className="leading-none">
      {viewModel.originalPrice && (
        <p className="mb-0.5 text-[11px] font-medium text-gray-400 line-through">{formatPrice(viewModel.originalPrice)}</p>
      )}
      <p className="flex items-baseline gap-0.5 text-[#5D082A]">
        <span className="text-[11px] font-bold">{price.currencySymbol}</span>
        <span className="text-[19px] font-black tracking-tight">{price.value}</span>
        {price.suffix && <span className="ml-0.5 text-[11px] font-medium text-gray-500">{price.suffix}</span>}
      </p>
    </div>
  )

  if (isRow) {
    return (
      <article className="group flex w-full items-center gap-3 rounded-2xl border border-[#EFE6D2] bg-white p-2.5 pr-3 transition-shadow hover:shadow-md">
        {image}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {priceBlock}
          <Link to={productPath(product)} className="block">
            <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-[#231F20] hover:text-[#5D082A]">{title}</h3>
          </Link>
          {detail && <p className="truncate text-[11px] text-gray-500">{detail}</p>}
        </div>
        {!viewModel.outOfStock &&
          (quantity === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              aria-label={`Adicionar ${title} ao carrinho`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5D082A] text-white shadow-md active:scale-95"
            >
              <Plus className="h-5 w-5" strokeWidth={2.8} />
            </button>
          ) : (
            <QuantityPill vertical label={displayQuantity} onDecrease={handleDecrease} onIncrease={handleIncrease} />
          ))}
      </article>
    )
  }

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-[#EFE6D2] bg-white transition-shadow hover:shadow-md',
        // Carrossel: 2 cards e meio por tela no celular (o pedaco do 3o mostra que
        // rola), 4 no tablet e 6 no computador -- gap-3 (12px) do ProductShelf.
        variant === 'carousel' ? 'w-[40%] min-w-[140px] max-w-[190px] shrink-0 snap-start md:w-[calc(25%-9px)] md:max-w-none lg:w-[calc(16.666%-10px)]' : 'w-full',
      )}
    >
      {image}
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-3 pt-2">
        {priceBlock}
        <Link to={productPath(product)} className="block">
          <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-medium leading-snug text-[#231F20] transition-colors hover:text-[#5D082A]">{title}</h3>
        </Link>
        {detail && <p className="truncate text-[11px] leading-tight text-gray-500">{detail}</p>}
      </div>
    </article>
  )
}

function QuantityPill({
  label,
  onDecrease,
  onIncrease,
  className,
  vertical = false,
}: {
  label: string
  onDecrease: () => void
  onIncrease: () => void
  className?: string
  vertical?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-full bg-[#5D082A] text-white shadow-md',
        vertical ? 'h-auto shrink-0 flex-col-reverse py-0.5' : 'h-9',
        className,
      )}
    >
      <button type="button" onClick={onDecrease} aria-label="Diminuir quantidade" className="flex h-9 w-9 items-center justify-center active:scale-90">
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-[28px] text-center text-sm font-black tabular-nums">{label}</span>
      <button type="button" onClick={onIncrease} aria-label="Aumentar quantidade" className="flex h-9 w-9 items-center justify-center active:scale-90">
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  )
}
