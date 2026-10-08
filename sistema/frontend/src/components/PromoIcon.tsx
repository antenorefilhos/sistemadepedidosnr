import { useEffect, useState } from 'react'

// Icone animado do Promo (08/10/2026): o GIF tem 81 quadros (~90 KB) e aparece
// no menu de baixo em TODA pagina -- carregava junto com o que importa (banner,
// produtos). Agora entra parado (2 KB) e vira animacao depois que a pagina
// terminou de carregar. Depois da primeira vez, ja nasce animado.
let animatedReady = false

export function PromoIcon({ size, className }: { size: number; className?: string }) {
  const [animated, setAnimated] = useState(animatedReady)

  useEffect(() => {
    if (animated) return
    let timer = 0
    const go = () => {
      animatedReady = true
      setAnimated(true)
    }
    const schedule = () => {
      timer = window.setTimeout(() => {
        const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
        if (idle) idle(go, { timeout: 2000 })
        else go()
      }, 2500)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      window.clearTimeout(timer)
    }
  }, [animated])

  return (
    <img
      src={animated ? '/icons/icon-promo-menu.gif' : '/icons/icon-promo-menu-static.png'}
      alt=""
      width={size}
      height={size}
      className={className}
    />
  )
}
