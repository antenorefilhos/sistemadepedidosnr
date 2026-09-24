import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from './ui/button'

/**
 * JON-192 (AEF-037, 21/09/2026): faixa de texto puro alimentada por
 * `personalidadeAtiva.bannerPrincipal` (headline/subheadline/ctaTexto), que
 * a AntenorApi recalcula por dia da semana/sazonalidade -- sem foto (a API
 * nao manda imagem pra esse campo, so texto), por isso nao reusa PromoBanner
 * (que exige `image`). Decisao do Jonathan (18/09/2026): nunca substitui o
 * Hero manual (StoreBanner slot=hero) -- sempre aparece como faixa separada,
 * abaixo dele, os dois juntos.
 *
 * 23/09/2026: a API tambem manda `tagFoco` (ex.: "linha-economica"), pensado
 * pra CTA levar pro assunto do banner -- ficou implementado so ate a metade,
 * o botao sempre ia pro /mercado generico. "Economia e Praticidade" com CTA
 * pro catalogo inteiro nao fazia sentido nenhum pro cliente.
 */
export function DynamicVitrineBanner({
  headline,
  subheadline,
  ctaLabel,
  tagFoco,
}: {
  headline: string
  subheadline: string
  ctaLabel: string
  tagFoco?: string
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 pt-3">
      <div className="rounded-xl bg-gradient-to-r from-[#5D082A] to-[#7A1338] px-5 py-4 sm:px-8 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-bold text-base sm:text-lg leading-tight">{headline}</p>
          <p className="text-white/80 text-sm mt-0.5 line-clamp-2">{subheadline}</p>
        </div>
        <Link
          to={tagFoco ? `/mercado?tag=${encodeURIComponent(tagFoco)}` : '/mercado'}
          className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'shrink-0 whitespace-nowrap' })}
        >
          {ctaLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
