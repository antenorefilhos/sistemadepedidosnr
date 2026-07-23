import { useEffect, type RefObject } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type AutoScrollOptions = {
  /** Distancia em px por passo. */
  step?: number
  /** Intervalo entre passos, em ms. */
  intervalMs?: number
}

/**
 * Auto-scroll horizontal suave para carrosseis.
 * Ao chegar no fim, volta ao inicio. Nao faz nada se o conteudo nao rolar
 * nem quando o usuario pediu menos movimento (prefers-reduced-motion).
 */
export function useAutoScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled = true,
  { step = 280, intervalMs = 4000 }: AutoScrollOptions = {},
) {
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (!enabled || prefersReducedMotion) return
    const container = containerRef.current
    if (!container) return

    const tick = () => {
      const maxScroll = container.scrollWidth - container.clientWidth
      if (maxScroll <= 0) return

      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }

      container.scrollBy({ left: step, behavior: 'smooth' })
    }

    const intervalId = setInterval(tick, intervalMs)
    return () => clearInterval(intervalId)
  }, [containerRef, enabled, step, intervalMs])
}
