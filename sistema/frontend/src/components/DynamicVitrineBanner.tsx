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
  // 07/10/2026 (revisao de UI/UX): no celular era um bloco bordo de ~140px
  // so de texto, entre o banner e a primeira vitrine. Virou uma faixa: o
  // bloco todo e o link, e o botao so aparece por extenso no computador.
  const to = tagFoco ? `/mercado?tag=${encodeURIComponent(tagFoco)}` : '/mercado'
  return (
    <div className="max-w-7xl mx-auto px-4 pt-3">
      <Link
        to={to}
        className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#5D082A] to-[#7A1338] px-4 py-3 sm:px-8 sm:py-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-white sm:text-lg">{headline}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-white/75 sm:line-clamp-2 sm:text-sm">{subheadline}</p>
        </div>
        <span className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'hidden shrink-0 whitespace-nowrap sm:inline-flex' })}>
          {ctaLabel}
          <ArrowRight size={16} />
        </span>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D2BB8A] text-[#231F20] sm:hidden">
          <ArrowRight size={18} />
        </span>
      </Link>
    </div>
  )
}
