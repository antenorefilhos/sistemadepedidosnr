import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from './ui/badge'
import { buttonVariants } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export interface HeroSlideCMS {
  id: string
  title: string
  tag?: string | null
  description?: string | null
  ctaLabel?: string | null
  imageUrl: string
  link?: string | null
  sponsorName?: string | null
  active?: boolean
  order?: number
}

const AUTO_ADVANCE_MS = 6500
// Abaixo disso conta como toque/clique, nao arrasto -- deixa o link/CTA
// clicavel normalmente em vez de sempre interpretar como swipe.
const SWIPE_THRESHOLD_PX = 40

function isExternalLink(link: string) {
  return /^https?:\/\//i.test(link)
}

export function HeroSlider({ slides }: { slides: HeroSlideCMS[] }) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const containerWidthRef = useRef(0)
  const dragStartXRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  // Bumped a cada interacao manual (swipe/teclado/bolinha) pra reiniciar o
  // timer de auto-advance -- sem isso o slide trocava sozinho poucos
  // segundos depois do usuario ja ter escolhido um manualmente.
  const [interactionTick, setInteractionTick] = useState(0)

  useEffect(() => {
    if (index >= slides.length) setIndex(0)
  }, [slides.length, index])

  useEffect(() => {
    if (slides.length < 2 || prefersReducedMotion) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [slides.length, prefersReducedMotion, interactionTick])

  const goTo = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length)
    setInteractionTick((t) => t + 1)
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (slides.length < 2) return
    pointerIdRef.current = e.pointerId
    dragStartXRef.current = e.clientX
    containerWidthRef.current = e.currentTarget.offsetWidth
    setIsDragging(true)
    // Pode falhar em navegador/dispositivo com suporte parcial a Pointer
    // Events -- degrada bem sem capture (o pointerup so nao dispara fora do
    // elemento durante o arrasto), nao vale derrubar o gesto inteiro por isso.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignorado de proposito
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== e.pointerId) return
    setDragOffset(e.clientX - dragStartXRef.current)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || pointerIdRef.current !== e.pointerId) return
    const delta = e.clientX - dragStartXRef.current
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      goTo(index + (delta < 0 ? 1 : -1))
    }
    setIsDragging(false)
    setDragOffset(0)
    pointerIdRef.current = null
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (slides.length < 2) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(index + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(index - 1)
    }
  }

  if (slides.length === 0) return null

  const slide = slides[index] ?? slides[0]
  // Ja resolvido pelo Home.tsx (resolveBannerLink) antes de virar HeroSlideCMS.
  const link = slide.link || '/mercado'

  // Arrastando: acompanha o dedo/mouse com leve resistencia nas bordas (nao
  // desliza livre igual um carrossel infinito real, so da o feedback de "ta
  // puxando"). Sem arrastar: 0, a transicao suave assume o resto.
  const dragTransform = isDragging
    ? Math.max(-80, Math.min(80, dragOffset * 0.35))
    : 0

  const ctaClassName = buttonVariants({ variant: 'secondary', size: 'lg', className: 'whitespace-nowrap' })
  const cta = slide.ctaLabel ? (
    isExternalLink(link) ? (
      <a href={link} target="_blank" rel="noreferrer" className={ctaClassName}>
        {slide.ctaLabel} <ArrowRight size={16} />
      </a>
    ) : (
      <Link to={link} className={ctaClassName}>
        {slide.ctaLabel} <ArrowRight size={16} />
      </Link>
    )
  ) : null

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Slides de destaque"
      tabIndex={slides.length > 1 ? 0 : -1}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      className={surfaceClasses({
        tone: 'dark',
        className: 'relative touch-pan-y select-none overflow-hidden border-[#D2BB8A]/40 outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A]',
      })}
    >
      {/* Camada de fundo -- separada do conteudo pra poder transformar/crossfade
          sem mexer no texto por cima. touch-action pan-y libera scroll vertical
          da pagina normalmente, so intercepta o gesto horizontal. */}
      <div
        key={slide.id}
        aria-hidden="true"
        className={`absolute inset-0 bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] ${
          isDragging || prefersReducedMotion ? '' : 'animate-hero-fade transition-transform duration-300 ease-out'
        }`}
        style={{
          backgroundImage: slide.imageUrl
            ? `linear-gradient(90deg, rgba(93,8,42,0.92) 0%, rgba(123,16,56,0.82) 45%, rgba(35,31,32,0.55) 100%), url(${slide.imageUrl})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `translateX(${dragTransform}px)`,
        }}
      />

      <div className="relative z-10 p-6 md:p-8">
        {slide.sponsorName && (
          <span className="absolute right-4 top-4 z-10 rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm md:right-6 md:top-6">
            Patrocinado por {slide.sponsorName}
          </span>
        )}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            {slide.tag && (
              <Badge tone="gold" className="mb-3 h-auto border-[#D2BB8A] bg-[#D2BB8A] px-3 py-1 text-[#231F20]">
                {slide.tag}
              </Badge>
            )}
            <h3 className="text-2xl font-bold text-white luxury-text mb-2 md:text-4xl">{slide.title}</h3>
            {slide.description && <p className="text-sm text-white/80 md:text-base">{slide.description}</p>}
          </div>
          {cta}
        </div>

        {slides.length > 1 && (
          <div className="mt-5 flex items-center gap-2" role="tablist" aria-label="Slides de destaque">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-[#D2BB8A]' : 'w-1.5 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
