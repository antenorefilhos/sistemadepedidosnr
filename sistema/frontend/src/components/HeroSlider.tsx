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
// Quanto do arrasto passa pra tela quando nao ha card do outro lado (primeiro
// slide puxado pra direita, ultimo puxado pra esquerda). Sem isso o track
// mostraria o vazio ao lado da faixa.
const EDGE_RESISTANCE = 0.35

const ALIGN_CLASSES: Record<HeroSlideAlign, string> = {
  left: 'self-start items-start text-left',
  center: 'self-center items-center text-center',
  right: 'self-end items-end text-right',
}

const DESCRIPTION_ALIGN_CLASSES: Record<HeroSlideAlign, string> = {
  left: '',
  center: 'mx-auto',
  right: 'ml-auto',
}

const DOTS_POSITION_CLASSES: Record<HeroSlideAlign, string> = {
  left: 'left-4 sm:left-6 md:left-8',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-4 sm:right-6 md:right-8',
}

const CARD_MIN_HEIGHT = 'min-h-[220px] md:min-h-[320px] lg:min-h-[360px]'

function isExternalLink(link: string) {
  return /^https?:\/\//i.test(link)
}

export function HeroSlider({ slides }: { slides: HeroSlideCMS[] }) {
  const [index, setIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  // Bumped a cada interacao manual (swipe/teclado/bolinha) pra reiniciar o
  // timer de auto-advance -- sem isso o slide trocava sozinho poucos
  // segundos depois do usuario ja ter escolhido um manualmente.
  const [interactionTick, setInteractionTick] = useState(0)

  // O indice da renderizacao anterior. Com track horizontal, voltar do ultimo
  // slide pro primeiro (auto-advance ou swipe) percorreria todos os cards do
  // meio na animacao. Quando o salto e maior que um vizinho, a transicao e
  // desligada e o track pula direto -- o efeito fica igual ao que o fade
  // antigo fazia nessa volta.
  const previousIndexRef = useRef(index)
  const isWrapJump = Math.abs(index - previousIndexRef.current) > 1
  useEffect(() => {
    previousIndexRef.current = index
  }, [index])

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

  const activeSlide = slides[index] ?? slides[0]
  const activeAlign = activeSlide.align || 'left'
  const hasDots = slides.length > 1

  // Arrasto acompanha o dedo 1:1 (o track inteiro desliza mostrando o card
  // vizinho), com resistencia so nas pontas, onde nao existe vizinho.
  const isPullingPastStart = index === 0 && dragOffset > 0
  const isPullingPastEnd = index === slides.length - 1 && dragOffset < 0
  const visualDragOffset = isDragging
    ? isPullingPastStart || isPullingPastEnd
      ? dragOffset * EDGE_RESISTANCE
      : dragOffset
    : 0

  // Mesmo CTA do PromoBanner (Home.tsx) -- outline branco com texto vinho.
  const ctaClassName = buttonVariants({
    variant: 'outline',
    size: 'sm',
    className:
      'w-fit whitespace-nowrap border-white bg-white font-bold text-[#5D082A] hover:bg-[#F3E7C9] md:h-12 md:px-5 md:text-sm',
  })

  const renderCta = (slide: HeroSlideCMS, isActive: boolean) => {
    if (!slide.ctaLabel) return null
    // Ja resolvido pelo Home.tsx (resolveBannerLink) antes de virar HeroSlideCMS.
    const link = slide.link || '/mercado'
    // Card fora de vista continua no DOM (e o track que desliza), entao o CTA
    // dele sai da ordem de tabulacao -- senao o Tab levaria o foco pra um
    // botao invisivel e o browser arrastaria o container atras dele.
    const shared = {
      className: ctaClassName,
      tabIndex: isActive ? 0 : -1,
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => e.stopPropagation(),
      onTouchStart: (e: ReactTouchEvent<HTMLElement>) => e.stopPropagation(),
    }

    return isExternalLink(link) ? (
      <a href={link} target="_blank" rel="noreferrer" {...shared}>
        {slide.ctaLabel} <ArrowRight size={16} />
      </a>
    ) : (
      <Link to={link} {...shared}>
        {slide.ctaLabel} <ArrowRight size={16} />
      </Link>
    )
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Slides de destaque"
      tabIndex={hasDots ? 0 : -1}
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
        className: `relative ${CARD_MIN_HEIGHT} touch-pan-y select-none overflow-hidden rounded-2xl border-[#D2BB8A]/40 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A]`,
      })}
    >
      {/* Track: os cards ficam lado a lado e a faixa inteira desliza. O fade
          anterior trocava so a imagem de fundo dentro de um container unico,
          entao o conteudo (titulo/CTA) aparecia trocado de uma vez em cima de
          um fundo em transicao. Com o track, cada slide e um card completo que
          entra e sai junto com seu proprio texto. As porcentagens do
          translateX resolvem contra a largura do track (w-full = a do
          container), entao -100% e exatamente um card. */}
      <div
        className={`flex w-full ${
          isDragging || prefersReducedMotion || isWrapJump ? '' : 'transition-transform duration-500 ease-out'
        }`}
        style={{ transform: `translateX(calc(-${index * 100}% + ${visualDragOffset}px))` }}
      >
        {slides.map((slide, i) => {
          const align = slide.align || 'left'
          const isActive = i === index
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${slides.length}`}
              aria-hidden={!isActive}
              className={`relative flex w-full shrink-0 select-none flex-col justify-between bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] p-4 sm:p-6 md:p-8 ${CARD_MIN_HEIGHT} ${
                // Espaco reservado pras bolinhas, que ficam ancoradas na base
                // do slider (fora do track) e passariam por cima do CTA.
                hasDots ? 'pb-10 sm:pb-12 md:pb-14' : ''
              }`}
              style={{
                backgroundImage: slide.imageUrl
                  ? `${buildOverlayGradient(slide.overlayColor || '#5D082A', align)}, url(${slide.imageUrl})`
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  {slide.tag && (
                    <Badge
                      tone="gold"
                      className="h-auto w-fit border-[#D2BB8A] bg-[#D2BB8A] px-2 py-0.5 text-[10px] text-[#231F20] sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      {slide.tag}
                    </Badge>
                  )}
                </div>
                {slide.sponsorName && (
                  <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-white/40 bg-black/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[11px]">
                    {slide.sponsorName}
                  </span>
                )}
              </div>

              <div className={`max-w-2xl ${ALIGN_CLASSES[align]}`}>
                <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white luxury-text sm:text-xl md:text-3xl lg:text-4xl">
                  {slide.title}
                </h3>
                {slide.description && (
                  // Contida em ~2/3 pra nao invadir a foto do produto a direita;
                  // whitespace-pre-line respeita o Enter digitado no admin. A
                  // margem auto acompanha o alinhamento -- sem ela, em
                  // center/right o texto (mais estreito que o bloco) ficaria
                  // preso a esquerda.
                  <p
                    className={`mt-1 line-clamp-3 max-w-[75%] whitespace-pre-line text-xs text-white/85 sm:mt-2 sm:text-sm md:max-w-[60%] md:text-base ${DESCRIPTION_ALIGN_CLASSES[align]}`}
                  >
                    {slide.description}
                  </p>
                )}
              </div>

              <div className={`flex flex-col ${ALIGN_CLASSES[align]}`}>{renderCta(slide, isActive)}</div>
            </div>
          )
        })}
      </div>

      {hasDots && (
        <div
          className={`absolute bottom-4 z-20 flex items-center gap-2 ${DOTS_POSITION_CLASSES[activeAlign]}`}
          role="tablist"
          aria-label="Slides de destaque"
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
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
  )
}
