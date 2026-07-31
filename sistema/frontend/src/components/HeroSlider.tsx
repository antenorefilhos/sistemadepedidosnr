import { useEffect, useState } from 'react'
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
  active?: boolean
  order?: number
}

const AUTO_ADVANCE_MS = 6500

function isExternalLink(link: string) {
  return /^https?:\/\//i.test(link)
}

export function HeroSlider({ slides }: { slides: HeroSlideCMS[] }) {
  const [index, setIndex] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (index >= slides.length) setIndex(0)
  }, [slides.length, index])

  useEffect(() => {
    if (slides.length < 2 || prefersReducedMotion) return
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [slides.length, prefersReducedMotion])

  if (slides.length === 0) return null

  const slide = slides[index] ?? slides[0]
  const link = slide.link || '/mercado'

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
      className={surfaceClasses({
        tone: 'dark',
        className:
          'relative overflow-hidden border-[#D2BB8A]/40 bg-gradient-to-r from-[#5D082A] via-[#7B1038] to-[#231F20] p-6 shadow-xl md:p-8',
      })}
      style={
        slide.imageUrl
          ? {
              backgroundImage: `linear-gradient(90deg, rgba(93,8,42,0.92) 0%, rgba(123,16,56,0.82) 45%, rgba(35,31,32,0.55) 100%), url(${slide.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
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
              onClick={() => setIndex(i)}
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
