import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useIsDesktop } from '../hooks/useMediaQuery'

// JON-195: limiar diferente por viewport -- pedido explicito de 1000px no
// desktop (telas altas, rola mais antes de precisar do atalho) e 800px no
// mobile (viewport menor, 800px de scroll ja e bem mais conteudo relativo).
const THRESHOLD_DESKTOP = 1000
const THRESHOLD_MOBILE = 800

export function BackToTopButton() {
  const isDesktop = useIsDesktop()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const threshold = isDesktop ? THRESHOLD_DESKTOP : THRESHOLD_MOBILE
    const handleScroll = () => setVisible(window.scrollY > threshold)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isDesktop])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      // Celular: canto esquerdo e discreto -- no direito cobria o "+" dos cards (07/10/2026).
      className="fixed bottom-[calc(var(--mobile-nav-height,4rem)+0.75rem)] left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-[#E8D7B0] bg-white/95 text-[#5D082A] shadow-lg transition-transform hover:scale-105 md:bottom-8 md:left-auto md:right-4 md:h-11 md:w-11 md:border-0 md:bg-[#5D082A] md:text-white"
    >
      <ArrowUp size={20} />
    </button>
  )
}
