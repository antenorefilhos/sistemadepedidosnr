import { useEffect, useRef, type RefObject } from 'react'
import { cmsAPI } from '../services/api'

/**
 * Conta uma impressao quando o banner aparece de fato na tela.
 *
 * "Aparecer" e' entrar na viewport, nao ser renderizado: o carrossel mantem
 * todos os slides montados (so desliza a faixa) e a Home monta banners bem
 * abaixo da dobra. Contar no render inflaria o numero com banner que ninguem
 * viu -- e esse numero e' o que vai sustentar conversa com anunciante, entao
 * precisa significar "foi visto".
 *
 * Dispara UMA vez por montagem: rolar pra baixo e voltar nao conta de novo, e
 * o mesmo banner reaparecendo no carrossel tambem nao. Falha de rede e
 * engolida de proposito -- metrica nao pode quebrar a vitrine.
 */
export function useBannerImpression(bannerId: string | undefined, ref: RefObject<HTMLElement | null>) {
  const jaContou = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!bannerId || !el || jaContou.current) return

    // Navegador sem IntersectionObserver (ou ambiente de teste): conta no
    // mount em vez de nao contar nada.
    if (typeof IntersectionObserver === 'undefined') {
      jaContou.current = true
      cmsAPI.storeBanners.registerImpression(bannerId).catch(() => {})
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || jaContou.current) continue
          jaContou.current = true
          cmsAPI.storeBanners.registerImpression(bannerId).catch(() => {})
          observer.disconnect()
        }
      },
      // Metade do banner visivel -- um sliver aparecendo na borda da tela
      // durante o scroll rapido nao e' impressao.
      { threshold: 0.5 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [bannerId, ref])
}
