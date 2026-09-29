import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * Campo de texto que cresce com o conteudo (29/09/2026). Substitui o canto de
 * redimensionar: arrastar esse canto e soltar fora da janela fechava o editor.
 */
export function AutoTextarea({ className = '', value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} value={value} {...props} className={`resize-none overflow-hidden ${className}`} />
}
