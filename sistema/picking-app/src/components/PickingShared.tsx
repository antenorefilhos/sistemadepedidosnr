import { Camera, Check, ChevronDown, ChevronUp, Edit3, Keyboard, Package, RotateCcw, Trash2, X } from 'lucide-react'
import { PickingTaskItem } from '../services/api'

export const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PICKED: 'Separado',
  MISSING: 'Faltante',
  SUBSTITUTED: 'Substituido',
  CANCELLED: 'Cancelado',
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function ItemCard({
  product, orderItem, expanded, onToggle, onScan, onEan, onManual, onMissing, disabled,
}: {
  product?: { id: string; name: string; ean: string | null; imageUrl: string | null; unit: string | null } | null
  orderItem?: { quantity: number; requestedQuantity: number | null; substitutionPolicy?: string } | null
  expanded: boolean
  onToggle: () => void
  onScan: () => void
  onEan: () => void
  onManual: () => void
  onMissing: () => void
  disabled: boolean
}) {
  const qty = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 0)
  // So a EXCECAO aparece: ALLOW e o padrao e viraria ruido em todo item. O
  // backend ja respeita a escolha (picking.service decide requestSubstitution
  // a partir dela), mas o separador nao via -- e quem fala com o cliente e ele.
  const naoAceitaTroca = orderItem?.substitutionPolicy === 'DENY'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-gray-50">
        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Package size={16} className="text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{product?.name || 'Produto'}</p>
          <p className="text-xs text-gray-500">
            {qty} {product?.unit || 'un'}
            {product?.ean && <span className="ml-2 text-gray-400">EAN: {product.ean}</span>}
          </p>
          {naoAceitaTroca && (
            <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Não aceita troca
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <button
            onClick={onScan}
            disabled={disabled}
            className="h-12 rounded-xl bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
          >
            <Camera size={16} />
            Escanear
          </button>
          <button
            onClick={onEan}
            disabled={disabled}
            className="h-12 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
          >
            <Keyboard size={16} />
            Digitar EAN
          </button>
          <button
            onClick={onManual}
            disabled={disabled}
            className="h-12 rounded-xl bg-amber-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
          >
            <Check size={16} />
            Marcar
          </button>
          <button
            onClick={onMissing}
            disabled={disabled}
            className="h-12 rounded-xl bg-red-100 text-red-700 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
          >
            <X size={16} />
            Faltante
          </button>
        </div>
      )}
    </div>
  )
}

export function DoneItemCard({
  taskItem, product, onReset, onRemove, disabled,
}: {
  taskItem: PickingTaskItem
  product?: { id: string; name: string; ean: string | null; unit: string | null } | null
  onReset?: () => void
  onRemove?: () => void
  disabled?: boolean
}) {
  const isMissing = taskItem.status === 'MISSING'
  const picked = Number(taskItem.pickedQuantity ?? 0)
  const requested = Number(taskItem.requestedQuantity ?? 0)
  const isAdjusted = taskItem.status === 'PICKED' && picked > 0 && picked !== requested
  const isAddedDuringPicking = taskItem.notes?.includes('Incluido durante separacao')

  return (
    <div className={`rounded-xl px-4 py-3 ${isMissing ? 'bg-red-50 border border-red-100' : isAdjusted ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMissing ? 'bg-red-100' : isAdjusted ? 'bg-orange-100' : 'bg-green-100'}`}>
          {isMissing ? <X size={16} className="text-red-600" /> : isAdjusted ? <Edit3 size={16} className="text-orange-600" /> : <Check size={16} className="text-green-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isMissing ? 'text-red-900' : isAdjusted ? 'text-orange-900' : 'text-green-900'}`}>
            {product?.name || 'Produto'}
          </p>
          <p className="text-xs text-gray-500">
            {isAdjusted ? `Corrigido: ${picked}/${requested} ${product?.unit || 'un'}` : (ITEM_STATUS_LABEL[taskItem.status] || taskItem.status)}
            {taskItem.notes && !isAdjusted && <span className="ml-1">· {taskItem.notes}</span>}
          </p>
        </div>
      </div>
      {!disabled && (onReset || (onRemove && isAddedDuringPicking)) && (
        <div className="flex gap-2 mt-2 ml-11">
          {onReset && (
            <button onClick={onReset} className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 active:bg-blue-100">
              <RotateCcw size={12} /> Desfazer
            </button>
          )}
          {onRemove && isAddedDuringPicking && (
            <button onClick={onRemove} className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 active:bg-red-100">
              <Trash2 size={12} /> Remover
            </button>
          )}
        </div>
      )}
    </div>
  )
}
