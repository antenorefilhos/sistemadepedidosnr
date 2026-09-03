import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, LogOut, MapPin, Clock, ChevronRight, Inbox, Hand, Package } from 'lucide-react'
import { AvisoPush } from '../components/AvisoPush'
import { driverApi, DeliveryRoute, AvailableDelivery } from '../services/api'
import toast from 'react-hot-toast'

// Valores reais do backend (schema.prisma: default PLANNED; delivery.service:
// OUT_FOR_DELIVERY ao liberar). Estava PENDING/IN_PROGRESS aqui, que o backend
// nunca produz -- toda rota aparecia com o status cru no lugar do rotulo.
const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Montando',
  READY: 'Pronta',
  OUT_FOR_DELIVERY: 'Em Rota',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  PLANNED: 'bg-amber-100 text-amber-800',
  READY: 'bg-sky-100 text-sky-800',
  OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const enderecoCurto = (a?: AvailableDelivery['addressSnapshot']) =>
  !a ? 'Endereço não informado' : [a.street, a.number, a.neighborhood].filter(Boolean).join(', ')

export default function RouteList({
  userName,
  onSelectRoute,
  onLogout,
}: {
  userName: string
  onSelectRoute: (id: string) => void
  onLogout: () => void
}) {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [fila, setFila] = useState<AvailableDelivery[]>([])
  const [pegando, setPegando] = useState<string | null>(null)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      // Fila e rotas juntas: a fila e compartilhada, entao ela muda por acao de
      // outro entregador tambem -- recarregar so as rotas deixaria a tela
      // mostrando pedido que ja tem dono.
      const [rotas, disponiveis] = await Promise.all([
        driverApi.listRoutes(),
        driverApi.listAvailable(),
      ])
      setRoutes(rotas.data)
      setFila(disponiveis.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  const pegar = async (orderId: string) => {
    setPegando(orderId)
    try {
      await driverApi.takeDelivery(orderId)
      toast.success('Entrega adicionada à sua rota')
      await fetchRoutes()
    } catch (err: any) {
      // O caso comum aqui e "outro entregador ja pegou" -- mensagem do backend,
      // que e especifica. Recarrega pra sumir com o item da lista.
      toast.error(err?.response?.data?.message || 'Não foi possível pegar')
      await fetchRoutes()
    } finally {
      setPegando(null)
    }
  }

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  const activeRoutes = routes.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status))
  const doneRoutes = routes.filter((r) => ['COMPLETED', 'CANCELLED'].includes(r.status))

  return (
    <div className="flex flex-col h-full">
      <header className="bg-brand-600 text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-white/60 text-xs">Motorista</p>
            <p className="font-semibold truncate">{userName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRoutes} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <AvisoPush />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Fila compartilhada: todo entregador ve a mesma lista e quem tocar
            primeiro leva. O backend serializa com FOR UPDATE, entao o segundo
            recebe "ja foi pego" em vez de uma entrega duplicada. */}
        {fila.length > 0 && (
          <section className="mb-3">
            <h2 className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              Disponíveis para pegar ({fila.length})
            </h2>
            <div className="space-y-2">
              {fila.map((pedido) => (
                <div key={pedido.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-start gap-2">
                    <Package size={16} className="mt-0.5 shrink-0 text-amber-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-800">
                        {pedido.customer?.name ?? 'Cliente'}
                      </p>
                      <p className="truncate text-sm text-gray-600">{enderecoCurto(pedido.addressSnapshot)}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {pedido._count?.items ?? 0} item(ns) · R$ {Number(pedido.total).toFixed(2)}
                      </p>
                      {pedido.deliveryInstructions && (
                        <p className="mt-1 text-xs italic text-gray-500">{pedido.deliveryInstructions}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => pegar(pedido.id)}
                    disabled={pegando === pedido.id}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white active:bg-brand-700 disabled:opacity-60"
                  >
                    <Hand size={16} />
                    {pegando === pedido.id ? 'Pegando...' : 'Pegar esta entrega'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {loading && routes.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw size={24} className="animate-spin" />
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Inbox size={32} />
            <p className="text-sm">Nenhuma rota atribuida</p>
          </div>
        ) : (
          <>
            {activeRoutes.map((route) => (
              <RouteCard key={route.id} route={route} onTap={() => onSelectRoute(route.id)} />
            ))}
            {doneRoutes.length > 0 && (
              <>
                <p className="text-xs text-gray-400 uppercase tracking-wide pt-3 pb-1">Concluidas</p>
                {doneRoutes.slice(0, 10).map((route) => (
                  <RouteCard key={route.id} route={route} onTap={() => onSelectRoute(route.id)} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RouteCard({ route, onTap }: { route: DeliveryRoute; onTap: () => void }) {
  const delivered = route.stops.filter((s) => s.status === 'DELIVERED').length
  const total = route.stops.length

  return (
    <button
      onClick={onTap}
      className="w-full bg-white rounded-xl p-4 text-left active:scale-[0.99] transition-transform shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{total} parada{total !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {delivered}/{total} entregues
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {new Date(route.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[route.status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[route.status] || route.status}
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>
    </button>
  )
}
