import { AlertTriangle, ArrowLeft, Check, Edit3, Loader2, Send, Truck, X } from 'lucide-react'
import { getOrderPdvCode, hasPdvCode } from '../utils/orderCode'
import { Order, PickingTaskItem } from '../services/api'

export function ReviewScreen({
  order, doneItems, deliveryInstructions, sendConfirm, actionLoading,
  onBack, onDeliveryInstructionsChange, onAskConfirm, onSend, onCancelConfirm,
}: {
  order: Order
  doneItems: PickingTaskItem[]
  deliveryInstructions: string
  sendConfirm: boolean
  actionLoading: boolean
  onBack: () => void
  onDeliveryInstructionsChange: (value: string) => void
  onAskConfirm: () => void
  onSend: () => void
  onCancelConfirm: () => void
}) {
  const pickedItems = doneItems.filter(i => i.status !== 'MISSING')
  const missingItems = doneItems.filter(i => i.status === 'MISSING')
  const productFor = (taskItem: PickingTaskItem) => order.items?.find(i => i.id === taskItem.orderItemId)?.product

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="font-semibold">Revisao do Pedido</p>
            <p className="text-xs text-white/60">
              {hasPdvCode(order) ? `DAV ${getOrderPdvCode(order)}` : `#${getOrderPdvCode(order)}`}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Customer info */}
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cliente</p>
          <p className="font-semibold text-gray-900">{order.customer?.name}</p>
          {order.customer?.cpf && <p className="text-xs text-gray-500 mt-0.5">CPF: {order.customer.cpf}</p>}
          {order.notes && (
            <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
              <strong>Obs do cliente:</strong> {order.notes}
            </div>
          )}
        </div>

        {/* Picked items */}
        {pickedItems.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Itens separados ({pickedItems.length})
            </p>
            <div className="space-y-2">
              {pickedItems.map(item => {
                const product = productFor(item)
                const picked = Number(item.pickedQuantity ?? 0)
                const requested = Number(item.requestedQuantity ?? 0)
                const isAdjusted = picked > 0 && picked !== requested
                return (
                  <div key={item.id} className="flex items-start gap-3 py-1">
                    {isAdjusted
                      ? <Edit3 size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                      : <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />}
                    <span className="flex-1 text-sm text-gray-900">{product?.name || 'Produto'}</span>
                    <span className={`text-sm flex-shrink-0 ${isAdjusted ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                      {isAdjusted ? `${picked}/${requested}` : (picked || requested)} {product?.unit || 'un'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Missing items */}
        {missingItems.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <p className="text-xs text-red-400 uppercase tracking-wide mb-2">
              Itens faltantes ({missingItems.length})
            </p>
            <div className="space-y-2">
              {missingItems.map(item => (
                <div key={item.id} className="flex items-start gap-3 py-1">
                  <X size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="flex-1 text-sm text-red-800">{productFor(item)?.name || 'Produto'}</span>
                  {item.notes && <span className="text-xs text-red-400 flex-shrink-0">{item.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Resumo</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Itens separados</span>
              <span className="font-medium">{pickedItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Itens faltantes</span>
              <span className="font-medium text-red-600">{missingItems.length}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold">R$ {order.total?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery instructions */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck size={14} className="text-gray-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Instrucoes de entrega</p>
            <span className="text-xs text-gray-300">(opcional)</span>
          </div>
          <textarea
            placeholder="Ex: entregar no portao lateral, ligar antes, nao tocar campainha..."
            value={deliveryInstructions}
            onChange={(e) => onDeliveryInstructionsChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Warning */}
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              Apos enviar ao caixa, o pedido sera registrado no sistema Solidcon.
              Depois disso, so podera ser finalizado no PDV ou cancelado totalmente.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t space-y-2">
        {!sendConfirm ? (
          <>
            <button
              onClick={onBack}
              className="w-full h-11 rounded-xl border border-orange-300 text-orange-600 font-medium flex items-center justify-center gap-2 active:bg-orange-50"
            >
              <Edit3 size={14} />
              Corrigir Pedido
            </button>
            <div className="flex gap-2">
              <button
                onClick={onBack}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Voltar
              </button>
              <button
                onClick={onAskConfirm}
                className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Send size={14} />
                Enviar ao Caixa
              </button>
            </div>
          </>
        ) : (
          // Faltava o wrapper flex que o outro estado tem: sem pai flex, o
          // `flex-1` dos botoes nao faz nada e eles caem empilhados e
          // estreitos dentro do `space-y-2` do container.
          <div className="flex gap-2">
            {/* Confirmar a ESQUERDA e cancelar a DIREITA, invertendo a
                convencao de proposito. O polegar cai naturalmente na
                direita no uso com uma mao, entao toque duplo acidental
                acerta o Cancelar -- que so volta pra tela anterior. Enviar
                ao caixa e irreversivel: grava o pedido no Solidcom, e dali
                em diante so da pra finalizar no PDV ou cancelar por
                inteiro. Aqui o erro barato tem que ser o mais provavel. */}
            <button
              onClick={onSend}
              disabled={actionLoading}
              className="flex-1 h-12 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Envio'}
            </button>
            <button
              onClick={onCancelConfirm}
              className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
