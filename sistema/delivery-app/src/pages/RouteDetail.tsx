import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Phone, Loader2, Navigation, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { driverApi, DeliveryRoute, DeliveryStop } from '../services/api'
import toast from 'react-hot-toast'

const STOP_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  OUT_FOR_DELIVERY: 'A caminho',
  ARRIVED: 'No local',
  DELIVERED: 'Entregue',
  FAILED: 'Nao entregue',
}

const STOP_STATUS_COLOR: Record<string, string> = {
  PENDING: 'border-gray-200 bg-white',
  OUT_FOR_DELIVERY: 'border-blue-200 bg-blue-50',
  ARRIVED: 'border-amber-200 bg-amber-50',
  DELIVERED: 'border-green-200 bg-green-50',
  FAILED: 'border-red-200 bg-red-50',
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartao Credito',
  DEBIT_CARD: 'Cartao Debito',
}

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['ARRIVED'],
  ARRIVED: ['DELIVERED', 'FAILED'],
}

const STATUS_ACTION_LABEL: Record<string, string> = {
  OUT_FOR_DELIVERY: 'Saindo',
  ARRIVED: 'Cheguei',
  DELIVERED: 'Entregue',
  FAILED: 'Nao Entregue',
}

const STATUS_ACTION_COLOR: Record<string, string> = {
  OUT_FOR_DELIVERY: 'bg-blue-600',
  ARRIVED: 'bg-amber-600',
  DELIVERED: 'bg-green-600',
  FAILED: 'bg-red-600',
}

export default function RouteDetail({ routeId, onBack }: { routeId: string; onBack: () => void }) {
  const [route, setRoute] = useState<DeliveryRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [failModal, setFailModal] = useState<{ stopId: string; status: 'FAILED' | 'DELIVERED'; notes: string } | null>(null)

  const fetchRoute = useCallback(async () => {
    try {
      const { data } = await driverApi.getRoute(routeId)
      setRoute(data)
    } catch {
      toast.error('Erro ao carregar rota')
    } finally {
      setLoading(false)
    }
  }, [routeId])

  useEffect(() => { fetchRoute() }, [fetchRoute])

  const handleStartRoute = async () => {
    if (!route) return
    setActionLoading(true)
    try {
      const { data } = await driverApi.startRoute(route.id)
      setRoute(data)
      toast.success('Rota iniciada')
    } catch {
      toast.error('Erro ao iniciar rota')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteRoute = async () => {
    if (!route) return
    setActionLoading(true)
    try {
      const { data } = await driverApi.completeRoute(route.id)
      setRoute(data)
      toast.success('Rota concluida')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao concluir')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateStop = async (stopId: string, status: string, notes?: string) => {
    if (!route) return
    setActionLoading(true)
    try {
      await driverApi.updateStopStatus(route.id, stopId, status, notes)
      await fetchRoute()
      toast.success(STATUS_ACTION_LABEL[status] || 'Atualizado')
      setFailModal(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro')
    } finally {
      setActionLoading(false)
    }
  }

  const openMaps = (stop: DeliveryStop) => {
    const addr = stop.order?.addressSnapshot
    if (!addr) return
    const q = [addr.street, addr.number, addr.neighborhood, addr.city].filter(Boolean).join(', ')
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    )
  }

  if (!route) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Rota nao encontrada</p>
        <button onClick={onBack} className="text-brand-500 font-medium">Voltar</button>
      </div>
    )
  }

  const pending = route.stops.filter((s) => !['DELIVERED', 'FAILED'].includes(s.status))
  const done = route.stops.filter((s) => ['DELIVERED', 'FAILED'].includes(s.status))
  const canStart = route.status === 'PENDING'
  const canComplete = route.status === 'IN_PROGRESS' && pending.length === 0
  const isFinished = ['COMPLETED', 'CANCELLED'].includes(route.status)

  return (
    <div className="flex flex-col h-full">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Rota de Entrega</p>
            <p className="text-xs text-white/60">{pending.length} pendente(s) de {route.stops.length}</p>
          </div>
        </div>
      </header>

      {!isFinished && (
        <div className="px-4 py-2 bg-white border-b flex gap-2">
          {canStart && (
            <button
              onClick={handleStartRoute}
              disabled={actionLoading}
              className="flex-1 h-11 rounded-xl bg-brand-500 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Iniciar Rota'}
            </button>
          )}
          {canComplete && (
            <button
              onClick={handleCompleteRoute}
              disabled={actionLoading}
              className="flex-1 h-11 rounded-xl bg-green-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Concluir Rota'}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {route.stops.map((stop) => {
          const addr = stop.order?.addressSnapshot
          const customer = stop.order?.customer
          const nextStatuses = NEXT_STATUSES[stop.status] || []
          const isFinal = ['DELIVERED', 'FAILED'].includes(stop.status)

          return (
            <div key={stop.id} className={`rounded-xl border p-4 ${STOP_STATUS_COLOR[stop.status] || 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {stop.sequence}
                    </span>
                    <span className="font-semibold text-gray-900 truncate">{customer?.name || 'Cliente'}</span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                  {isFinal ? (
                    stop.status === 'DELIVERED' ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-600" />
                  ) : (
                    <Clock size={14} />
                  )}
                  {STOP_STATUS_LABEL[stop.status]}
                </span>
              </div>

              {addr && (
                <p className="text-sm text-gray-600 mb-1">
                  {[addr.street, addr.number].filter(Boolean).join(', ')}
                  {addr.complement && ` - ${addr.complement}`}
                  {addr.neighborhood && ` — ${addr.neighborhood}`}
                </p>
              )}
              {addr?.reference && <p className="text-xs text-gray-400 mb-2">Ref: {addr.reference}</p>}

              {stop.order?.notes && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-2">
                  {stop.order.notes}
                </p>
              )}
              {(stop.order as any)?.deliveryInstructions && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mb-2">
                  <strong>Instrucoes:</strong> {(stop.order as any).deliveryInstructions}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <span>R$ {stop.order?.total?.toFixed(2) || '0.00'}</span>
                <span>•</span>
                <span>{PAYMENT_LABEL[stop.order?.paymentMethod || ''] || stop.order?.paymentMethod || 'N/A'}</span>
              </div>

              <div className="flex gap-2">
                {customer?.whatsapp && (
                  <a
                    href={`https://wa.me/55${customer.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <Phone size={14} />
                    WhatsApp
                  </a>
                )}
                {addr && (
                  <button
                    onClick={() => openMaps(stop)}
                    className="h-10 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <Navigation size={14} />
                    Mapa
                  </button>
                )}
                {!isFinished && nextStatuses.map((ns) => (
                  <button
                    key={ns}
                    onClick={() => (ns === 'FAILED' || ns === 'DELIVERED') ? setFailModal({ stopId: stop.id, status: ns, notes: '' }) : handleUpdateStop(stop.id, ns)}
                    disabled={actionLoading}
                    className={`h-10 px-4 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-60 ${STATUS_ACTION_COLOR[ns] || 'bg-gray-600'}`}
                  >
                    {STATUS_ACTION_LABEL[ns]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        {done.length > 0 && pending.length > 0 && (
          <p className="text-xs text-gray-400 text-center pt-2">
            {done.length} de {route.stops.length} concluida(s)
          </p>
        )}
      </div>

      {failModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setFailModal(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {failModal.status === 'DELIVERED' ? 'Como foi a entrega?' : 'Motivo da nao entrega'}
            </h2>
            <textarea
              placeholder={failModal.status === 'DELIVERED' ? 'Ex: entregue ao proprio cliente na portaria' : 'Ex: cliente ausente, endereco nao encontrado'}
              value={failModal.notes}
              onChange={(e) => setFailModal((s) => s ? { ...s, notes: e.target.value } : s)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-brand-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setFailModal(null)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStop(failModal.stopId, failModal.status, failModal.notes)}
                disabled={!failModal.notes.trim() || actionLoading}
                className={`flex-1 h-12 rounded-xl text-white font-semibold disabled:opacity-40 ${failModal.status === 'DELIVERED' ? 'bg-green-600' : 'bg-red-600'}`}
              >
                {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
