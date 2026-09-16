import { AlertTriangle, Edit3, Loader2 } from 'lucide-react'
import { Modal } from './PickingShared'

interface Product {
  id: string
  name: string
  ean: string | null
  imageUrl: string | null
  unit: string | null
  isFractional?: boolean | null
}

interface OrderItem {
  quantity: number
  requestedQuantity: number | null
  substitutionPolicy?: string
}

export function ManualConfirmModal({
  product, orderItem, adjustQty, adjustQtyText, actionLoading,
  onAdjustQtyTextChange, onAdjustQtyBlur, onDecrement, onIncrement, onConfirm, onClose,
}: {
  product?: Product | null
  orderItem?: OrderItem | null
  adjustQty: number
  adjustQtyText: string
  actionLoading: boolean
  onAdjustQtyTextChange: (raw: string) => void
  onAdjustQtyBlur: (minValue: number) => void
  onDecrement: (step: number, minValue: number) => void
  onIncrement: (step: number) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const requested = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 0)
  const isAdjusted = adjustQty !== requested
  const weighted = Boolean(product?.isFractional) || ['kg', 'quilo', 'g'].includes(String(product?.unit || '').toLowerCase())
  // JON-31: achado na varredura mobile de 09/09/2026 -- passo de 0.01kg
  // exigia dezenas de toques pra ajustar peso real (ex.: 1kg pedido,
  // 0.94kg pesado = 6 toques so nessa diferenca pequena). 0.05kg reduz
  // o toque em ~5x sem perder precisao pratica de balanca de loja;
  // digitar direto continua disponivel pra ajuste fino.
  const step = weighted ? 0.05 : 1
  const minValue = weighted ? 0.01 : 1

  return (
    <Modal onClose={onClose}>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Confirmacao Manual</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {weighted
                ? 'Confirme que separou este item. Informe o peso real pesado na balanca.'
                : 'Confirme que separou este item. Ajuste a quantidade se necessario.'}
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="font-semibold text-gray-900">{product?.name || 'Produto'}</p>
        {product?.ean && <p className="text-xs text-gray-500 mt-1">EAN: {product.ean}</p>}
        <div className="mt-3">
          <label className="text-xs text-gray-500 block mb-1">
            {weighted
              ? `Peso separado em ${product?.unit || 'kg'} (pedido: ${requested} ${product?.unit || 'kg'})`
              : `Quantidade separada (pedido: ${requested} ${product?.unit || 'un'})`}
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDecrement(step, minValue)}
              className="w-11 h-11 rounded-lg bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-300"
            >
              −
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={adjustQtyText}
              onChange={(e) => onAdjustQtyTextChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => onAdjustQtyBlur(minValue)}
              className="flex-1 h-10 rounded-lg border border-gray-200 text-center text-lg font-semibold focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => onIncrement(step)}
              className="w-11 h-11 rounded-lg bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>
        {isAdjusted && (
          <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <p className="text-xs text-orange-700">
              <Edit3 size={12} className="inline mr-1" />
              Enviando {adjustQty} de {requested} {product?.unit || 'un'} — o valor do pedido sera recalculado.
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={actionLoading || adjustQty < minValue}
          className={`flex-1 h-12 rounded-xl text-white font-semibold disabled:opacity-40 ${isAdjusted ? 'bg-orange-600' : 'bg-amber-600'}`}
        >
          {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : isAdjusted ? `Enviar ${adjustQty}` : 'Sim, Separei'}
        </button>
      </div>
    </Modal>
  )
}
