import { useState } from 'react'
import { ArrowLeft, Camera, Loader2, Plus, Search } from 'lucide-react'
import BarcodeScanner from './BarcodeScanner'
import { Modal, isWeighed } from './PickingShared'
import { parseWeightInput, weightLong, weightOnScale } from '../utils/weight'

interface ProductResult {
  id: string
  name: string
  ean: string | null
  price: number
  promotionalPrice: number | null
  unit: string | null
  isFractional?: boolean | null
}

export function AddItemScreen({
  productSearch, productResults, searchLoading, addQty, actionLoading, addItemScanner,
  onSearchChange, onOpenScanner, onCloseScanner, onScanResult,
  onAddQtyChange, onAddItem, onClose, title = 'Incluir Item no Pedido', confirmLabel = 'Incluir', hint, defaultWeightKg,
}: {
  title?: string
  confirmLabel?: string
  hint?: string
  productSearch: string
  productResults: ProductResult[]
  searchLoading: boolean
  addQty: number
  actionLoading: boolean
  addItemScanner: boolean
  onSearchChange: (q: string) => void
  onOpenScanner: () => void
  onCloseScanner: () => void
  onScanResult: (barcode: string) => void
  onAddQtyChange: (updater: (q: number) => number) => void
  /** Produto de peso: a quantidade e o peso (kg), nao o numero de unidades. */
  onAddItem: (productId: string, quantity?: number) => void
  onClose: () => void
  /** Peso ja preenchido para produto de balanca (na troca, o peso do item que faltou). */
  defaultWeightKg?: number | null
}) {
  // Produto de balanca (08/10/2026): antes so dava para incluir 1, 2, 3 kg.
  const [weights, setWeights] = useState<Record<string, string>>({})
  const prefill = defaultWeightKg ? weightOnScale(defaultWeightKg).replace(' kg', '') : ''
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <p className="font-semibold">{title}</p>
        </div>
        {hint && <p className="mt-1 pl-[3.25rem] text-xs text-white/70">{hint}</p>}
      </header>
      <div className="px-4 py-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto por nome ou EAN..."
              value={productSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={onOpenScanner}
            className="w-12 h-12 flex-shrink-0 rounded-xl bg-brand-500 text-white flex items-center justify-center active:bg-brand-600"
            title="Ler código de barras"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {searchLoading && <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-brand-500" /></div>}
        {!searchLoading && productSearch.length >= 2 && productResults.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">Nenhum produto encontrado</p>
        )}
        {productResults.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  R$ {(p.promotionalPrice ?? p.price).toFixed(2).replace('.', ',')} / {isWeighed(p) ? 'kg' : (p.unit || 'un')}
                  {p.ean && <span className="ml-2">EAN: {p.ean}</span>}
                </p>
              </div>
            </div>
            {isWeighed(p) ? (() => {
              const text = weights[p.id] ?? prefill
              const parsed = parseWeightInput(text)
              return (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Peso"
                      placeholder="Peso: 0,268 ou 268"
                      value={text}
                      onChange={(e) => setWeights((w) => ({ ...w, [p.id]: e.target.value.replace(/[^\d.,]/g, '') }))}
                      className="h-10 w-36 rounded-lg border border-gray-200 text-center text-base font-semibold focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      onClick={() => parsed && onAddItem(p.id, parsed.kg)}
                      disabled={actionLoading || !parsed}
                      className="flex-1 h-10 rounded-lg bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> {confirmLabel}</>}
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-green-700">{parsed ? `= ${weightLong(parsed.kg)}` : <span className="font-normal text-gray-400">Digite o peso da etiqueta</span>}</p>
                </div>
              )
            })() : (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => onAddQtyChange(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center">−</button>
              <input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => onAddQtyChange(() => Math.max(1, Number(e.target.value) || 1))}
                className="w-16 h-8 rounded-lg border border-gray-200 text-center text-sm font-semibold"
              />
              <button onClick={() => onAddQtyChange(q => q + 1)} className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center">+</button>
              <button
                onClick={() => onAddItem(p.id)}
                disabled={actionLoading}
                className="flex-1 h-8 rounded-lg bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-40"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> {confirmLabel}</>}
              </button>
            </div>
            )}
          </div>
        ))}
      </div>

      {addItemScanner && (
        <Modal onClose={onCloseScanner}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Escanear Codigo</h2>
          <BarcodeScanner onResult={onScanResult} onClose={onCloseScanner} />
        </Modal>
      )}
    </div>
  )
}
