import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Camera, Keyboard, Check, X, AlertTriangle,
  Loader2, Package, ChevronDown, ChevronUp, Send, ClipboardList, Truck, Edit3,
  Plus, Search, RotateCcw, Trash2,
} from 'lucide-react'
import { pickerApi, PickingTask, PickingTaskItem, Order } from '../services/api'
import toast from 'react-hot-toast'
import BarcodeScanner from '../components/BarcodeScanner'

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PICKED: 'Separado',
  MISSING: 'Faltante',
  SUBSTITUTED: 'Substituido',
  CANCELLED: 'Cancelado',
}

type ConfirmMode = null | 'scan' | 'ean' | 'manual'

interface ConfirmState {
  mode: ConfirmMode
  itemId: string | null
  taskItemId: string | null
  ean: string
}

export default function OrderPicking({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [task, setTask] = useState<PickingTask | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState>({ mode: null, itemId: null, taskItemId: null, ean: '' })
  const [adjustQty, setAdjustQty] = useState<number>(0)
  const [missingItem, setMissingItem] = useState<{ taskItemId: string; reason: string } | null>(null)
  const [addItemModal, setAddItemModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Array<{ id: string; name: string; ean: string | null; price: number; promotionalPrice: number | null; unit: string | null }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addQty, setAddQty] = useState(1)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [sendConfirm, setSendConfirm] = useState(false)
  const eanInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const { data } = await pickerApi.startOrderPicking(orderId)
      setTask(data)
      setOrder(data.order || null)
    } catch (err: any) {
      if (err.response?.status === 400) {
        // Pedido já finalizado ou não elegível — buscar via search
        try {
          const { data: orders } = await pickerApi.searchOrders({ q: orderId })
          const found = orders.find(o => o.id === orderId)
          if (found) {
            setOrder(found)
            setTask(found.pickingTask || null)
          } else {
            toast.error('Pedido nao encontrado')
          }
        } catch {
          toast.error('Erro ao carregar pedido')
        }
      } else {
        toast.error('Erro ao carregar pedido')
      }
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (confirm.mode === 'ean') {
      setTimeout(() => eanInputRef.current?.focus(), 100)
    }
  }, [confirm.mode])

  const refreshTask = async () => {
    if (!task) return
    try {
      const { data } = await pickerApi.getTask(task.id)
      setTask(data)
      setOrder(data.order || null)
    } catch { /* keep current */ }
  }

  const getProductForTaskItem = (taskItem: PickingTaskItem) => {
    const orderItem = order?.items?.find(i => i.id === taskItem.orderItemId)
    return orderItem?.product
  }

  const getOrderItemForTaskItem = (taskItem: PickingTaskItem) => {
    return order?.items?.find(i => i.id === taskItem.orderItemId)
  }

  const handleScan = (taskItem: PickingTaskItem) => {
    setConfirm({ mode: 'scan', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  const handleEanMode = (taskItem: PickingTaskItem) => {
    setConfirm({ mode: 'ean', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  const handleManualMode = (taskItem: PickingTaskItem) => {
    const orderItem = getOrderItemForTaskItem(taskItem)
    setAdjustQty(Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1))
    setConfirm({ mode: 'manual', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  const handleBarcodeResult = async (barcode: string) => {
    if (!task || !confirm.taskItemId) return
    const taskItem = task.items.find(i => i.id === confirm.taskItemId)
    if (!taskItem) return
    const product = getProductForTaskItem(taskItem)
    const orderItem = getOrderItemForTaskItem(taskItem)

    if (product?.ean && barcode !== product.ean) {
      toast.error(`EAN ${barcode} nao corresponde ao produto (${product.ean})`)
      setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })
      return
    }

    setActionLoading(true)
    try {
      const qty = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1)
      const { data } = await pickerApi.pickItem(task.id, taskItem.id, {
        quantity: qty,
        barcode,
      })
      setTask(data)
      setOrder(data.order || null)
      toast.success('Item separado')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao separar')
    } finally {
      setActionLoading(false)
      setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })
    }
  }

  const handleEanSubmit = () => {
    if (confirm.ean.trim()) handleBarcodeResult(confirm.ean.trim())
  }

  const handleManualConfirm = async () => {
    if (!task || !confirm.taskItemId) return
    const taskItem = task.items.find(i => i.id === confirm.taskItemId)
    if (!taskItem) return
    const orderItem = getOrderItemForTaskItem(taskItem)
    const requested = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1)

    setActionLoading(true)
    try {
      const isAdjusted = adjustQty !== requested
      const { data } = await pickerApi.pickItem(task.id, taskItem.id, {
        quantity: adjustQty,
        notes: isAdjusted ? `Quantidade corrigida: ${adjustQty}/${requested}` : 'Marcacao manual',
      })
      setTask(data)
      setOrder(data.order || null)
      toast.success(isAdjusted ? `Item separado (${adjustQty}/${requested})` : 'Item separado')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao separar')
    } finally {
      setActionLoading(false)
      setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })
    }
  }

  const handleMissing = async () => {
    if (!task || !missingItem) return
    setActionLoading(true)
    try {
      await pickerApi.markMissing(task.id, missingItem.taskItemId, {
        reason: missingItem.reason,
      })
      await refreshTask()
      toast.success('Item marcado como faltante')
      setMissingItem(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetItem = async (taskItemId: string) => {
    if (!task) return
    setActionLoading(true)
    try {
      const { data } = await pickerApi.resetItem(task.id, taskItemId)
      setTask(data)
      setOrder(data.order || null)
      toast.success('Item reaberto para correcao')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desfazer')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveItem = async (taskItemId: string) => {
    if (!task) return
    setActionLoading(true)
    try {
      const { data } = await pickerApi.removeItem(task.id, taskItemId)
      setTask(data)
      setOrder(data.order || null)
      toast.success('Item removido')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao remover')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSearchProducts = async (q: string) => {
    setProductSearch(q)
    if (q.trim().length < 2) { setProductResults([]); return }
    setSearchLoading(true)
    try {
      const { data } = await pickerApi.searchProducts(q)
      setProductResults(data)
    } catch { setProductResults([]) }
    finally { setSearchLoading(false) }
  }

  const handleAddItem = async (productId: string) => {
    if (!order) return
    setActionLoading(true)
    try {
      const { data } = await pickerApi.addItemToOrder(order.id, { productId, quantity: addQty })
      setTask(data)
      setOrder(data.order || null)
      toast.success('Item incluido no pedido')
      setAddItemModal(false)
      setProductSearch('')
      setProductResults([])
      setAddQty(1)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao incluir')
    } finally {
      setActionLoading(false)
    }
  }

  const handleFinishPicking = async () => {
    if (!task) return
    setActionLoading(true)
    try {
      const { data } = await pickerApi.finishTask(task.id)
      setTask(data)
      setOrder(data.order || null)
      toast.success('Separacao finalizada')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao finalizar')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendToCashier = async () => {
    setActionLoading(true)
    try {
      const { data } = await pickerApi.sendToCashier(orderId, {
        deliveryInstructions: deliveryInstructions.trim() || undefined,
      })
      setOrder(data)
      if (task) setTask({ ...task, status: 'COMPLETED' })
      toast.success('Pedido enviado ao caixa')
      setSendConfirm(false)
      setReviewMode(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Pedido nao encontrado</p>
        <button onClick={onBack} className="text-brand-500 font-medium">Voltar</button>
      </div>
    )
  }

  const taskItems = task?.items || []
  const pending = taskItems.filter(i => i.status === 'PENDING')
  const done = taskItems.filter(i => ['PICKED', 'MISSING', 'SUBSTITUTED', 'CANCELLED'].includes(i.status))
  const allDone = taskItems.length > 0 && pending.length === 0
  const isSeparated = ['CONFERENCE_PENDING', 'PACKING', 'COMPLETED'].includes(task?.status || '')
  const isSentToCashier = order.status === 'READY_FOR_CHECKOUT'
  const canFinish = allDone && task && !isSeparated && !isSentToCashier
  const canSendToCashier = (isSeparated || allDone) && !isSentToCashier

  return (
    <div className="flex flex-col h-full">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{order.customer?.name || 'Pedido'}</p>
            <p className="text-xs text-white/60">
              #{order.id.slice(-8).toUpperCase()} · {done.length}/{taskItems.length} itens
            </p>
          </div>
        </div>
        {taskItems.length > 0 && (
          <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${(done.length / taskItems.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Action buttons */}
      {(canFinish || canSendToCashier || isSentToCashier) && (
        <div className="px-4 py-2 bg-white border-b flex gap-2">
          {canFinish && (
            <button
              onClick={handleFinishPicking}
              disabled={actionLoading}
              className="flex-1 h-11 rounded-xl bg-purple-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Finalizar Separacao'}
            </button>
          )}
          {canSendToCashier && (
            <button
              onClick={() => setReviewMode(true)}
              disabled={actionLoading}
              className="flex-1 h-11 rounded-xl bg-green-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <ClipboardList size={14} />
              Revisar e Enviar
            </button>
          )}
          {isSentToCashier && (
            <div className="flex-1 h-11 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold text-sm flex items-center justify-center gap-2">
              <Check size={16} />
              Enviado ao Caixa
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {order.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Obs:</strong> {order.notes}
          </div>
        )}

        {/* Pending items */}
        {pending.length > 0 && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-wide pt-1 pb-1">
              Pendentes ({pending.length})
            </p>
            {pending.map(item => (
              <ItemCard
                key={item.id}
                product={getProductForTaskItem(item)}
                orderItem={getOrderItemForTaskItem(item)}
                expanded={expandedItem === item.id}
                onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                onScan={() => handleScan(item)}
                onEan={() => handleEanMode(item)}
                onManual={() => handleManualMode(item)}
                onMissing={() => setMissingItem({ taskItemId: item.id, reason: '' })}
                disabled={actionLoading || isSentToCashier}
              />
            ))}
          </>
        )}

        {/* Done items */}
        {done.length > 0 && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-wide pt-3 pb-1">
              Concluidos ({done.length})
            </p>
            {done.map(item => (
              <DoneItemCard
                key={item.id}
                taskItem={item}
                product={getProductForTaskItem(item)}
                onReset={() => handleResetItem(item.id)}
                onRemove={() => handleRemoveItem(item.id)}
                disabled={actionLoading || isSentToCashier}
              />
            ))}
          </>
        )}

        {/* Add item button */}
        {!isSentToCashier && task && (
          <button
            onClick={() => setAddItemModal(true)}
            className="w-full h-12 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 active:bg-gray-50 mt-2"
          >
            <Plus size={16} />
            Incluir Item no Pedido
          </button>
        )}

        {taskItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Package size={32} />
            <p className="text-sm">Nenhum item para separar</p>
          </div>
        )}
      </div>

      {/* Scan modal */}
      {confirm.mode === 'scan' && (
        <Modal onClose={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Escanear Codigo</h2>
          <BarcodeScanner
            onResult={handleBarcodeResult}
            onClose={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}
          />
        </Modal>
      )}

      {/* EAN input modal */}
      {confirm.mode === 'ean' && (
        <Modal onClose={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Digitar EAN</h2>
          <input
            ref={eanInputRef}
            type="text"
            inputMode="numeric"
            placeholder="Digite o codigo EAN"
            value={confirm.ean}
            onChange={(e) => setConfirm(s => ({ ...s, ean: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleEanSubmit()}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 text-lg text-center tracking-widest focus:outline-none focus:border-brand-500 mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}
              className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleEanSubmit}
              disabled={!confirm.ean.trim() || actionLoading}
              className="flex-1 h-12 rounded-xl bg-brand-500 text-white font-semibold disabled:opacity-40"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Manual confirmation modal */}
      {confirm.mode === 'manual' && (() => {
        const taskItem = task?.items.find(i => i.id === confirm.taskItemId)
        const product = taskItem ? getProductForTaskItem(taskItem) : null
        const orderItem = taskItem ? getOrderItemForTaskItem(taskItem) : null
        const requested = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 0)
        const isAdjusted = adjustQty !== requested
        return (
          <Modal onClose={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Confirmacao Manual</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Confirme que separou este item. Ajuste a quantidade se necessario.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="font-semibold text-gray-900">{product?.name || 'Produto'}</p>
              {product?.ean && <p className="text-xs text-gray-500 mt-1">EAN: {product.ean}</p>}
              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">Quantidade separada (pedido: {requested} {product?.unit || 'un'})</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdjustQty(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-300"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, Number(e.target.value) || 1))}
                    className="flex-1 h-10 rounded-lg border border-gray-200 text-center text-lg font-semibold focus:outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => setAdjustQty(q => q + 1)}
                    className="w-10 h-10 rounded-lg bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-300"
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
                onClick={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualConfirm}
                disabled={actionLoading || adjustQty < 1}
                className={`flex-1 h-12 rounded-xl text-white font-semibold disabled:opacity-40 ${isAdjusted ? 'bg-orange-600' : 'bg-amber-600'}`}
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : isAdjusted ? `Enviar ${adjustQty}` : 'Sim, Separei'}
              </button>
            </div>
          </Modal>
        )
      })()}

      {/* Missing modal */}
      {missingItem && (
        <Modal onClose={() => setMissingItem(null)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Item Faltante</h2>
          <textarea
            placeholder="Motivo: ex. produto em falta, prateleira vazia"
            value={missingItem.reason}
            onChange={(e) => setMissingItem(s => s ? { ...s, reason: e.target.value } : s)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-brand-500 mb-4"
          />
          <div className="flex gap-2">
            <button onClick={() => setMissingItem(null)} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium">
              Cancelar
            </button>
            <button
              onClick={handleMissing}
              disabled={!missingItem.reason.trim() || actionLoading}
              className="flex-1 h-12 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40"
            >
              {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar Faltante'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add item modal */}
      {addItemModal && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => { setAddItemModal(false); setProductSearch(''); setProductResults([]); setAddQty(1) }} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
                <ArrowLeft size={20} />
              </button>
              <p className="font-semibold">Incluir Item no Pedido</p>
            </div>
          </header>
          <div className="px-4 py-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto por nome ou EAN..."
                value={productSearch}
                onChange={(e) => handleSearchProducts(e.target.value)}
                autoFocus
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-500"
              />
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
                    <p className="font-medium text-sm text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      R$ {(p.promotionalPrice ?? p.price).toFixed(2)} / {p.unit || 'un'}
                      {p.ean && <span className="ml-2">EAN: {p.ean}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => setAddQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center">−</button>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 h-8 rounded-lg border border-gray-200 text-center text-sm font-semibold"
                  />
                  <button onClick={() => setAddQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 font-bold flex items-center justify-center">+</button>
                  <button
                    onClick={() => handleAddItem(p.id)}
                    disabled={actionLoading}
                    className="flex-1 h-8 rounded-lg bg-brand-500 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Incluir</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review screen */}
      {reviewMode && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => { setReviewMode(false); setSendConfirm(false) }} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1">
                <p className="font-semibold">Revisao do Pedido</p>
                <p className="text-xs text-white/60">#{order.id.slice(-8).toUpperCase()}</p>
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
            {done.filter(i => i.status !== 'MISSING').length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Itens separados ({done.filter(i => i.status !== 'MISSING').length})
                </p>
                <div className="space-y-2">
                  {done.filter(i => i.status !== 'MISSING').map(item => {
                    const product = getProductForTaskItem(item)
                    const picked = Number(item.pickedQuantity ?? 0)
                    const requested = Number(item.requestedQuantity ?? 0)
                    const isAdjusted = picked > 0 && picked !== requested
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-1">
                        {isAdjusted
                          ? <Edit3 size={14} className="text-orange-600 flex-shrink-0" />
                          : <Check size={14} className="text-green-600 flex-shrink-0" />}
                        <span className="flex-1 text-sm text-gray-900 truncate">{product?.name || 'Produto'}</span>
                        <span className={`text-sm ${isAdjusted ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                          {isAdjusted ? `${picked}/${requested}` : (picked || requested)} {product?.unit || 'un'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Missing items */}
            {done.filter(i => i.status === 'MISSING').length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <p className="text-xs text-red-400 uppercase tracking-wide mb-2">
                  Itens faltantes ({done.filter(i => i.status === 'MISSING').length})
                </p>
                <div className="space-y-2">
                  {done.filter(i => i.status === 'MISSING').map(item => {
                    const product = getProductForTaskItem(item)
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-1">
                        <X size={14} className="text-red-500 flex-shrink-0" />
                        <span className="flex-1 text-sm text-red-800 truncate">{product?.name || 'Produto'}</span>
                        {item.notes && <span className="text-xs text-red-400">{item.notes}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-white rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Resumo</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Itens separados</span>
                  <span className="font-medium">{done.filter(i => i.status !== 'MISSING').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Itens faltantes</span>
                  <span className="font-medium text-red-600">{done.filter(i => i.status === 'MISSING').length}</span>
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
                onChange={(e) => setDeliveryInstructions(e.target.value)}
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
                  onClick={() => { setReviewMode(false); setSendConfirm(false) }}
                  className="w-full h-11 rounded-xl border border-orange-300 text-orange-600 font-medium flex items-center justify-center gap-2 active:bg-orange-50"
                >
                  <Edit3 size={14} />
                  Corrigir Pedido
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setReviewMode(false); setSendConfirm(false) }}
                    className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setSendConfirm(true)}
                    className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Send size={14} />
                    Enviar ao Caixa
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSendConfirm(false)}
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendToCashier}
                  disabled={actionLoading}
                  className="flex-1 h-12 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Envio'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({
  product, orderItem, expanded, onToggle, onScan, onEan, onManual, onMissing, disabled,
}: {
  product?: { id: string; name: string; ean: string | null; imageUrl: string | null; unit: string | null } | null
  orderItem?: { quantity: number; requestedQuantity: number | null } | null
  expanded: boolean
  onToggle: () => void
  onScan: () => void
  onEan: () => void
  onManual: () => void
  onMissing: () => void
  disabled: boolean
}) {
  const qty = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 0)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-gray-50">
        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Package size={16} className="text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{product?.name || 'Produto'}</p>
          <p className="text-xs text-gray-500">
            {qty} {product?.unit || 'un'}
            {product?.ean && <span className="ml-2 text-gray-400">EAN: {product.ean}</span>}
          </p>
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

function DoneItemCard({
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
          <p className={`font-medium text-sm truncate ${isMissing ? 'text-red-900' : isAdjusted ? 'text-orange-900' : 'text-green-900'}`}>
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

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
