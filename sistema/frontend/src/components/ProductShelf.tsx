import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { Product } from '../types'
import { StoreProductCard } from './StoreProductCard'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { cn } from '../lib/cn'

export type ProductShelfLayout = 'carousel' | 'grid'

type ProductShelfProps = {
  /** Titulo principal da vitrine. */
  title: string
  /** Linha pequena acima do titulo. */
  eyebrow: string
  icon: LucideIcon
  products: Product[]
  /** Destino do link "ver mais". */
  to: string
  linkLabel?: string
  /**
   * `carousel` rola horizontalmente (com auto-scroll); `grid` usa 2 colunas.
   */
  layout?: ProductShelfLayout
  /** Classes do <section> (ex.: `md:hidden` para vitrine exclusiva de mobile). */
  className?: string
  /** Desliga o auto-scroll do carrossel. */
  autoScroll?: boolean
}

/**
 * Vitrine de produtos da Home. Cuida do proprio ref de scroll e auto-scroll,
 * e nao renderiza nada quando nao ha produtos.
 */
export function ProductShelf({
  title,
  eyebrow,
  icon: Icon,
  products,
  to,
  linkLabel = 'Ver',
  layout = 'carousel',
  className,
  autoScroll = true,
}: ProductShelfProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useAutoScroll(scrollRef, autoScroll && layout === 'carousel')

  if (products.length === 0) return null

  const isCarousel = layout === 'carousel'

  return (
    <section className={cn('fade-in-section min-w-0', className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-label font-bold uppercase tracking-[0.04em] text-[#8A6A3A]">
            {eyebrow}
          </span>
          <h2
            className={cn(
              'mt-1 flex items-center gap-2 font-bold text-[#231F20]',
              isCarousel ? 'text-base' : 'text-xl',
            )}
          >
            <Icon size={isCarousel ? 18 : 20} className="shrink-0 text-[#5D082A]" />
            <span className="truncate">{title}</span>
          </h2>
        </div>
        <Link
          to={to}
          className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#5D082A] hover:underline"
        >
          {linkLabel}
          {isCarousel && <ArrowRight size={13} />}
        </Link>
      </div>

      {isCarousel ? (
        <div
          ref={scrollRef}
          className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3"
        >
          {products.map((product) => (
            <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <StoreProductCard key={product.id} product={product} source="HOME" variant="grid" />
          ))}
        </div>
      )}
    </section>
  )
}
