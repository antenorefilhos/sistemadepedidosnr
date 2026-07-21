import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, ClipboardList, PackageCheck, Play, RefreshCw, Replace, ScanLine, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getApiErrorMessage, pickingAPI, type AdminOrder, type PickingTask, type PickingTaskItem, type PickingPerformanceResponse } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em separacao',
  WAITING_SUBSTITUTION: 'Aguardando substituicao',
  CONFERENCE_PENDING: 'Aguardando conferencia',
  PACKING: 'Embalagem',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PICKED: 'Separado',
  MISSING: 'Faltante',
  SUBSTITUTED: 'Substituido',
  CANCELLED: 'Cancelado',
}

type ItemActionDraft = {
  taskId: string
  itemId: string
  mode: 'pick' | 'missing' | 'substitute'
  quantity: string
  finalWeight: string
  barcode: string
  notes: string
  reason: string
  requestSubstitution: boolean
  substituteProductId: string
}
type TaskActionDraft = {
  task: PickingTask
  mode: 'assign' | 'finish' | 'conference' | 'packing'
  value: string
}

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatQuantity(value?: number | string | null) {
  const parsed = toNumber(value)
  if (parsed === undefined) return '-'
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function taskStatusClassName(status: string) {
  switch (status) {
    case 'IN_PROGRESS':
      return 'border-blue-100 bg-blue-50 text-blue-800'
    case 'WAITING_SUBSTITUTION':
      return 'border-amber-100 bg-amber-50 text-amber-800'
    case 'CONFERENCE_PENDING':
      return 'border-purple-100 bg-purple-50 text-purple-800'
    case 'PACKING':
      return 'border-indigo-100 bg-indigo-50 text-indigo-800'
    case 'COMPLETED':
      return 'border-emerald-100 bg-emerald-50 text-emerald-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function itemStatusClassName(status: string) {
  switch (status) {
    case 'PICKED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-100'
    case 'MISSING':
      return 'bg-red-50 text-red-800 border-red-100'
    case 'SUBSTITUTED':
      return 'bg-amber-50 text-amber-800 border-amber-100'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

function orderLabel(order?: AdminOrder | null) {
  if (!order) return 'Pedido'
  return `#${order.id.slice(-8).toUpperCase()}`
}

function getItemSector(productName?: string) {
  const name = String(productName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/(carne|picanha|frango|linguica|costela|bife|acougue)/.test(name)) return 'Acougue'
  if (/(pao|bolo|padaria|croissant|sonho|baguete)/.test(name)) return 'Padaria'
  if (/(banana|maca|abacaxi|abobora|alface|tomate|verdura|legume)/.test(name)) return 'Hortifruti'
  if (/(cerveja|vinho|refrigerante|suco|agua|bebida)/.test(name)) return 'Bebidas'
  if (/(detergente|sabao|limpeza|amaciante|desinfetante)/.test(name)) return 'Limpeza'
  return 'Mercado'
}

function getTaskProgress(task: PickingTask) {
  const total = Math.max(task.items.length, 1)
  const done = task.items.filter((item) => ['PICKED', 'SUBSTITUTED', 'CANCELLED'].includes(item.status)).length
  return Math.round((done / total) * 100)
}

function getSectorProgress(task: PickingTask) {
  const sectors = new Map<string, { total: number; done: number }>()
  for (const item of task.items) {
    const productName = task.order?.items.find((orderItem) => orderItem.id === item.orderItemId)?.product?.name
    const sector = getItemSector(productName)
    const current = sectors.get(sector) || { total: 0, done: 0 }
    current.total += 1
    if (['PICKED', 'SUBSTITUTED', 'CANCELLED'].includes(item.status)) current.done += 1
    sectors.set(sector, current)
  }
  return Array.from(sectors.entries()).map(([sector, progress]) => ({ sector, ...progress }))
}

export default function PickingSection() {
  const [tasks, setTasks] = useState<PickingTask[]>([])
  const [eligibleOrders, setEligibleOrders] = useState<AdminOrder[]>([])
  const [performance, setPerformance] = useState<PickingPerformanceResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [actionError, setActionError] = useState('')
  const [itemActionDraft, setItemActionDraft] = useState<ItemActionDraft | null>(null)
  const [taskActionDraft, setTaskActionDraft] = useState<TaskActionDraft | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [tasksRes, eligibleRes, performanceRes] = await Promise.all([
        pickingAPI.getTasks({ status: statusFilter || undefined, limit: 100 }),
        pickingAPI.getEligibleOrders(30),
        pickingAPI.getPerformance(),
      ])
      setTasks(tasksRes.data)
      setEligibleOrders(eligibleRes.data)
      setPerformance(performanceRes.data)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Erro ao carregar separacao'))
      setTasks([])
      setEligibleOrders([])
      setPerformance(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const activeTasks = useMemo(() => tasks.filter((task) => !['COMPLETED', 'CANCELLED'].includes(task.status)), [tasks])
  const inProgress = useMemo(() => tasks.filter((task) => task.status === 'IN_PROGRESS').length, [tasks])
  const delayed = performance?.totals.delayed || 0
  const bestPicker = performance?.pickers.slice().sort((a, b) => b.itemsPerMinute - a.itemsPerMinute)[0]

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    try {
      setActionError('')
      setBusyKey(key)
      await action()
      await load()
      return true
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Erro ao executar acao de separacao'))
      return false
    } finally {
      setBusyKey('')
    }
  }

  const createTask = async () => {
    const selectedOrderId = orderId.trim()
    if (!selectedOrderId) {
      setActionError('Informe um pedido para criar a tarefa.')
      return
    }
    await runAction('create-task', () => pickingAPI.createTaskFromOrder(selectedOrderId))
    setOrderId('')
  }

  const assignTask = async (task: PickingTask) => {
    setActionError('')
    setTaskActionDraft({ task, mode: 'assign', value: task.assignedToId || '' })
  }

  const openTaskAction = (task: PickingTask, mode: TaskActionDraft['mode']) => {
    setActionError('')
    setTaskActionDraft({ task, mode, value: '' })
  }

  const submitTaskAction = async () => {
    if (!taskActionDraft) return
    const { task, mode } = taskActionDraft
    const value = taskActionDraft.value.trim()

    if (mode === 'assign') {
      if (!value) {
        setActionError('Informe o ID do separador.')
        return
      }
      await runAction(`assign-${task.id}`, () => pickingAPI.assignTask(task.id, value))
    } else if (mode === 'finish') {
      await runAction(`finish-${task.id}`, () => pickingAPI.finishTask(task.id, value ? { notes: value } : undefined))
    } else if (mode === 'conference') {
      await runAction(`conference-${task.id}`, () => pickingAPI.conferenceTask(task.id, value ? { justification: value } : undefined))
    } else {
      await runAction(`packing-${task.id}`, () => pickingAPI.completePackingChecklist(task.id, value ? { notes: value } : undefined))
    }

    setTaskActionDraft(null)
  }

  const openItemAction = (task: PickingTask, item: PickingTaskItem, mode: ItemActionDraft['mode']) => {
    setActionError('')
    setItemActionDraft({
      taskId: task.id,
      itemId: item.id,
      mode,
      quantity: String(toNumber(item.requestedQuantity) ?? ''),
      finalWeight: '',
      barcode: '',
      notes: '',
      reason: '',
      requestSubstitution: mode !== 'missing',
      substituteProductId: '',
    })
  }

  const updateItemActionDraft = (patch: Partial<ItemActionDraft>) => {
    setItemActionDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const submitItemAction = async () => {
    if (!itemActionDraft) return
    const { taskId, itemId, mode } = itemActionDraft

    if (mode === 'pick') {
      const quantity = Number(itemActionDraft.quantity.replace(',', '.'))
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setActionError('Informe a quantidade separada para concluir o item.')
        return
      }
      const finalWeight = itemActionDraft.finalWeight.trim() ? Number(itemActionDraft.finalWeight.replace(',', '.')) : undefined
      await runAction(`pick-${itemId}`, () => pickingAPI.pickItem(taskId, itemId, {
        quantity,
        ...(finalWeight && Number.isFinite(finalWeight) ? { finalWeight } : {}),
        ...(itemActionDraft.barcode.trim() ? { barcode: itemActionDraft.barcode.trim() } : {}),
        ...(itemActionDraft.notes.trim() ? { notes: itemActionDraft.notes.trim() } : {}),
      }))
      setItemActionDraft(null)
      return
    }

    if (mode === 'missing') {
      const reason = itemActionDraft.reason.trim()
      if (!reason) {
        setActionError('Informe o motivo da falta para registrar a ruptura.')
        return
      }
      await runAction(`missing-${itemId}`, () => pickingAPI.markMissing(taskId, itemId, {
        reason,
        requestSubstitution: itemActionDraft.requestSubstitution,
        notes: itemActionDraft.notes.trim() || reason,
      }))
      setItemActionDraft(null)
      return
    }

    const substituteProductId = itemActionDraft.substituteProductId.trim()
    if (!substituteProductId) {
      setActionError('Informe o ID ou codigo do produto substituto.')
      return
    }
    const quantity = itemActionDraft.quantity.trim() ? Number(itemActionDraft.quantity.replace(',', '.')) : undefined
    const reason = itemActionDraft.reason.trim()
    await runAction(`substitute-${itemId}`, () => pickingAPI.substituteItem(taskId, itemId, {
      substituteProductId,
      ...(quantity && Number.isFinite(quantity) ? { quantity } : {}),
      ...(reason ? { reason, notes: itemActionDraft.notes.trim() || reason } : {}),
    }))
    setItemActionDraft(null)
  }

  const finishTask = async (task: PickingTask) => {
    openTaskAction(task, 'finish')
  }

  const conferenceTask = async (task: PickingTask) => {
    openTaskAction(task, 'conference')
  }

  const completePacking = async (task: PickingTask) => {
    openTaskAction(task, 'packing')
  }

  const getOrderItem = (task: PickingTask, item: PickingTaskItem) =>
    task.order?.items.find((orderItem) => orderItem.id === item.orderItemId)

  const taskActionDisabled = (key: string) => Boolean(busyKey && busyKey !== key)

  return (
    <div className="space-y-6">
      {actionError && (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SectionMetric label="Fila ativa" value={activeTasks.length} tone="brand" />
        <SectionMetric label="Em separacao" value={inProgress} tone="neutral" />
        <SectionMetric label="Atrasadas" value={delayed} tone={delayed > 0 ? 'default' : 'success'} />
        <SectionMetric label="Melhor ritmo" value={bestPicker ? `${bestPicker.itemsPerMinute}/min` : '-'} tone="success" />
      </div>

      <SectionToolbar>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_220px]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Pedido</label>
              <div className="flex gap-2">
                <Input
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  list="eligible-picking-orders"
                  placeholder="ID do pedido"
                  className="h-11 min-w-0 flex-1 rounded-xl border-[#ead7df] bg-white text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
                />
                <datalist id="eligible-picking-orders">
                  {eligibleOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.customer?.name || order.id}
                    </option>
                  ))}
                </datalist>
                <Button
                  type="button"
                  onClick={createTask}
                  disabled={busyKey === 'create-task'}
                  className="h-11 rounded-xl bg-[#5d082a] px-4 text-sm font-semibold text-white hover:bg-[#7a1038]"
                >
                  <ClipboardCheck size={16} />
                  Criar
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Status</label>
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-xl border-[#ead7df] bg-white text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
              >
                <option value="">Todos</option>
                {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>{label}</option>
                ))}
              </Select>
            </div>
          </div>

          <Button
            type="button"
            onClick={load}
            disabled={loading}
            variant="outline"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ead7df] bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </Button>
        </div>
      </SectionToolbar>

      <SectionPanel>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Carregando fila...</div>
        ) : tasks.length === 0 ? (
          <div className="p-6">
            <SectionEmptyState title="Nenhuma tarefa de separacao" description="Crie uma tarefa a partir de um pedido confirmado ou ajuste o filtro." />
          </div>
        ) : (
          <div className="divide-y divide-[#f1dbe3]">
            {tasks.map((task) => {
              const customerName = task.order?.customer?.name || 'Cliente nao identificado'
              const taskProgress = getTaskProgress(task)
              const sectorProgress = getSectorProgress(task)
              return (
                <div key={task.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-gray-600">
                          {orderLabel(task.order)}
                        </span>
                        <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-xs font-bold ${taskStatusClassName(task.status)}`}>
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </Badge>
                        {task.assignedToId && (
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {task.assignedToId}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 truncate text-base font-bold text-gray-900">{customerName}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>SLA: {formatDateTime(task.slaDueAt)}</span>
                        <span>Inicio: {formatDateTime(task.startedAt)}</span>
                        <span>Fim: {formatDateTime(task.completedAt)}</span>
                      </div>
                      <div className="mt-3 max-w-xl">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                          <span>Progresso da separacao</span>
                          <span>{taskProgress}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#5d082a]" style={{ width: `${taskProgress}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sectorProgress.map((item) => (
                            <Badge key={item.sector} variant="outline" className="rounded-full border-[#ead7df] bg-[#fff7fa] px-2.5 py-1 text-[11px] font-bold text-[#5d082a]">
                              {item.sector}: {item.done}/{item.total}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <Button
                        type="button"
                        onClick={() => assignTask(task)}
                        disabled={taskActionDisabled(`assign-${task.id}`)}
                        variant="outline"
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-[#ead7df] bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 sm:min-h-10"
                      >
                        <UserPlus size={14} />
                        Atribuir
                      </Button>
                      <Button
                        type="button"
                        onClick={() => runAction(`start-${task.id}`, () => pickingAPI.startTask(task.id))}
                        disabled={taskActionDisabled(`start-${task.id}`) || !['PENDING', 'WAITING_SUBSTITUTION'].includes(task.status)}
                        variant="outline"
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-60 sm:min-h-10"
                      >
                        <Play size={14} />
                        Iniciar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => finishTask(task)}
                        disabled={taskActionDisabled(`finish-${task.id}`) || !['IN_PROGRESS', 'WAITING_SUBSTITUTION'].includes(task.status)}
                        variant="outline"
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 disabled:opacity-60 sm:min-h-10"
                      >
                        <ClipboardList size={14} />
                        Conferencia
                      </Button>
                      <Button
                        type="button"
                        onClick={() => conferenceTask(task)}
                        disabled={taskActionDisabled(`conference-${task.id}`) || task.status !== 'CONFERENCE_PENDING'}
                        variant="outline"
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60 sm:min-h-10"
                      >
                        <CheckCircle2 size={14} />
                        Conferir
                      </Button>
                      <Button
                        type="button"
                        onClick={() => completePacking(task)}
                        disabled={taskActionDisabled(`packing-${task.id}`) || task.status !== 'PACKING'}
                        variant="outline"
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 sm:min-h-10"
                      >
                        <PackageCheck size={14} />
                        Embalar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {task.items.map((item) => {
                      const orderItem = getOrderItem(task, item)
                      const sector = getItemSector(orderItem?.product?.name)
                      return (
                        <div key={item.id} className="rounded-lg border border-[#ead7df] bg-white p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap gap-1.5">
                                <Badge className="rounded-full bg-[#f7edf2] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#5d082a]">{sector}</Badge>
                                {orderItem?.product?.ean && (
                                  <Badge variant="outline" className="rounded-full border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">EAN {orderItem.product.ean}</Badge>
                                )}
                              </div>
                              <p className="text-base font-bold leading-snug text-gray-900 sm:truncate sm:text-sm">{orderItem?.product?.name || item.productId}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                <span>Pedido: {formatQuantity(item.requestedQuantity)}</span>
                                <span>Separado: {formatQuantity(item.pickedQuantity)}</span>
                                {item.finalWeight && <span>Peso: {formatQuantity(item.finalWeight)}</span>}
                                {item.barcode && <span>Codigo: {item.barcode}</span>}
                              </div>
                              {item.notes && <p className="mt-1 text-xs text-gray-500">{item.notes}</p>}
                            </div>
                            <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${itemStatusClassName(item.status)}`}>
                              {ITEM_STATUS_LABELS[item.status] || item.status}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <Button
                              type="button"
                              onClick={() => openItemAction(task, item, 'pick')}
                              disabled={taskActionDisabled(`pick-${item.id}`) || !['PENDING', 'MISSING'].includes(item.status)}
                              variant="outline"
                              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 sm:min-h-9 sm:flex-row"
                            >
                              <ScanLine size={13} />
                              Separar
                            </Button>
                            <Button
                              type="button"
                              onClick={() => openItemAction(task, item, 'missing')}
                              disabled={taskActionDisabled(`missing-${item.id}`) || item.status !== 'PENDING'}
                              variant="outline"
                              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-60 sm:min-h-9 sm:flex-row"
                            >
                              <AlertTriangle size={13} />
                              Falta
                            </Button>
                            <Button
                              type="button"
                              onClick={() => openItemAction(task, item, 'substitute')}
                              disabled={taskActionDisabled(`substitute-${item.id}`) || !['PENDING', 'MISSING'].includes(item.status)}
                              variant="outline"
                              className="inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 sm:min-h-9 sm:flex-row"
                            >
                              <Replace size={13} />
                              Substituir
                            </Button>
                          </div>

                          {itemActionDraft?.taskId === task.id && itemActionDraft.itemId === item.id && (
                            <div className="mt-4 rounded-xl border border-[#D2BB8A]/50 bg-[#FFFBF3] p-3">
                              <p className="text-xs font-black uppercase tracking-wider text-[#5d082a]">
                                {itemActionDraft.mode === 'pick' && 'Concluir item'}
                                {itemActionDraft.mode === 'missing' && 'Registrar falta'}
                                {itemActionDraft.mode === 'substitute' && 'Substituir item'}
                              </p>

                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {itemActionDraft.mode !== 'missing' && (
                                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                                    Quantidade
                                    <Input
                                      value={itemActionDraft.quantity}
                                      onChange={(event) => updateItemActionDraft({ quantity: event.target.value })}
                                      inputMode="decimal"
                                      className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                    />
                                  </label>
                                )}

                                {itemActionDraft.mode === 'pick' && (
                                  <>
                                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                                      Peso final
                                      <Input
                                        value={itemActionDraft.finalWeight}
                                        onChange={(event) => updateItemActionDraft({ finalWeight: event.target.value })}
                                        inputMode="decimal"
                                        placeholder="Opcional"
                                        className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                                      Codigo lido
                                      <Input
                                        value={itemActionDraft.barcode}
                                        onChange={(event) => updateItemActionDraft({ barcode: event.target.value })}
                                        inputMode="numeric"
                                        placeholder="EAN ou etiqueta"
                                        className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                      />
                                    </label>
                                  </>
                                )}

                                {itemActionDraft.mode === 'substitute' && (
                                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                                    Produto substituto
                                    <Input
                                      value={itemActionDraft.substituteProductId}
                                      onChange={(event) => updateItemActionDraft({ substituteProductId: event.target.value })}
                                      placeholder="ID ou codigo"
                                      className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                    />
                                  </label>
                                )}

                                {itemActionDraft.mode !== 'pick' && (
                                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                                    Motivo
                                    <Input
                                      value={itemActionDraft.reason}
                                      onChange={(event) => updateItemActionDraft({ reason: event.target.value })}
                                      placeholder="Ex: sem estoque na gondola"
                                      className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                    />
                                  </label>
                                )}
                              </div>

                              {itemActionDraft.mode === 'missing' && (
                                <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-semibold text-[#5d4f33]">
                                  Solicitar substituto ao operador
                                  <Checkbox
                                    checked={itemActionDraft.requestSubstitution}
                                    onChange={(event) => updateItemActionDraft({ requestSubstitution: event.target.checked })}
                                    className="h-5 w-5 rounded border-[#D2BB8A] text-[#5d082a]"
                                  />
                                </label>
                              )}

                              <label className="mt-3 block space-y-1 text-xs font-semibold text-gray-600">
                                Observacao
                                <Input
                                  value={itemActionDraft.notes}
                                  onChange={(event) => updateItemActionDraft({ notes: event.target.value })}
                                  placeholder="Opcional"
                                  className="h-11 rounded-lg border-[#E8D7B0] bg-white text-sm shadow-none focus-visible:ring-[#5d082a]/20"
                                />
                              </label>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  onClick={() => setItemActionDraft(null)}
                                  variant="outline"
                                  className="min-h-12 rounded-xl border border-[#D2BB8A] bg-white px-3 py-2 text-sm font-bold text-[#5d082a]"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  onClick={submitItemAction}
                                  disabled={Boolean(busyKey)}
                                  className="min-h-12 rounded-xl bg-[#5d082a] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                                >
                                  Confirmar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionPanel>

      {taskActionDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2e2226]/40 px-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="picking-task-action-title" className="w-full max-w-md rounded-2xl border border-[#ead7df] bg-white p-5 shadow-[0_24px_80px_rgba(46,34,38,0.25)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff7fa] text-[#5d082a]">
                {taskActionDraft.mode === 'assign' && <UserPlus size={18} />}
                {taskActionDraft.mode === 'finish' && <ClipboardList size={18} />}
                {taskActionDraft.mode === 'conference' && <CheckCircle2 size={18} />}
                {taskActionDraft.mode === 'packing' && <PackageCheck size={18} />}
              </div>
              <div>
                <h3 id="picking-task-action-title" className="text-base font-black text-[#2e2226]">
                  {taskActionDraft.mode === 'assign' && 'Atribuir separador'}
                  {taskActionDraft.mode === 'finish' && 'Enviar para conferencia'}
                  {taskActionDraft.mode === 'conference' && 'Registrar conferencia'}
                  {taskActionDraft.mode === 'packing' && 'Finalizar embalagem'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{orderLabel(taskActionDraft.task.order)}</p>
              </div>
            </div>

            <label htmlFor="picking-task-action-value" className="mt-5 block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[#9e7080]">
              {taskActionDraft.mode === 'assign' && 'ID do separador'}
              {taskActionDraft.mode === 'finish' && 'Observacao final da separacao'}
              {taskActionDraft.mode === 'conference' && 'Justificativa de divergencia'}
              {taskActionDraft.mode === 'packing' && 'Observacao da embalagem'}
              <Input
                id="picking-task-action-value"
                value={taskActionDraft.value}
                onChange={(event) => setTaskActionDraft((current) => current ? { ...current, value: event.target.value } : current)}
                placeholder={taskActionDraft.mode === 'assign' ? 'Ex: separador-01' : 'Opcional'}
                className="mt-1 h-11 rounded-xl border-[#ead7df] bg-white text-sm normal-case tracking-normal text-gray-800 shadow-none focus-visible:ring-[#5d082a]/20"
                autoFocus
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaskActionDraft(null)} disabled={Boolean(busyKey)} className="rounded-xl border-[#ead7df]">
                Cancelar
              </Button>
              <Button type="button" onClick={submitTaskAction} disabled={Boolean(busyKey)} className="rounded-xl bg-[#5d082a] text-white hover:bg-[#4a0622]">
                {busyKey ? 'Processando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
