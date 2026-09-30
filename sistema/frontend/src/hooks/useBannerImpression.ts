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
  useSeenOnce(bannerId, ref, (id) => cmsAPI.storeBanners.registerImpression(id))
}

/** Mesma regra, para a vitrine patrocinada (relatorio pro fornecedor, 30/09/2026). */
export function useSponsoredShelfImpression(shelfId: string | undefined, ref: RefObject<HTMLElement | null>) {
  useSeenOnce(shelfId, ref, (id) => cmsAPI.sponsoredShelves.registerImpression(id))
}

function useSeenOnce(id: string | undefined, ref: RefObject<HTMLElement | null>, register: (id: string) => Promise<unknown>) {
  const jaContou = useRef(false)
  const registerRef = useRef(register)
  registerRef.current = register

  useEffect(() => {
    const el = ref.current
    if (!id || !el || jaContou.current) return

    // Navegador sem IntersectionObserver (ou ambiente de teste): conta no
    // mount em vez de nao contar nada.
    if (typeof IntersectionObserver === 'undefined') {
      jaContou.current = true
      registerRef.current(id).catch(() => {})
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || jaContou.current) continue
          jaContou.current = true
          registerRef.current(id).catch(() => {})
          observer.disconnect()
        }
      },
      // Metade visivel -- um sliver aparecendo na borda da tela durante o
      // scroll rapido nao e' impressao.
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [id, ref])
}
