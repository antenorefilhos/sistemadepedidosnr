import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from './ui/badge'
import { buttonVariants } from './ui/button'
import { surfaceClasses } from './ui/surface'
import { buildOverlayGradient } from '../utils/homeCategories'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export type HeroSlideAlign = 'left' | 'center' | 'right'

export interface HeroSlideCMS {
  id: string
  title: string
  tag?: string | null
  description?: string | null
  ctaLabel?: string | null
  imageUrl: string
  link?: string | null
  sponsorName?: string | null
  overlayColor?: string | null
  align?: HeroSlideAlign
  active?: boolean
  order?: number
}

const AUTO_ADVANCE_MS = 6500
// Abaixo disso conta como toque/clique, nao arrasto -- deixa o link/CTA
// clicavel normalmente em vez de sempre interpretar como swipe.
const SWIPE_THRESHOLD_PX = 40
const TOUCH_SWIPE_THRESHOLD_PX = 35

const ALIGN_CLASSES: Record<HeroSlideAlign, string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
}

const DESCRIPTION_ALIGN_CLASSES: Record<HeroSlideAlign, string> = {
  left: '',
  center: 'mx-auto',
  right: 'ml-auto',
}

function isExternalLink(link: string) {
  return /^https?:\/\//i.test(link)
}

export function HeroSlider({ slides }: { slides: HeroSlideCMS[] }) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

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

  // No iOS WebKit, PointerEvent com setPointerCapture dispara pointercancel
  // assim que o dedo move um pouco, cancelando o arrasto antes do threshold
  // -- eventos de touch nativos (onTouchStart/Move/End) nao sofrem disso.
  // Pointer events seguem cuidando do mouse (desktop); pointerType==='touch'
  // e ignorado aqui pra nao disputar estado com os handlers de touch abaixo
  // (iOS dispara os dois pra um mesmo gesto).
  const dragStartYRef = useRef(0)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (slides.length < 2 || e.pointerType === 'touch') return
    pointerIdRef.current = e.pointerId
    dragStartXRef.current = e.clientX
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
    if (e.pointerType === 'touch' || !isDragging || pointerIdRef.current !== e.pointerId) return
    setDragOffset(e.clientX - dragStartXRef.current)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    if (!isDragging || pointerIdRef.current !== e.pointerId) return
    const delta = e.clientX - dragStartXRef.current
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      goTo(index + (delta < 0 ? 1 : -1))
    }
    setIsDragging(false)
    setDragOffset(0)
    pointerIdRef.current = null
  }

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (slides.length < 2) return
    const touch = e.touches[0]
    dragStartXRef.current = touch.clientX
    dragStartYRef.current = touch.clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - dragStartXRef.current
    const deltaY = touch.clientY - dragStartYRef.current
    if (Math.abs(deltaX) > Math.abs(deltaY)) setDragOffset(deltaX)
  }

  const handleTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const deltaX = e.changedTouches[0].clientX - dragStartXRef.current
    if (Math.abs(deltaX) >= TOUCH_SWIPE_THRESHOLD_PX) {
      goTo(index + (deltaX < 0 ? 1 : -1))
    }
    setIsDragging(false)
    setDragOffset(0)
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
  const align = slide.align || 'left'

  // Arrastando: acompanha o dedo/mouse com leve resistencia nas bordas (nao
  // desliza livre igual um carrossel infinito real, so da o feedback de "ta
  // puxando"). Sem arrastar: 0, a transicao suave assume o resto.
  const dragTransform = isDragging
    ? Math.max(-80, Math.min(80, dragOffset * 0.35))
    : 0

  const ctaClassName = buttonVariants({
    variant: 'secondary',
    size: 'sm',
    className: 'w-fit whitespace-nowrap md:h-12 md:px-5 md:text-sm',
  })
  const cta = slide.ctaLabel ? (
    isExternalLink(link) ? (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className={ctaClassName}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {slide.ctaLabel} <ArrowRight size={16} />
      </a>
    ) : (
      <Link
        to={link}
        className={ctaClassName}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={surfaceClasses({
        tone: 'dark',
        className:
          'relative min-h-[220px] touch-pan-y select-none overflow-hidden rounded-2xl border-[#D2BB8A]/40 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A] md:min-h-[320px] lg:min-h-[360px]',
      })}
    >
      {/* Camadas de fundo -- uma por slide, sempre montadas (nunca remove/recria
          via key), so alterna opacity. Trocar de slide antes disparava
          key={slide.id} -> React desmontava o elemento antigo e montava um
          novo do zero, que renascia em opacity:0 (a keyframe animate-hero-fade)
          -- um frame de fundo vazio/preto entre um slide e outro. Com as duas
          camadas persistentes, o fade e um crossfade real (uma sobe enquanto a
          outra desce ao mesmo tempo), sem nunca passar por "nada visivel". */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className={`absolute inset-0 bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] ${
            isDragging || prefersReducedMotion ? '' : 'transition-opacity duration-[400ms] ease-in-out'
          }`}
          style={{
            opacity: i === index ? 1 : 0,
            // Overlay respeita a cor configurada no admin (mesma funcao do
            // PromoBanner) -- antes era um gradiente de vinho hardcoded e o
            // color picker do CMS nao tinha efeito nenhum no hero.
            backgroundImage: s.imageUrl
              ? `${buildOverlayGradient(s.overlayColor || '#5D082A')}, url(${s.imageUrl})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: i === index ? `translateX(${dragTransform}px)` : undefined,
          }}
        />
      ))}

      {/* Bloco de conteudo unico (badge/titulo/descricao/CTA empilhados) --
          mesmo padrao do PromoBanner (Home.tsx). Um layout de 2 colunas
          (titulo a esquerda, CTA a direita) tornava "alinhamento" ambiguo
          pra configurar, e no mobile viravam flex-col sem items-* explicito
          -- align-items:stretch (default) esticava o CTA a largura toda.
          Um unico bloco alinhado left/center/right resolve os dois. */}
      <div className={`absolute inset-0 z-10 flex flex-col justify-center gap-2 p-4 sm:gap-3 sm:p-6 md:p-8 ${ALIGN_CLASSES[align]}`}>
        {slide.sponsorName && (
          <span className="absolute right-4 top-4 z-10 rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm md:right-6 md:top-6">
            {slide.sponsorName}
          </span>
        )}
        <div className="max-w-2xl">
          {slide.tag && (
            <Badge
              tone="gold"
              className="mb-1.5 h-auto w-fit border-[#D2BB8A] bg-[#D2BB8A] px-2 py-0.5 text-[10px] text-[#231F20] sm:mb-2 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {slide.tag}
            </Badge>
          )}
          <h3 className="mb-1 line-clamp-2 text-lg font-bold leading-tight text-white luxury-text sm:mb-2 sm:text-xl md:text-3xl lg:text-4xl">
            {slide.title}
          </h3>
          {slide.description && (
            // Contida em ~2/3 pra nao invadir a foto do produto a direita;
            // whitespace-pre-line respeita o Enter digitado no admin. A margem
            // auto acompanha o alinhamento -- sem ela, em center/right o texto
            // (mais estreito que o bloco) ficaria preso a esquerda.
            <p
              className={`line-clamp-2 max-w-[75%] whitespace-pre-line text-xs text-white/85 sm:max-w-[65%] sm:text-sm md:line-clamp-none md:max-w-[60%] md:text-base ${DESCRIPTION_ALIGN_CLASSES[align]}`}
            >
              {slide.description}
            </p>
          )}
        </div>
        {cta}

        {slides.length > 1 && (
          <div
            className="mt-1 flex items-center gap-2 sm:mt-2"
            role="tablist"
            aria-label="Slides de destaque"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => goTo(i)}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
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
