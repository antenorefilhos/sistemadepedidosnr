import { Clock } from 'lucide-react'
import { useDeliveryOperation } from '../hooks/useDeliveryOperation'

const TONE = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  closing: 'border-amber-300 bg-amber-50 text-amber-900',
  pause: 'border-[#D2BB8A]/60 bg-[#FBFAF7] text-[#5d4f33]',
  closed: 'border-[#D2BB8A]/60 bg-[#FBFAF7] text-[#5d4f33]',
} as const

/**
 * Horario de entrega em uma linha: "Entregamos hoje ate 20h50", "Ultimos 35
 * min para pedir", "Voltamos as 14h30", "Fechado agora - abrimos amanha as 7h".
 * `variant="strip"` e a faixa fina do topo mobile; `chip` e o selo do desktop/carrinho.
 */
export function DeliveryHoursBar({ variant = 'chip', className = '' }: { variant?: 'chip' | 'strip'; className?: string }) {
  const status = useDeliveryOperation()
  const text = status.note ? `${status.message} · ${status.note}` : status.message

  if (variant === 'strip') {
    return (
      <div role="status" className={`flex items-center justify-center gap-1.5 border-b px-4 py-1.5 text-xs font-semibold ${TONE[status.state]} ${className}`}>
        <Clock size={13} className="shrink-0" />
        <span className="truncate">{text}</span>
      </div>
    )
  }

  return (
    <div role="status" className={`inline-flex h-8 max-w-full items-center gap-2 rounded-lg border px-3 text-caption font-semibold ${TONE[status.state]} ${className}`}>
      <Clock size={14} className="shrink-0" />
      <span className="truncate">{text}</span>
    </div>
  )
}
