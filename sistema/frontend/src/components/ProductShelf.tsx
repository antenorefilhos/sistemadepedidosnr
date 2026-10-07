import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product } from '../types'
import { StoreProductCard } from './StoreProductCard'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useDragScroll } from '../hooks/useDragScroll'
import { cn } from '../lib/cn'
import type { CategoryIconComponent } from '../utils/homeCategories'

export type ProductShelfLayout = 'carousel' | 'grid'

type ProductShelfProps = {
  /** Titulo principal da vitrine. */
  title: string
  /** Linha pequena acima do titulo (opcional: a Home nao repete mais o mesmo texto em toda vitrine). */
  eyebrow?: string
  icon: CategoryIconComponent
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
  /** Nome da vitrine no ADD_TO_CART -- a tela Layout do Site mostra o que cada uma vende. */
  shelf?: string
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
  shelf,
}: ProductShelfProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useAutoScroll(scrollRef, autoScroll && layout === 'carousel')
  const dragScroll = useDragScroll(scrollRef)

  if (products.length === 0) return null

  // Vitrine com 1 ou 2 produtos vira destaque largo: um card sozinho num
  // carrossel parecia vitrine quebrada ("Ofertas de hoje" com 1 item, 07/10/2026).
  const isFew = layout === 'carousel' && products.length <= 2
  const isCarousel = layout === 'carousel' && !isFew
  const scrollByCard = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -460 : 460, behavior: 'smooth' })
  }

  return (
    <section className={cn('fade-in-section min-w-0', className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <span className="block text-label font-bold uppercase tracking-[0.04em] text-[#8A6A3A]">
              {eyebrow}
            </span>
          )}
          <h2 className={cn('flex items-center gap-2 text-lg font-bold leading-tight text-[#231F20]', eyebrow && 'mt-1')}>
            <Icon size={19} className="shrink-0 text-[#5D082A]" />
            <span className="line-clamp-2">{title}</span>
          </h2>
        </div>
        <Link
          to={to}
          className="relative z-10 -my-3.5 flex shrink-0 items-center gap-0.5 py-3.5 text-xs font-bold text-[#5D082A] hover:underline"
        >
          {linkLabel}
          <ChevronRight size={14} />
        </Link>
      </div>

      {isCarousel ? (
        <div className="group/shelf relative">
          {/* Celular: o carrossel vai ate a borda da tela (-mx-4) e encaixa respeitando o recuo.
              overflow-anchor:none -- quando a lista se reordena (embaralhada de novo ao
              chegar a config da loja), o navegador seguia o 1o card e abria a vitrine
              no meio (scrollLeft 555, 1850, 4995... em producao, 07/10/2026). */}
          <div
            ref={scrollRef}
            className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [overflow-anchor:none] md:mx-0 md:scroll-px-0 md:px-0"
            {...dragScroll.dragProps}
          >
            {products.map((product) => (
              <StoreProductCard key={product.id} product={product} source="HOME" variant="carousel" analyticsMeta={shelf ? { shelf } : undefined} />
            ))}
          </div>

          {/* Setas de navegacao -- so desktop, aparecem no hover OU no foco
              por teclado da vitrine (JON-173: so tinham group-hover, entao
              tabular ate o botao o deixava focado mas invisivel -- foco sem
              indicacao visual nenhuma). O avanco pra fora e 1/3 (12px num
              botao de 36px), nao 1/2: a vitrine vive dentro de um container
              com px-4, entao um avanco de 18px estourava 2px alem da
              viewport e deixava a pagina inteira com scroll horizontal em
              qualquer largura abaixo do max-w-7xl. */}
          <button
            type="button"
            onClick={() => scrollByCard('left')}
            aria-label="Produtos anteriores"
            className="absolute left-0 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 -translate-x-1/3 items-center justify-center rounded-full border border-gray-200 bg-white text-[#5D082A] opacity-0 shadow-md transition-opacity hover:bg-[#FBF7F0] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D082A] group-hover/shelf:opacity-100 group-focus-within/shelf:opacity-100 md:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('right')}
            aria-label="Próximos produtos"
            className="absolute right-0 top-[calc(50%-0.75rem)] z-10 hidden h-9 w-9 translate-x-1/3 items-center justify-center rounded-full border border-gray-200 bg-white text-[#5D082A] opacity-0 shadow-md transition-opacity hover:bg-[#FBF7F0] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D082A] group-hover/shelf:opacity-100 group-focus-within/shelf:opacity-100 md:flex"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : isFew ? (
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((product) => (
            <StoreProductCard key={product.id} product={product} source="HOME" variant="row" analyticsMeta={shelf ? { shelf } : undefined} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <StoreProductCard key={product.id} product={product} source="HOME" variant="grid" analyticsMeta={shelf ? { shelf } : undefined} />
          ))}
        </div>
      )}
    </section>
  )
}
