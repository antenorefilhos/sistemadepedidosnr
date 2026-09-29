import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

/**
 * Janela de trabalho do admin (29/09/2026, pedido do Jonathan: nada de painel
 * estreito colado na direita). No computador abre centralizada e larga, para
 * caber duas colunas; no celular ocupa a tela inteira como um app, com
 * "voltar" no topo e a acao principal fixa embaixo.
 */
export function WorkspaceDialog({
  label,
  title,
  actions,
  footer,
  children,
  onClose,
  size = 'xl',
  closeOnEsc = true,
}: {
  label: string
  title: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  onClose: () => void
  size?: 'lg' | 'xl'
  closeOnEsc?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => closeOnEsc && e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, closeOnEsc])

  return (
    <div className="fixed inset-0 z-[60] flex bg-black/30 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full flex-col bg-white sm:h-[min(90vh,920px)] sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl ${size === 'lg' ? 'sm:max-w-5xl' : 'sm:max-w-6xl'}`}
      >
        <header className="flex items-start gap-2 border-b border-black/[0.06] px-3 py-3 sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} aria-label="Voltar" className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 sm:hidden">
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">{title}</div>
          {actions}
          <button type="button" onClick={onClose} aria-label="Fechar" className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 sm:block">
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-black/[0.06] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer>}
      </div>
    </div>
  )
}
