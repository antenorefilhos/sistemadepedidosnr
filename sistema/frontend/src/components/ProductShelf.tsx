import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { Product } from '../types'
import { StoreProductCard } from './StoreProductCard'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useDragScroll } from '../hooks/useDragScroll'
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
  /**
   * Liga o auto-scroll do carrossel. Padrao `false`: vitrines de navegacao nao
   * se movem sozinhas (evita varios carrosseis animando ao mesmo tempo).
   */
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
  autoScroll = false,
}: ProductShelfProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useAutoScroll(scrollRef, autoScroll && layout === 'carousel')
  const dragScroll = useDragScroll(scrollRef)

  if (products.length === 0) return null

  const isCarousel = layout === 'carousel'
  const scrollByCard = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -460 : 460, behavior: 'smooth' })
  }

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
          className="relative z-10 -my-3.5 flex shrink-0 items-center gap-0.5 py-3.5 text-xs font-semibold text-[#5D082A] hover:underline"
        >
          {linkLabel}
          {isCarousel && <ArrowRight size={13} />}
        </Link>
      </div>

      {isCarousel ? (
        <div className="group/shelf relative">
          <div
            ref={scrollRef}
            className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-3"
            {...dragScroll.dragProps}
          >
            {products.map((product) => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" />
            ))}
          </div>

          {/* Setas de navegacao -- so desktop, aparecem no hover da vitrine */}
          <button
            type="button"
            onClick={() => scrollByCard('left')}
            aria-label="Produtos anteriores"
            className="absolute left-0 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-[#5D082A] opacity-0 shadow-md transition-opacity hover:bg-[#FBF7F0] group-hover/shelf:opacity-100 md:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('right')}
            aria-label="Próximos produtos"
            className="absolute right-0 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-[#5D082A] opacity-0 shadow-md transition-opacity hover:bg-[#FBF7F0] group-hover/shelf:opacity-100 md:flex"
          >
            <ChevronRight size={18} />
          </button>
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
