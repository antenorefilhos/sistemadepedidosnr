import { useEffect, useState } from 'react'

/**
 * Observa uma media query e re-renderiza quando o match muda.
 *
 * Como o storefront e' client-side (Vite SPA, sem SSR), o valor inicial ja'
 * vem correto do `matchMedia` na primeira renderizacao — evita flash da arvore
 * errada. Fora do browser (fallback defensivo) assume `false`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia(query)
    const handleChange = () => setMatches(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

/**
 * `true` a partir do breakpoint `md` do Tailwind (>= 768px).
 * Use para montar apenas a arvore do viewport atual (mobile OU desktop),
 * em vez de renderizar as duas e esconder uma com CSS.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
