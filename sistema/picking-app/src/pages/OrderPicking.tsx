import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Check, ClipboardList, Loader2, Package, Plus } from 'lucide-react'
import { pickerApi, PickingTask, PickingTaskItem, Order } from '../services/api'
import { getOrderPdvCode, hasPdvCode } from '../utils/orderCode'
import { deliveryLabel, paymentLabel } from '../utils/orderInfo'
import toast from 'react-hot-toast'
import BarcodeScanner from '../components/BarcodeScanner'
import { Modal, ItemCard, DoneItemCard } from '../components/PickingShared'
import { ManualConfirmModal } from '../components/ManualConfirmModal'
import { AddItemScreen } from '../components/AddItemScreen'
import { ReviewScreen } from '../components/ReviewScreen'

// Motivo de nao ter tarefa de separacao quando o pedido nao e elegivel (ver
// ensureTaskForOrder no backend). Sem isso, um pedido cancelado ou ja
// finalizado cai no mesmo "Nenhum item para separar" de um pedido com
// carrinho vazio de verdade -- o separador nao sabe se e um erro ou se o
// pedido so nao chegou a essa etapa.
const ORDER_NOT_PICKABLE_LABEL: Record<string, string> = {
  CANCELLED: 'Este pedido foi cancelado.',
  COMPLETED: 'Este pedido já foi concluído.',
  REFUNDED: 'Este pedido foi estornado.',
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
  // Texto exibido no input, separado do numero validado (adjustQty). Sem
  // isso, apagar o campo pra digitar um peso novo forcava de volta pro
  // minimo (0,01) a cada tecla apagada -- Number('') || minValue cai no
  // minValue no instante em que o campo fica vazio, antes do usuario
  // conseguir digitar o valor certo.
  const [adjustQtyText, setAdjustQtyText] = useState<string>('0')
  const [missingItem, setMissingItem] = useState<{ taskItemId: string; reason: string } | null>(null)
  const [addItemModal, setAddItemModal] = useState(false)
  const [addItemScanner, setAddItemScanner] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Array<{ id: string; name: string; ean: string | null; price: number; promotionalPrice: number | null; unit: string | null }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addQty, setAddQty] = useState(1)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [sendConfirm, setSendConfirm] = useState(false)
  const [takeoverConfirm, setTakeoverConfirm] = useState(false)
  const eanInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestSeq = useRef(0)

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

  // JON-57: timer de debounce da busca de produtos nao era limpo no unmount
  // -- desmontar a pagina antes dos 300ms disparava a busca de qualquer jeito.
  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
  }, [])

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

  // Pedido preso a outro separador (ex.: aberto no admin e abandonado): sem
  // isso o app so recusava cada acao com "sendo separado por outro membro".
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('picker_user') || 'null') as { id?: string; role?: string } | null } catch { return null }
  })()
  const lockedByOther = Boolean(
    task && task.assignedToId && currentUser?.id && task.assignedToId !== currentUser.id &&
    currentUser.role !== 'admin' && ['IN_PROGRESS', 'WAITING_SUBSTITUTION'].includes(task.status),
  )

  const handleTakeover = async () => {
    if (!task) return
    setActionLoading(true)
    try {
      await pickerApi.claimTask(task.id)
      await refreshTask()
      setTakeoverConfirm(false)
      toast.success('Separacao assumida')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao assumir')
    } finally {
      setActionLoading(false)
    }
  }

  const getProductForTaskItem = (taskItem: PickingTaskItem) => {
    const orderItem = order?.items?.find(i => i.id === taskItem.orderItemId)
    return orderItem?.product
  }

  const getOrderItemForTaskItem = (taskItem: PickingTaskItem) => {
    return order?.items?.find(i => i.id === taskItem.orderItemId)
  }

  const isWeightedProduct = (product?: { unit?: string | null; isFractional?: boolean | null } | null) => {
    return Boolean(product?.isFractional) || ['kg', 'quilo', 'g'].includes(String(product?.unit || '').toLowerCase())
  }

  // Etiqueta impressa na balanca da loja usa o padrao GS1 de "prefixo 2":
  // 2 + 5 digitos de codigo interno + 5 digitos de peso em gramas + digito
  // verificador (13 digitos) -- nunca bate com o EAN de catalogo fixo do
  // produto, que era o unico formato aceito antes. Decodifica pra validar
  // pelo codigo interno (sufixo do EAN cadastrado) e usar o peso real pesado
  // em vez de assumir que bateu com o peso pedido.
  // ponytail: layout assumido (peso em gramas nos digitos 7-11) -- confirmar
  // contra etiqueta real da balanca da loja; se divergir, so ajustar os
  // indices do slice abaixo.
  const decodeScaleBarcode = (barcode: string): { code: string; weightKg: number } | null => {
    if (!/^2\d{12}$/.test(barcode)) return null
    const code = barcode.slice(1, 6)
    const weightGrams = Number(barcode.slice(6, 11))
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) return null
    return { code, weightKg: weightGrams / 1000 }
  }

  const handleScan = (taskItem: PickingTaskItem) => {
    setConfirm({ mode: 'scan', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  const handleEanMode = (taskItem: PickingTaskItem) => {
    setConfirm({ mode: 'ean', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  const handleManualMode = (taskItem: PickingTaskItem) => {
    const orderItem = getOrderItemForTaskItem(taskItem)
    const inicial = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1)
    setAdjustQty(inicial)
    setAdjustQtyText(String(inicial))
    setConfirm({ mode: 'manual', itemId: null, taskItemId: taskItem.id, ean: '' })
  }

  // Aceita digito por digito enquanto o campo esta vazio ou incompleto (ex.:
  // "1," no meio da digitacao de "1,25") sem forcar nenhum valor default --
  // so atualiza o numero validado (adjustQty) quando o texto ja parseia pra
  // um numero de verdade. O valor exibido aceita virgula OU ponto.
  const handleAdjustQtyTextChange = (raw: string) => {
    let sanitized = raw.replace(/[^\d.,]/g, '')
    const partes = sanitized.split(/[.,]/)
    if (partes.length > 2) {
      const separador = sanitized.includes(',') ? ',' : '.'
      sanitized = partes[0] + separador + partes.slice(1).join('')
    }
    setAdjustQtyText(sanitized)

    const normalizado = sanitized.replace(',', '.')
    if (normalizado !== '' && normalizado !== '.' && !normalizado.endsWith('.') && !Number.isNaN(Number(normalizado))) {
      setAdjustQty(Number(normalizado))
    }
  }

  // Ao sair do campo (ou confirmar), aplica o minimo -- so aqui, nunca
  // durante a digitacao, senao volta o bug de nao deixar apagar.
  const handleAdjustQtyBlur = (minValue: number) => {
    const normalizado = adjustQtyText.replace(',', '.')
    const parsed = Number(normalizado)
    const valido = Number.isFinite(parsed) && parsed > 0 ? Math.max(minValue, parsed) : minValue
    const arredondado = Number(valido.toFixed(3))
    setAdjustQty(arredondado)
    setAdjustQtyText(String(arredondado))
  }

  const handleBarcodeResult = async (barcode: string) => {
    if (!task || !confirm.taskItemId) return
    const taskItem = task.items.find(i => i.id === confirm.taskItemId)
    if (!taskItem) return
    const product = getProductForTaskItem(taskItem)
    const orderItem = getOrderItemForTaskItem(taskItem)

    const scaleDecoded = isWeightedProduct(product) ? decodeScaleBarcode(barcode) : null
    const eanMatches = !product?.ean || barcode === product.ean || (scaleDecoded && product.ean.endsWith(scaleDecoded.code))

    if (!eanMatches) {
      toast.error(`EAN ${barcode} nao corresponde ao produto (${product?.ean})`)
      setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })
      return
    }

    setActionLoading(true)
    try {
      const qty = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1)
      const finalWeight = scaleDecoded ? scaleDecoded.weightKg : qty
      const { data } = await pickerApi.pickItem(task.id, taskItem.id, {
        quantity: qty,
        barcode,
        ...(isWeightedProduct(product) ? { finalWeight } : {}),
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
    const product = getProductForTaskItem(taskItem)
    const orderItem = getOrderItemForTaskItem(taskItem)
    const requested = Number(orderItem?.requestedQuantity ?? orderItem?.quantity ?? 1)

    setActionLoading(true)
    try {
      const isAdjusted = adjustQty !== requested
      const { data } = await pickerApi.pickItem(task.id, taskItem.id, {
        quantity: adjustQty,
        notes: isAdjusted ? `Quantidade corrigida: ${adjustQty}/${requested}` : 'Marcacao manual',
        ...(isWeightedProduct(product) ? { finalWeight: adjustQty } : {}),
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

  const handleSearchProducts = (q: string) => {
    setProductSearch(q)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    // JON-57 (Auditoria 360, Medium): seq so avancava quando o timer
    // disparava -- limpar o campo com uma busca em voo nao invalidava a seq,
    // entao a resposta antiga ainda passava na checagem e repunha produtos
    // numa lista que deveria estar vazia. Avancar aqui, antes de qualquer
    // ramo (incluindo o curto), garante que toda resposta pendente perca a
    // corrida contra a proxima interacao do usuario.
    const seq = ++searchRequestSeq.current

    if (q.trim().length < 2) {
      setProductResults([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await pickerApi.searchProducts(q)
        if (seq !== searchRequestSeq.current) return // resposta antiga, ignorar
        setProductResults(data)
      } catch (err: any) {
        if (seq !== searchRequestSeq.current) return
        setProductResults([])
        toast.error(err.response?.data?.message || 'Erro ao buscar produtos')
      } finally {
        if (seq === searchRequestSeq.current) setSearchLoading(false)
      }
    }, 300)
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
              {hasPdvCode(order) ? `DAV ${getOrderPdvCode(order)}` : `#${getOrderPdvCode(order)}`} · {done.length}/{taskItems.length} itens
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
        {lockedByOther && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <p>Em separação por <strong>{task?.assignedToName || 'outro membro da equipe'}</strong>.</p>
            <button
              onClick={() => setTakeoverConfirm(true)}
              disabled={actionLoading}
              className="mt-2 w-full h-10 rounded-xl bg-red-600 text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              Assumir separação
            </button>
          </div>
        )}
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>Pagamento:</strong> {paymentLabel(order.paymentMethod)}</span>
          <span className="text-red-600 font-semibold">{deliveryLabel(order)}</span>
        </div>
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
                onReset={() => { if (window.confirm('Desfazer a separacao deste item?')) handleResetItem(item.id) }}
                onRemove={() => { if (window.confirm('Remover este item ja separado?')) handleRemoveItem(item.id) }}
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
            <p className="text-sm">
              {!task && ORDER_NOT_PICKABLE_LABEL[order.status]
                ? ORDER_NOT_PICKABLE_LABEL[order.status]
                : 'Nenhum item para separar'}
            </p>
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

      {takeoverConfirm && (
        <Modal onClose={() => setTakeoverConfirm(false)}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Assumir separação?</h2>
          <p className="text-sm text-gray-600 mb-4">
            {task?.assignedToName || 'Outro membro da equipe'} está separando este pedido. Ao assumir, os itens já marcados continuam e só você poderá continuar.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setTakeoverConfirm(false)} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-semibold">Cancelar</button>
            <button onClick={handleTakeover} disabled={actionLoading} className="flex-1 h-11 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-60">
              {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Assumir'}
            </button>
          </div>
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
        return (
          <ManualConfirmModal
            product={product}
            orderItem={orderItem}
            adjustQty={adjustQty}
            adjustQtyText={adjustQtyText}
            actionLoading={actionLoading}
            onAdjustQtyTextChange={handleAdjustQtyTextChange}
            onAdjustQtyBlur={handleAdjustQtyBlur}
            onDecrement={(step, minValue) => {
              const next = Math.max(minValue, Number((adjustQty - step).toFixed(3)))
              setAdjustQty(next)
              setAdjustQtyText(String(next))
            }}
            onIncrement={(step) => {
              const next = Number((adjustQty + step).toFixed(3))
              setAdjustQty(next)
              setAdjustQtyText(String(next))
            }}
            onConfirm={handleManualConfirm}
            onClose={() => setConfirm({ mode: null, itemId: null, taskItemId: null, ean: '' })}
          />
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
        <AddItemScreen
          productSearch={productSearch}
          productResults={productResults}
          searchLoading={searchLoading}
          addQty={addQty}
          actionLoading={actionLoading}
          addItemScanner={addItemScanner}
          onSearchChange={handleSearchProducts}
          onOpenScanner={() => setAddItemScanner(true)}
          onCloseScanner={() => setAddItemScanner(false)}
          onScanResult={(barcode) => { setAddItemScanner(false); handleSearchProducts(barcode) }}
          onAddQtyChange={setAddQty}
          onAddItem={handleAddItem}
          onClose={() => { setAddItemModal(false); setProductSearch(''); setProductResults([]); setAddQty(1) }}
        />
      )}

      {/* Review screen */}
      {reviewMode && order && (
        <ReviewScreen
          order={order}
          doneItems={done}
          deliveryInstructions={deliveryInstructions}
          sendConfirm={sendConfirm}
          actionLoading={actionLoading}
          onBack={() => { setReviewMode(false); setSendConfirm(false) }}
          onDeliveryInstructionsChange={setDeliveryInstructions}
          onAskConfirm={() => setSendConfirm(true)}
          onSend={handleSendToCashier}
          onCancelConfirm={() => setSendConfirm(false)}
        />
      )}
    </div>
  )
}

