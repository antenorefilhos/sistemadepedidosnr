import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from './ui/badge'
import { buttonVariants } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { buildOverlayGradient } from '../utils/homeCategories'
import { cmsAPI } from '../services/api'
import type { Product } from '../types'

/**
 * Card de banner com foto de fundo, usado pelos banners intercalados da Home
 * (slot=intercalado) e pelo banner de topo das paginas de categoria
 * (slot=category). Morava dentro de Home.tsx; foi extraido quando a pagina de
 * categoria passou a precisar dele -- duplicar o layout era o caminho curto
 * pra ele divergir do intercalado, que ja aconteceu antes entre este card e o
 * HeroSlider.
 */
export type PromoBannerView = {
  id?: string
  title: string
  badge?: string
  highlightNote?: string
  highlightedProduct?: Product
  description?: string
  image: string
  ctaLabel?: string
  ctaTo?: string
  align?: 'left' | 'center' | 'right'
  overlayColor?: string
  validUntil?: string
  sponsorName?: string
}

export function PromoBanner({
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
  bannerId,
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
  align?: 'left' | 'center' | 'right'
  overlayColor?: string
  validUntil?: string
  sponsorName?: string
  /** Quando informado, o clique no CTA conta em clicksCount (relatorio do admin). */
  bannerId?: string
}) {
  const tone = overlayColor || '#231F20'
  // Mesmo mapeamento do ALIGN_CLASSES do HeroSlider. self-* (nao items-* no
  // container): a linha do topo precisa manter a largura toda pro
  // justify-between empurrar o patrocinio pra direita.
  const contentAlignClass =
    align === 'right'
      ? 'self-end items-end text-right'
      : align === 'center'
        ? 'self-center items-center text-center'
        : 'self-start items-start text-left'
  // A descricao e mais estreita que o bloco (max-w-*%), entao precisa da
  // margem auto correspondente pra encostar no mesmo lado que o texto aponta
  // -- sem isso, em align=right/center ela ficaria presa a esquerda do bloco.
  const descriptionAlignClass = align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''

  const handleCtaClick = () => {
    if (bannerId) cmsAPI.storeBanners.registerClick(bannerId).catch(() => {})
  }

  return (
    <section className="fade-in-section">
      {/* border-0 anula a borda que surfaceClasses traz por padrao -- a foto
          sangra ate a borda do card, e o filete dourado em volta lia como
          contorno solto. Mesmo tratamento do card do HeroSlider. */}
      <div className={surfaceClasses({ tone: 'warm', className: 'relative min-h-[230px] overflow-hidden border-0 bg-[#F7F0E4] sm:min-h-[260px] md:min-h-[320px] lg:min-h-[340px]' })}>
        <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div
          className="absolute inset-0"
          style={{ background: buildOverlayGradient(tone, align) }}
        />
        {/* Tres zonas (topo / centro / base), mesmo esqueleto do HeroSlider:
            selos no topo, texto no meio, CTA na base. A linha do topo e sempre
            renderizada mesmo vazia -- com um filho a menos o justify-between
            reposicionaria as outras zonas. */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6 md:p-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              {badge && (
                <Badge tone="gold" className="h-auto w-fit border-[#D2BB8A] bg-[#D2BB8A] px-2 py-0.5 text-[9px] text-[#231F20] md:px-3 md:py-1 md:text-xs">
                  {badge}
                </Badge>
              )}
              {validUntil && (
                <Badge className="h-auto w-fit border-white/40 bg-black/30 px-2 py-0.5 text-[9px] text-white backdrop-blur-sm md:px-3 md:py-1 md:text-xs">
                  {validUntil}
                </Badge>
              )}
            </div>
            {sponsorName && (
              <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-white/40 bg-black/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm md:px-2.5 md:py-1 md:text-[11px]">
                {sponsorName}
              </span>
            )}
          </div>

          <div className={`max-w-lg ${contentAlignClass}`}>
            <h3 className="text-lg font-bold leading-tight text-white luxury-text sm:text-xl md:text-2xl lg:text-3xl">{title}</h3>
            {/* Descricao contida em ~2/3 pra nao invadir a foto do produto a
                direita; whitespace-pre-line respeita o Enter que o operador
                digita no textarea do admin. */}
            {description && (
              <p
                className={`mt-1 line-clamp-3 max-w-[75%] whitespace-pre-line text-xs leading-snug text-white/85 sm:mt-2 sm:text-sm md:max-w-[60%] md:leading-relaxed ${descriptionAlignClass}`}
              >
                {description}
              </p>
            )}
            {highlightedProduct && (
              <div className="mt-2 hidden rounded-lg border border-white/30 bg-white/85 p-3 text-left shadow-xl backdrop-blur-sm md:block">
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
          </div>

          <div className={`flex flex-col ${contentAlignClass}`}>
            {ctaLabel && ctaTo && (
              <Link
                to={ctaTo}
                onClick={handleCtaClick}
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'border-white bg-white font-bold text-[#5D082A] hover:bg-[#F3E7C9] md:h-12 md:px-5 md:text-sm',
                })}
              >
                {ctaLabel}
                <ArrowRight size={14} className="md:hidden" />
                <ArrowRight size={16} className="hidden md:block" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
