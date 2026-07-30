import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, LogOut, MapPin, Clock, ChevronRight, Inbox } from 'lucide-react'
import { driverApi, DeliveryRoute } from '../services/api'
import toast from 'react-hot-toast'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Rota',
  COMPLETED: 'Concluida',
  CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

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

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await driverApi.listRoutes()
      setRoutes(data)
    } catch {
      toast.error('Erro ao carregar rotas')
    } finally {
      setLoading(false)
    }
  }, [])

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

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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
