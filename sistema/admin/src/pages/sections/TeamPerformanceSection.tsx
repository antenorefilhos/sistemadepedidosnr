import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Replace, Truck, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getApiErrorMessage,
  pickingAPI,
  fulfillmentAPI,
  ordersAPI,
  staffAPI,
  type PickingPerformanceResponse,
  type DriverPerformanceResponse,
  type SubstitutionEvent,
  type StaffMember,
} from '../../services/api'
import { SectionEmptyState, SectionMetric, SectionPanel, SectionToolbar } from './SectionChrome'

function formatMinutes(seconds: number) {
  if (!seconds) return '—'
  const minutes = Math.round(seconds / 60)
  return `${minutes} min`
}

export default function TeamPerformanceSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<PickingPerformanceResponse | null>(null)
  const [drivers, setDrivers] = useState<DriverPerformanceResponse | null>(null)
  const [substitutions, setSubstitutions] = useState<SubstitutionEvent[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pickingRes, driversRes, substitutionsRes, staffRes] = await Promise.all([
        pickingAPI.getPerformance(),
        fulfillmentAPI.getDriverPerformance(),
        ordersAPI.listSubstitutions({ limit: 50 }),
        staffAPI.list(),
      ])
      setPicking(pickingRes.data)
      setDrivers(driversRes.data)
      setSubstitutions(substitutionsRes.data)
      setStaff(staffRes.data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const staffNameById = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  const pickers = useMemo(
    () => (picking?.pickers || []).filter((p) => p.pickerId !== 'unassigned').sort((a, b) => b.itemsPerMinute - a.itemsPerMinute),
    [picking],
  )
  const driverList = useMemo(
    () => (drivers?.drivers || []).filter((d) => d.driverId !== 'unassigned').sort((a, b) => b.stopsDelivered - a.stopsDelivered),
    [drivers],
  )

  return (
    <div className="space-y-6">
      <SectionToolbar className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#5d082a]">Desempenho da Equipe</h2>
          <p className="text-sm text-gray-500">Separação, entrega e substituições dos últimos 7 dias.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </SectionToolbar>

      {error && (
        <SectionPanel bodyClassName="p-4">
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </SectionPanel>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionMetric label="Tarefas de separação" value={picking?.totals.tasks ?? '—'} tone="brand" />
        <SectionMetric label="Rotas de entrega" value={drivers?.totals.routes ?? '—'} tone="brand" />
        <SectionMetric label="Substituições (30d)" value={substitutions.length} tone="neutral" />
      </div>

      <SectionPanel bodyClassName="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[#5d082a]" />
          <h3 className="text-base font-bold text-[#5d082a]">Separadores</h3>
        </div>
        {pickers.length === 0 ? (
          <SectionEmptyState title="Sem dados de separação no período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2">Separador</th>
                  <th className="pb-2">Tarefas concluídas</th>
                  <th className="pb-2">Itens/min</th>
                  <th className="pb-2">Faltantes</th>
                  <th className="pb-2">Substituições</th>
                  <th className="pb-2">Atraso médio p/ iniciar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pickers.map((p) => (
                  <tr key={p.pickerId}>
                    <td className="py-2 font-semibold text-[#5d082a]">{staffNameById.get(p.pickerId) || p.pickerId}</td>
                    <td className="py-2">{p.tasksCompleted}</td>
                    <td className="py-2">{p.itemsPerMinute}</td>
                    <td className="py-2">{p.itemsMissing}</td>
                    <td className="py-2">{p.substitutions}</td>
                    <td className="py-2">{formatMinutes(p.avgStartDelaySeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel bodyClassName="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-[#5d082a]" />
          <h3 className="text-base font-bold text-[#5d082a]">Entregadores</h3>
        </div>
        {driverList.length === 0 ? (
          <SectionEmptyState title="Sem dados de entrega no período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2">Entregador</th>
                  <th className="pb-2">Rotas concluídas</th>
                  <th className="pb-2">Paradas entregues</th>
                  <th className="pb-2">Falhas</th>
                  <th className="pb-2">Tempo médio de rota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {driverList.map((d) => (
                  <tr key={d.driverId}>
                    <td className="py-2 font-semibold text-[#5d082a]">{d.driverName}</td>
                    <td className="py-2">{d.routesCompleted}</td>
                    <td className="py-2">{d.stopsDelivered}</td>
                    <td className="py-2">{d.stopsFailed}</td>
                    <td className="py-2">{d.avgDeliveryMinutes ? `${d.avgDeliveryMinutes} min` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      <SectionPanel bodyClassName="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Replace className="h-5 w-5 text-[#5d082a]" />
          <h3 className="text-base font-bold text-[#5d082a]">Substituições recentes</h3>
        </div>
        {substitutions.length === 0 ? (
          <SectionEmptyState title="Nenhuma substituição registrada no período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="pb-2">Quando</th>
                  <th className="pb-2">Quem trocou</th>
                  <th className="pb-2">Produto original</th>
                  <th className="pb-2">Substituto</th>
                  <th className="pb-2">Pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {substitutions.map((event) => (
                  <tr key={event.id}>
                    <td className="py-2 text-gray-500">{new Date(event.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="py-2 font-semibold text-[#5d082a]">
                      {event.actorName || (event.actorType === 'PICKER' ? 'Separador' : event.actorType)}
                    </td>
                    <td className="py-2">{String(event.payload.sourceProductName || '—')}</td>
                    <td className="py-2">{String(event.payload.substituteProductName || '—')}</td>
                    <td className="py-2 font-mono text-xs text-gray-400">{event.orderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  )
}
