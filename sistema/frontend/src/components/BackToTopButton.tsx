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
      className="fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#5D082A] text-white shadow-lg transition-transform hover:scale-105 md:bottom-8"
    >
      <ArrowUp size={20} />
    </button>
  )
}
