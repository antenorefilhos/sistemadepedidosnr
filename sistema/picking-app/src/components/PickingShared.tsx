import { Camera, Check, ChevronDown, ChevronUp, Edit3, Keyboard, Repeat, RotateCcw, Scale, Trash2, X } from 'lucide-react'
import { OrderItem, PickingTaskItem, SubstitutionSuggestion } from '../services/api'
import { SuggestionRow } from './SubstitutionPanel'
import { noteLabel, qtd } from '../utils/quantity'
import { PICK_METHOD_LABEL } from '../utils/orderInfo'
import { itemChange, signedBrl } from '../utils/orderAdjustment'
import { weightLong, weightOnScale, weightShort } from '../utils/weight'

/** Item de balanca: peso em gramas/quilos, nao "0,22 kg". */
export const isWeighed = (product?: { unit?: string | null; isFractional?: boolean | null } | null) =>
  Boolean(product?.isFractional) || ['kg', 'quilo', 'g'].includes(String(product?.unit || '').toLowerCase())
import { ProductPhoto } from './ProductPhoto'

export const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PICKED: 'Separado',
  MISSING: 'Faltante',
  SUBSTITUTED: 'Substituído',
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
  product, orderItem, expanded, onToggle, onScan, onEan, onManual, onMissing, onSubstitute, disabled,
}: {
  product?: { id: string; name: string; ean: string | null; imageUrl: string | null; unit: string | null; isFractional?: boolean | null } | null
  orderItem?: { quantity: number; requestedQuantity: number | null; substitutionPolicy?: string } | null
  expanded: boolean
  onToggle: () => void
  onScan: () => void
  onEan: () => void
  onManual: () => void
  onMissing: () => void
  /** Nao tem, mas tem parecido: marca a falta e ja abre a busca do substituto. */
  onSubstitute: () => void
  disabled: boolean
}) {
  const qty = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 0)
  const weighed = isWeighed(product)
  // So a EXCECAO aparece: ALLOW e o padrao e viraria ruido em todo item. O
  // backend ja respeita a escolha (picking.service decide requestSubstitution
  // a partir dela), mas o separador nao via -- e quem fala com o cliente e ele.
  const naoAceitaTroca = orderItem?.substitutionPolicy === 'DENY'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full px-3 py-3 text-left flex items-center gap-3 active:bg-gray-50">
        <ProductPhoto ean={product?.ean} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{product?.name || 'Produto'}</p>
          {weighed ? (
            <p className="text-sm text-gray-800">
              <strong>{weightLong(qty)}</strong>
              <span className="ml-1.5 text-xs text-gray-400">na balança: {weightOnScale(qty)}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-800">
              <strong>{qtd(qty)} {qty === 1 ? 'unidade' : 'unidades'}</strong>
            </p>
          )}
          {product?.ean && <p className="font-mono text-[11px] tracking-wide text-gray-400">EAN {product.ean}</p>}
          {naoAceitaTroca && (
            <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Não aceita troca
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {expanded && product?.ean && (
        <div className="px-4 pb-2">
          {/* Foto grande para achar o produto na gondola. */}
          <ProductPhoto ean={product.ean} className="h-40 w-full" />
        </div>
      )}
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
            className="col-span-2 h-12 rounded-xl bg-amber-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
          >
            {weighed ? <Scale size={16} /> : <Check size={16} />}
            {weighed ? 'Informar o peso' : 'Confirmar sem ler o código'}
          </button>
          <button
            onClick={onMissing}
            disabled={disabled}
            className={`${naoAceitaTroca ? 'col-span-2' : ''} h-12 rounded-xl bg-red-100 text-red-700 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40`}
          >
            <X size={16} />
            Faltante
          </button>
          {!naoAceitaTroca && (
            <button
              onClick={onSubstitute}
              disabled={disabled}
              className="h-12 rounded-xl border-2 border-brand-500 bg-white text-brand-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
            >
              <Repeat size={16} />
              Substituir
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DoneItemCard({
  taskItem, product, orderItem, allItems = [], onReset, onRemove, disabled,
  suggestion, onSuggest, onCancelSuggestion, onDecideSuggestion,
}: {
  taskItem: PickingTaskItem
  product?: { id: string; name: string; ean: string | null; unit: string | null } | null
  orderItem?: OrderItem | null
  allItems?: OrderItem[]
  onReset?: () => void
  onRemove?: () => void
  disabled?: boolean
  suggestion?: SubstitutionSuggestion | null
  onSuggest?: () => void
  onCancelSuggestion?: () => void
  onDecideSuggestion?: (accept: boolean) => void
}) {
  const isMissing = taskItem.status === 'MISSING'
  const picked = Number(taskItem.pickedQuantity ?? 0)
  const requested = Number(taskItem.requestedQuantity ?? 0)
  const isAdjusted = taskItem.status === 'PICKED' && picked > 0 && Math.abs(picked - requested) > 0.0005
  const weighed = isWeighed(product)
  const isAddedDuringPicking = Boolean(orderItem?.addedByPicker) || Boolean(taskItem.notes?.includes('Incluido durante separacao'))
  const change = orderItem ? itemChange(orderItem, allItems) : null
  // Substituto de troca aceita pelo cliente: mostra de qual item veio.
  const replaced = orderItem ? allItems.find((other) => other.substitutedByItemId === orderItem.id) : undefined
  const method = orderItem?.pickMethod ? PICK_METHOD_LABEL[orderItem.pickMethod] || orderItem.pickMethod : null
  // Codigo lido diferente do EAN do cadastro: etiqueta da balanca ou EAN secundario.
  const readCode = orderItem?.pickedBarcode && orderItem.pickedBarcode !== product?.ean ? orderItem.pickedBarcode : null

  return (
    <div className={`rounded-xl px-4 py-3 ${isMissing ? 'bg-red-50 border border-red-100' : isAdjusted ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}>
      <div className="flex items-start gap-3">
        <div className="relative">
          <ProductPhoto ean={product?.ean} className="h-11 w-11" />
          <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${isMissing ? 'bg-red-600' : isAdjusted ? 'bg-orange-500' : 'bg-green-600'}`}>
            {isMissing ? <X size={12} className="text-white" /> : isAdjusted ? <Edit3 size={11} className="text-white" /> : <Check size={12} className="text-white" />}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isMissing ? 'text-red-900' : isAdjusted ? 'text-orange-900' : 'text-green-900'}`}>
            {product?.name || 'Produto'}
          </p>
          {replaced && (
            <span className="mt-0.5 inline-flex rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">Troca de {replaced.product?.name || 'outro item'} · aceita pelo cliente</span>
          )}
          {isAddedDuringPicking && !replaced && (
            <span className="mt-0.5 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">Incluído pelo separador · não estava no pedido</span>
          )}
          <p className="text-xs text-gray-500">
            {isAdjusted
              ? weighed
                ? `Separado ${weightShort(picked)} · pedido ${weightShort(requested)}`
                : `Separado ${qtd(picked)} de ${qtd(requested)} pedidos`
              : (ITEM_STATUS_LABEL[taskItem.status] || taskItem.status)}
            {!isAdjusted && taskItem.status === 'PICKED' && weighed && picked > 0 && <span className="ml-1">· {weightShort(picked)}</span>}
            {noteLabel(taskItem.notes) && !isAdjusted && !isAddedDuringPicking && !/Quantidade corrigida|Produto em falta/.test(taskItem.notes || '') && <span className="ml-1">· {noteLabel(taskItem.notes)}</span>}
          </p>
          {(method || product?.ean) && !isMissing && (
            <p className="text-[11px] text-gray-500">
              {method}
              {readCode ? <span className="font-mono"> · lido {readCode}</span> : product?.ean ? <span className="font-mono text-gray-400">{method ? ' · ' : ''}EAN {product.ean}</span> : null}
            </p>
          )}
        </div>
        {change && Math.abs(change.diff) >= 0.01 && (
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${change.diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>{signedBrl(change.diff)}</span>
        )}
      </div>
      {isMissing && orderItem?.substitutionPolicy === 'DENY' && (
        <p className="mt-2 ml-14 text-xs font-semibold text-amber-800">Cliente não aceita troca neste item.</p>
      )}
      {suggestion ? (
        <SuggestionRow
          suggestion={suggestion}
          disabled={Boolean(disabled)}
          onChange={() => onSuggest?.()}
          onCancel={() => onCancelSuggestion?.()}
          onDecide={(accept) => onDecideSuggestion?.(accept)}
        />
      ) : (
        isMissing && !disabled && orderItem?.substitutionPolicy !== 'DENY' && onSuggest && (
          <button onClick={onSuggest} className="mt-2 ml-14 flex h-10 items-center gap-1.5 rounded-lg border border-brand-500/30 bg-white px-3 text-sm font-semibold text-brand-600 active:bg-brand-50">
            <RotateCcw size={14} /> Sugerir troca
          </button>
        )
      )}
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
