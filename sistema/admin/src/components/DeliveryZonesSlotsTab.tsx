import { Plus, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatWindow, slotLabel } from '../utils/deliveryZonesHelpers'
import type { FulfillmentSlotOccupancy } from '../services/api'

/** Aba "Janelas" de DeliveryZones -- extraida (JON-65, Auditoria 360) por so
 * depender de props/callbacks, sem estado ou efeito proprio. */
export function DeliveryZonesSlotsTab({
  onNewSlot, createPending, slotsFilter, onSlotsFilterChange,
  slotSummary, slotsLoading, filteredSlots, paginatedSlots,
  slotsPage, slotsPageCount, onSlotsPageChange,
}: {
  onNewSlot: () => void;
  createPending: boolean;
  slotsFilter: 'ALL' | 'DELIVERY' | 'PICKUP';
  onSlotsFilterChange: (value: 'ALL' | 'DELIVERY' | 'PICKUP') => void;
  slotSummary: { active: number; reserved: number; capacity: number; full: number };
  slotsLoading: boolean;
  filteredSlots: FulfillmentSlotOccupancy[];
  paginatedSlots: FulfillmentSlotOccupancy[];
  slotsPage: number;
  slotsPageCount: number;
  onSlotsPageChange: (updater: (p: number) => number) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button type="button" onClick={onNewSlot} disabled={createPending}>
          <Plus size={16} />
          Nova janela
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Label className="text-xs text-gray-500">Filtrar:</Label>
          <Select value={slotsFilter} onChange={(e) => onSlotsFilterChange(e.target.value as any)} className="w-40">
            <option value="ALL">Todos</option>
            <option value="DELIVERY">Entrega</option>
            <option value="PICKUP">Retirada</option>
          </Select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[11px] uppercase text-gray-400 font-bold">Ativas</p>
            <p className="text-xl font-bold text-gray-800">{slotSummary.active}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[11px] uppercase text-gray-400 font-bold">Reservadas</p>
            <p className="text-xl font-bold text-gray-800">{slotSummary.reserved}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[11px] uppercase text-gray-400 font-bold">Capacidade</p>
            <p className="text-xl font-bold text-gray-800">{slotSummary.capacity}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[11px] uppercase text-gray-400 font-bold">Lotadas</p>
            <p className="text-xl font-bold text-gray-800">{slotSummary.full}</p>
          </div>
        </div>
      </div>

      {slotsLoading ? (
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      ) : filteredSlots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarClock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma janela {slotsFilter === 'ALL' ? '' : slotsFilter === 'DELIVERY' ? 'de entrega' : 'de retirada'}.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedSlots.map((slot) => (
              <div key={slot.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {slotLabel(slot)} · {formatWindow(slot.startsAt)} - {formatWindow(slot.endsAt)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {slot.reservedOrders}/{slot.capacityOrders} pedidos
                    {slot.capacityItems != null && ` · ${slot.reservedItems}/${slot.capacityItems} itens`}
                    {slot.cutoffExpired && ' · cutoff encerrado'}
                  </p>
                </div>
                <div className="w-full sm:w-36">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full ${slot.isFull ? 'bg-red-500' : 'bg-[#5D082A]'}`} style={{ width: `${Math.min(100, slot.occupancyPercent)}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-gray-400">{slot.occupancyPercent}%</p>
                </div>
              </div>
            ))}
          </div>

          {slotsPageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button type="button" variant="ghost" size="icon" onClick={() => onSlotsPageChange((p) => Math.max(1, p - 1))} disabled={slotsPage === 1}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm text-gray-600">Pagina {slotsPage} de {slotsPageCount}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => onSlotsPageChange((p) => Math.min(slotsPageCount, p + 1))} disabled={slotsPage === slotsPageCount}>
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
