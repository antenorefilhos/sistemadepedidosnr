import type { Order } from '../services/api'
import { adjustmentBreakdown, adjustmentSentence, brl, signedBrl } from '../utils/orderAdjustment'

/**
 * Diferenca do pedido explicada (08/10/2026): o "+3,8%" do topo confundia.
 * Mostra aprovado x agora e de onde vem a diferenca (falta, peso, quantidade,
 * item incluido, troca, frete), no fim do pedido e na revisao.
 */
export function AdjustmentSummary({ order, title = 'Diferença do pedido' }: { order: Order; title?: string }) {
  const b = adjustmentBreakdown(order)
  if (!b) return null
  const changed = Math.abs(b.diff) >= 0.01

  return (
    <div className="rounded-xl bg-white p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Aprovado pelo cliente</span>
          <span className="tabular-nums">{brl(b.approved)}</span>
        </div>
        {b.lines.map((line) => (
          <div key={line.key} className="flex justify-between gap-3">
            <span className="text-gray-500">
              {line.label}
              {line.count > 0 && <span className="text-gray-400"> ({line.count})</span>}
            </span>
            <span className={`shrink-0 tabular-nums font-medium ${line.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>{signedBrl(line.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
          <span>{changed ? 'Total agora' : 'Total'}</span>
          <span className="tabular-nums">{brl(b.final)}</span>
        </div>
      </div>
      {changed && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{adjustmentSentence(b)}.</p>}
    </div>
  )
}
