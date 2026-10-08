import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Scale } from 'lucide-react'
import { Modal } from './PickingShared'
import { ProductPhoto } from './ProductPhoto'
import { parseWeightInput, weightLong, weightLooksOff, weightOnScale, weightShort } from '../utils/weight'

/**
 * Peso do item de balanca (08/10/2026). O separador le o numero da etiqueta
 * ("0,268 kg") ou digita em gramas ("268") -- a tela mostra por extenso o que
 * entendeu ("268 gramas") antes de confirmar, e avisa se ficou muito longe do
 * pedido. Codigo de barras da etiqueta lido pela camera chega preenchido, mas
 * o separador confere com o numero impresso.
 */
export function WeightConfirmModal({
  product, requestedKg, prefillKg, actionLoading, onConfirm, onClose,
}: {
  product?: { name: string; ean: string | null } | null
  requestedKg: number
  /** Peso lido do codigo de barras da etiqueta, quando houver. */
  prefillKg?: number | null
  actionLoading: boolean
  onConfirm: (kg: number) => void
  onClose: () => void
}) {
  const [text, setText] = useState(prefillKg ? weightOnScale(prefillKg).replace(' kg', '') : '')
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = parseWeightInput(text)
  const off = parsed ? weightLooksOff(parsed.kg, requestedKg) : false

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 150)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3">
        <ProductPhoto ean={product?.ean} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{product?.name || 'Produto'}</p>
          <p className="text-sm text-gray-600">
            Pedido: <strong className="text-gray-900">{weightLong(requestedKg)}</strong>
          </p>
          <p className="text-xs text-gray-400">na etiqueta: {weightOnScale(requestedKg)}</p>
        </div>
      </div>

      {prefillKg ? (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Lido da etiqueta: <strong>{weightLong(prefillKg)}</strong>. Confira com o peso impresso.
        </p>
      ) : null}

      <label htmlFor="weight-input" className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
        <Scale size={16} className="text-brand-500" /> Quanto deu na balança?
      </label>
      <input
        ref={inputRef}
        id="weight-input"
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && parsed && !actionLoading && onConfirm(parsed.kg)}
        placeholder="Ex.: 0,268 ou 268"
        className="mt-1.5 h-14 w-full rounded-xl border-2 border-gray-200 text-center text-2xl font-bold tracking-wide focus:border-brand-500 focus:outline-none"
      />

      <div className="mt-2 min-h-[3.25rem] text-center">
        {parsed ? (
          <>
            <p className="text-xl font-black text-green-700">= {weightLong(parsed.kg)}</p>
            <p className="text-xs text-gray-500">na etiqueta: {weightOnScale(parsed.kg)}</p>
          </>
        ) : (
          <p className="pt-2 text-sm text-gray-400">Digite o peso que saiu na etiqueta.</p>
        )}
      </div>

      {off && parsed && (
        <p className="mt-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Bem diferente do pedido ({weightShort(requestedKg)}). Confira antes de confirmar.
        </p>
      )}

      <button
        type="button"
        onClick={() => setText(weightOnScale(requestedKg).replace(' kg', ''))}
        className="mt-3 h-11 w-full rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 active:bg-gray-50"
      >
        Deu o mesmo do pedido ({weightShort(requestedKg)})
      </button>

      <div className="mt-3 flex gap-2">
        <button onClick={onClose} className="h-12 flex-1 rounded-xl border border-gray-200 font-medium text-gray-600">
          Cancelar
        </button>
        <button
          onClick={() => parsed && onConfirm(parsed.kg)}
          disabled={!parsed || actionLoading}
          className="h-12 flex-[1.4] rounded-xl bg-green-600 font-semibold text-white disabled:opacity-40"
        >
          {actionLoading ? <Loader2 size={18} className="mx-auto animate-spin" /> : parsed ? `Confirmar ${weightShort(parsed.kg)}` : 'Confirmar'}
        </button>
      </div>
    </Modal>
  )
}
