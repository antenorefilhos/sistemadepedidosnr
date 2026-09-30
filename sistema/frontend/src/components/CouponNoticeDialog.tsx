import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export type CouponNotice = { tone: 'success' | 'error'; title: string; message: string }

/**
 * Resultado de cupom no meio da tela (30/09/2026, DAV 102120): o "cupom
 * vencido" aparecia num texto pequeno embaixo do campo, o cliente nao leu,
 * achou que tinha frete gratis e o pedido teve que ser cancelado e refeito
 * no caixa. Agora aplicar, recusar ou perder o cupom exige um toque para fechar.
 */
export function CouponNoticeDialog({ notice, onClose }: { notice: CouponNotice; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ok = notice.tone === 'success'
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="coupon-notice-title"
        aria-describedby="coupon-notice-message"
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {ok ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : <AlertTriangle className="h-8 w-8 text-red-600" />}
        </span>
        <h2 id="coupon-notice-title" className={`mt-4 text-xl font-bold ${ok ? 'text-emerald-800' : 'text-red-700'}`}>
          {notice.title}
        </h2>
        <p id="coupon-notice-message" className="mt-2 text-base text-gray-700">
          {notice.message}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className={`mt-6 h-12 w-full rounded-xl text-base font-semibold text-white ${ok ? 'bg-emerald-600' : 'bg-[#5D082A]'}`}
        >
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  )
}
