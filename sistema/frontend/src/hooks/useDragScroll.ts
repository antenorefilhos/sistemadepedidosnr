import { useRef, type RefObject } from 'react'

/**
 * Drag-to-scroll com mouse para linhas horizontais (categorias, prateleiras).
 * No touch o scroll nativo ja funciona; no desktop, sem isso, o unico jeito
 * de ver o que passa da tela e o scroll do mouse (nada obvio) -- o
 * scrollbar fica escondido de proposito (no-scrollbar) pra nao poluir.
 *
 * Passe um ref existente (`externalRef`) quando o container ja tem outro uso
 * pro ref (ex.: auto-scroll) -- assim os dois dividem o mesmo elemento.
 */
export function useDragScroll<T extends HTMLElement>(externalRef?: RefObject<T | null>) {
  const ownRef = useRef<T | null>(null)
  const ref = externalRef ?? ownRef
  const state = useRef({ dragging: false, startX: 0, startScrollLeft: 0, moved: false })

  const onMouseDown = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    state.current = { dragging: true, startX: e.pageX, startScrollLeft: el.scrollLeft, moved: false }
    // O container pode ter scroll-snap. Cada atribuicao de scrollLeft conta
    // como um scroll terminado, entao o browser re-encaixa no ponto de snap na
    // hora -- com `mandatory` o conteudo fica travado no card atual e so pula
    // pro seguinte depois da metade, em vez de acompanhar o mouse. Desliga
    // durante o arrasto e devolve ao soltar, quando o snap encaixa certinho.
    el.style.scrollSnapType = 'none'
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || !state.current.dragging) return
    const delta = e.pageX - state.current.startX
    if (Math.abs(delta) > 3) state.current.moved = true
    el.scrollLeft = state.current.startScrollLeft - delta
  }

  const stopDrag = () => {
    if (!state.current.dragging) return
    state.current.dragging = false
    // Devolve o snap (a regra volta a valer pela classe do elemento) -- ao
    // limpar o inline style o browser encaixa no card mais proximo sozinho.
    if (ref.current) ref.current.style.scrollSnapType = ''
  }

  // Depois de um drag de verdade, ignora o proximo click (evita abrir o
  // produto/categoria por baixo do dedo ao soltar o mouse).
  const onClickCapture = (e: React.MouseEvent) => {
    if (state.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      state.current.moved = false
    }
  }

  return {
    // RefObject<T | null> nao bate com o LegacyRef<T> que o JSX espera --
    // fricção conhecida do typing do React 18 pra useRef(null); o ref e
    // sempre nullable de verdade (antes do mount), o cast so alinha o tipo.
    ref: ref as RefObject<T>,
    dragProps: {
      onMouseDown,
      onMouseMove,
      onMouseUp: stopDrag,
      onMouseLeave: stopDrag,
      onClickCapture,
    },
  }
}
