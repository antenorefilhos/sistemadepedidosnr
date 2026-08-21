import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, PackageCheck, Play, RefreshCw, Replace, ScanLine, Search, UserPlus, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage, pickingAPI, type AdminOrder, type PickingTask, type PickingTaskItem, type PickingPerformanceResponse } from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em separação',
  WAITING_SUBSTITUTION: 'Aguardando substituição',
  CONFERENCE_PENDING: 'Aguardando conferência',
  PACKING: 'Embalagem',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PICKED: 'Separado',
  MISSING: 'Faltante',
  SUBSTITUTED: 'Substituído',
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
  const [customerSearch, setCustomerSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState('')
  const autoRefreshRef = useRef(autoRefresh)
  autoRefreshRef.current = autoRefresh

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
      setActionError(getApiErrorMessage(error, 'Erro ao carregar separação'))
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

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const displayedTasks = useMemo(() => {
    if (!customerSearch.trim()) return tasks
    const q = customerSearch.toLowerCase()
    return tasks.filter((task) => {
      const name = task.order?.customer?.name || ''
      return name.toLowerCase().includes(q)
    })
  }, [tasks, customerSearch])

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
      setActionError(getApiErrorMessage(error, 'Erro ao executar acao de separação'))
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
        <SectionMetric label="Em separação" value={inProgress} tone="neutral" />
        <SectionMetric label="Atrasadas" value={delayed} tone={delayed > 0 ? 'default' : 'success'} />
        <SectionMetric label="Melhor ritmo" value={bestPicker ? `${bestPicker.itemsPerMinute}/min` : '-'} tone="success" />
      </div>

      <SectionToolbar>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_220px_220px]">
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9e7080]">Cliente</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Buscar por cliente..."
                  className="h-11 rounded-xl border-[#ead7df] bg-white pl-9 text-sm text-gray-700 shadow-none focus-visible:ring-[#5d082a]/20"
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="outline"
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              autoRefresh
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-[#ead7df] bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title={autoRefresh ? 'Atualização automática ligada (30s)' : 'Ligar atualização automática'}
          >
            <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
            {autoRefresh ? '30s' : 'Auto'}
          </Button>
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
        ) : displayedTasks.length === 0 ? (
          <div className="p-6">
            <SectionEmptyState title="Nenhuma tarefa de separação" description={customerSearch.trim() ? 'Nenhuma tarefa encontrada para este cliente.' : 'Crie uma tarefa a partir de um pedido confirmado ou ajuste o filtro.'} />
          </div>
        ) : (
          <div className="divide-y divide-[#f1dbe3]">
            {displayedTasks.map((task) => {
              const customerName = task.order?.customer?.name || 'Cliente nao identificado'
              const taskProgress = getTaskProgress(task)
              const doneItems = task.items.filter((item) => ['PICKED', 'SUBSTITUTED', 'CANCELLED'].includes(item.status)).length
              const expanded = expandedTaskId === task.id
              const primaryAction =
                ['PENDING', 'WAITING_SUBSTITUTION'].includes(task.status)
                  ? { key: `start-${task.id}`, label: 'Iniciar', icon: Play, cls: 'border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100', onClick: () => runAction(`start-${task.id}`, () => pickingAPI.startTask(task.id)) }
                  : task.status === 'IN_PROGRESS'
                  ? { key: `finish-${task.id}`, label: 'Conferir', icon: ClipboardList, cls: 'border-purple-100 bg-purple-50 text-purple-800 hover:bg-purple-100', onClick: () => finishTask(task) }
                  : task.status === 'CONFERENCE_PENDING'
                  ? { key: `conference-${task.id}`, label: 'Conferir', icon: CheckCircle2, cls: 'border-indigo-100 bg-indigo-50 text-indigo-800 hover:bg-indigo-100', onClick: () => conferenceTask(task) }
                  : task.status === 'PACKING'
                  ? { key: `packing-${task.id}`, label: 'Finalizar', icon: PackageCheck, cls: 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100', onClick: () => completePacking(task) }
                  : null

              return (
                <div key={task.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedTaskId(expanded ? '' : task.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fff7fa] sm:flex-nowrap sm:gap-4"
                  >
                    <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-semibold text-gray-600">
                      {orderLabel(task.order)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 sm:flex-none sm:basis-48">{customerName}</span>
                    <Badge variant="outline" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${taskStatusClassName(task.status)}`}>
                      {TASK_STATUS_LABELS[task.status] || task.status}
                    </Badge>
                    <span className="hidden shrink-0 text-xs text-gray-500 sm:inline">SLA {formatDateTime(task.slaDueAt)}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <span className="block h-full rounded-full bg-[#5d082a]" style={{ width: `${taskProgress}%` }} />
                      </span>
                      <span className="text-xs font-bold text-gray-600">{doneItems}/{task.items.length} itens</span>
                    </span>
                    <span className="ml-auto shrink-0" onClick={(event) => event.stopPropagation()}>
                      {primaryAction ? (
                        <Button
                          type="button"
                          onClick={primaryAction.onClick}
                          disabled={taskActionDisabled(primaryAction.key)}
                          variant="outline"
                          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${primaryAction.cls}`}
                        >
                          <primaryAction.icon size={13} />
                          {primaryAction.label}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          {TASK_STATUS_LABELS[task.status] || task.status}
                        </Badge>
                      )}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-[#f1dbe3] bg-[#fffcfd] px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Início: {task.startedAt ? formatDateTime(task.startedAt) : 'Não iniciada'}</span>
                        <span>Fim: {task.completedAt ? formatDateTime(task.completedAt) : task.startedAt ? 'Em andamento' : '—'}</span>
                        {task.assignedToId && <span>Separador: {task.assignedToId}</span>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => assignTask(task)}
                          disabled={taskActionDisabled(`assign-${task.id}`)}
                          variant="outline"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#ead7df] bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          <UserPlus size={13} />
                          Atribuir
                        </Button>
                        <Button
                          type="button"
                          onClick={() => runAction(`cancel-${task.id}`, () => pickingAPI.cancelTask(task.id))}
                          disabled={taskActionDisabled(`cancel-${task.id}`) || ['COMPLETED', 'CANCELLED'].includes(task.status)}
                          variant="outline"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-60"
                        >
                          <XCircle size={13} />
                          Cancelar
                        </Button>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-lg border border-[#ead7df] bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10"></TableHead>
                              <TableHead>Produto</TableHead>
                              <TableHead>Qtd. pedida / separada</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {task.items.map((item) => {
                              const orderItem = getOrderItem(task, item)
                              const sector = getItemSector(orderItem?.product?.name)
                              const draftOpen = itemActionDraft?.taskId === task.id && itemActionDraft.itemId === item.id
                              return (
                                <>
                                  <TableRow key={item.id}>
                                    <TableCell className="p-2">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f7edf2] text-[10px] font-black uppercase text-[#5d082a]">
                                        {sector.slice(0, 2)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <p className="text-sm font-bold leading-snug text-gray-900">{orderItem?.product?.name || item.productId}</p>
                                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500">
                                        {orderItem?.product?.ean && <span>EAN {orderItem.product.ean}</span>}
                                        {item.finalWeight && <span>Peso: {formatQuantity(item.finalWeight)}</span>}
                                        {item.barcode && <span>Cód. lido: {item.barcode}</span>}
                                      </div>
                                      {item.notes && <p className="mt-0.5 text-xs text-gray-500">{item.notes}</p>}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-gray-700">
                                      {formatQuantity(item.requestedQuantity)} / {formatQuantity(item.pickedQuantity)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={`rounded-full px-2 py-1 text-[11px] font-bold ${itemStatusClassName(item.status)}`}>
                                        {ITEM_STATUS_LABELS[item.status] || item.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1.5">
                                        <Button
                                          type="button"
                                          onClick={() => openItemAction(task, item, 'pick')}
                                          disabled={taskActionDisabled(`pick-${item.id}`) || !['PENDING', 'MISSING'].includes(item.status)}
                                          variant="outline"
                                          title="Separar"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 p-0 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                                        >
                                          <ScanLine size={14} />
                                        </Button>
                                        <Button
                                          type="button"
                                          onClick={() => openItemAction(task, item, 'missing')}
                                          disabled={taskActionDisabled(`missing-${item.id}`) || item.status !== 'PENDING'}
                                          variant="outline"
                                          title="Falta"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 p-0 text-red-800 hover:bg-red-100 disabled:opacity-60"
                                        >
                                          <AlertTriangle size={14} />
                                        </Button>
                                        <Button
                                          type="button"
                                          onClick={() => openItemAction(task, item, 'substitute')}
                                          disabled={taskActionDisabled(`substitute-${item.id}`) || !['PENDING', 'MISSING'].includes(item.status)}
                                          variant="outline"
                                          title="Substituir"
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 p-0 text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                                        >
                                          <Replace size={14} />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>

                                  {draftOpen && (
                                    <TableRow key={`${item.id}-draft`} className="hover:bg-transparent">
                                      <TableCell colSpan={5} className="bg-[#FFFBF3] p-0">
                                        <div className="border-t border-[#D2BB8A]/50 p-3">
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

                                          <div className="mt-3 grid grid-cols-2 gap-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col">
                                            <Button
                                              type="button"
                                              onClick={() => setItemActionDraft(null)}
                                              variant="outline"
                                              className="min-h-10 rounded-xl border border-[#D2BB8A] bg-white px-4 py-2 text-sm font-bold text-[#5d082a]"
                                            >
                                              Cancelar
                                            </Button>
                                            <Button
                                              type="button"
                                              onClick={submitItemAction}
                                              disabled={Boolean(busyKey)}
                                              className="min-h-10 rounded-xl bg-[#5d082a] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                                            >
                                              Confirmar
                                            </Button>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
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
                  {taskActionDraft.mode === 'finish' && 'Enviar para conferência'}
                  {taskActionDraft.mode === 'conference' && 'Registrar conferência'}
                  {taskActionDraft.mode === 'packing' && 'Finalizar embalagem'}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{orderLabel(taskActionDraft.task.order)}</p>
              </div>
            </div>

            <label htmlFor="picking-task-action-value" className="mt-5 block space-y-1.5 text-xs font-bold uppercase tracking-wider text-[#9e7080]">
              {taskActionDraft.mode === 'assign' && 'ID do separador'}
              {taskActionDraft.mode === 'finish' && 'Observacao final da separação'}
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
