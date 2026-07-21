import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { brandAPI, deliveryAPI, fulfillmentAPI, getApiErrorMessage, type DeliveryZone, type DeliveryZonePayload, type FulfillmentSlotOccupancy } from '../services/api'
import { Truck, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Save, X, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

const EMPTY_FORM: DeliveryZonePayload = {
  name: '',
  type: 'CEP_RANGE',
  cepStart: '',
  cepEnd: '',
  polygonGeoJSON: null,
  fee: 0,
  freeAbove: null,
  active: true,
  priority: 0,
}

const EMPTY_SLOT_FORM = {
  type: 'DELIVERY' as 'DELIVERY' | 'PICKUP',
  startsAt: '',
  endsAt: '',
  capacityOrders: 10,
  capacityItems: '',
  cutoffMinutes: 30,
}

const DEFAULT_CENTER: [number, number] = [-22.313628, -43.130604]
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, USGS, OpenStreetMap contributors'

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function formatFee(value: number) {
  return value === 0
    ? 'Gratis'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatWindow(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function slotLabel(slot: FulfillmentSlotOccupancy) {
  return slot.type === 'PICKUP' ? 'Retirada' : 'Entrega'
}

function parsePolygonGeoJSON(raw: string | null | undefined): Array<[number, number]> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const coords = parsed?.type === 'Feature'
      ? parsed?.geometry?.coordinates
      : parsed?.type === 'Polygon'
      ? parsed?.coordinates
      : null
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) return []
    return coords[0].map((pair: number[]) => [pair[1], pair[0]])
  } catch {
    return []
  }
}

export default function DeliveryZones() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null)
  const [form, setForm] = useState<DeliveryZonePayload>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: async () => (await deliveryAPI.listZones()).data,
  })

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['fulfillment-slots-occupancy'],
    queryFn: async () => (await fulfillmentAPI.listSlots()).data,
  })

  useQuery({
    queryKey: ['brand-config-delivery'],
    queryFn: async () => {
      const res = await brandAPI.get()
      const value = (res.data as { freeShippingThreshold?: number | null }).freeShippingThreshold ?? null
      setFreeShippingThreshold(value)
      return res.data
    },
  })

  const createMut = useMutation({
    mutationFn: (data: DeliveryZonePayload) => deliveryAPI.createZone(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      reset()
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeliveryZonePayload> }) => deliveryAPI.updateZone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      reset()
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const updateThresholdMut = useMutation({
    mutationFn: (value: number | null) => brandAPI.update({ freeShippingThreshold: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-config'] })
      qc.invalidateQueries({ queryKey: ['brand-config-delivery'] })
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deliveryAPI.deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      setDeleteTarget(null)
    },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => deliveryAPI.updateZone(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-zones'] }),
  })

  const createSlotMut = useMutation({
    mutationFn: (data: { type: 'DELIVERY' | 'PICKUP'; startsAt: string; endsAt: string; capacityOrders: number; capacityItems?: number | null; cutoffMinutes?: number }) =>
      fulfillmentAPI.createSlot(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fulfillment-slots-occupancy'] })
      setShowSlotForm(false)
      setSlotForm(EMPTY_SLOT_FORM)
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const reset = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const openNew = () => {
    setEditing('new')
    setForm(EMPTY_FORM)
    setError(null)
  }

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone.id)
    setForm({
      name: zone.name,
      type: zone.type,
      cepStart: zone.cepStart ?? '',
      cepEnd: zone.cepEnd ?? '',
      polygonGeoJSON: zone.polygonGeoJSON ?? null,
      fee: zone.fee,
      freeAbove: zone.freeAbove,
      active: zone.active,
      priority: zone.priority,
    })
    setError(null)
  }

  const handleSave = () => {
    const feeValue = Number(form.fee)
    const rawFreeAbove = form.freeAbove as number | string | null | undefined
    const freeAboveValue =
      rawFreeAbove === null || rawFreeAbove === undefined || rawFreeAbove === ''
        ? null
        : Number(rawFreeAbove)
    const priorityValue = Number(form.priority ?? 0)

    if (!form.name?.trim()) {
      setError('Nome obrigatorio')
      return
    }
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      setError('Taxa nao pode ser negativa')
      return
    }
    if (freeAboveValue !== null && (!Number.isFinite(freeAboveValue) || freeAboveValue < 0)) {
      setError('Frete gratis acima deve ser um numero maior ou igual a zero')
      return
    }
    if (form.type === 'CEP_RANGE' && (!form.cepStart || !form.cepEnd)) {
      setError('Para zona por CEP, informe CEP inicial e final')
      return
    }
    if (form.type === 'GEO_POLYGON' && !form.polygonGeoJSON) {
      setError('Para zona geografica, desenhe um poligono no mapa')
      return
    }

    const payload: DeliveryZonePayload = {
      name: form.name.trim(),
      type: form.type,
      cepStart: form.type === 'CEP_RANGE' ? (form.cepStart || undefined) : undefined,
      cepEnd: form.type === 'CEP_RANGE' ? (form.cepEnd || undefined) : undefined,
      polygonGeoJSON: form.type === 'GEO_POLYGON' ? (form.polygonGeoJSON || null) : null,
      fee: feeValue,
      freeAbove: freeAboveValue,
      active: form.active ?? true,
      priority: priorityValue,
    }

    if (editing === 'new') {
      createMut.mutate(payload)
    } else if (editing) {
      updateMut.mutate({ id: editing, data: payload })
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending

  const slotSummary = useMemo(() => {
    const active = slots.filter((slot) => slot.status === 'ACTIVE')
    const capacity = active.reduce((sum, slot) => sum + slot.capacityOrders, 0)
    const reserved = active.reduce((sum, slot) => sum + slot.reservedOrders, 0)
    const full = active.filter((slot) => slot.isFull).length
    return { active: active.length, capacity, reserved, full }
  }, [slots])

  const openSlotForm = () => {
    const now = Date.now()
    setSlotForm({
      ...EMPTY_SLOT_FORM,
      startsAt: new Date(now + 60 * 60 * 1000).toISOString().slice(0, 16),
      endsAt: new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
    })
    setShowSlotForm(true)
  }

  const handleCreateSlot = () => {
    const capacityOrders = Number(slotForm.capacityOrders)
    const capacityItems = slotForm.capacityItems ? Number(slotForm.capacityItems) : null
    const cutoffMinutes = Number(slotForm.cutoffMinutes)
    if (!slotForm.startsAt || !slotForm.endsAt) {
      setError('Informe inicio e fim da janela')
      return
    }
    if (!Number.isFinite(capacityOrders) || capacityOrders <= 0) {
      setError('Capacidade de pedidos deve ser maior que zero')
      return
    }
    createSlotMut.mutate({
      type: slotForm.type,
      startsAt: new Date(slotForm.startsAt).toISOString(),
      endsAt: new Date(slotForm.endsAt).toISOString(),
      capacityOrders,
      capacityItems: Number.isFinite(Number(capacityItems)) && Number(capacityItems) > 0 ? Number(capacityItems) : null,
      cutoffMinutes: Number.isFinite(cutoffMinutes) && cutoffMinutes > 0 ? cutoffMinutes : 0,
    })
  }

  const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  useEffect(() => {
    const shouldShowMap = editing !== null && form.type === 'GEO_POLYGON'
    if (!shouldShowMap) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        drawnItemsRef.current = null
      }
      return
    }

    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, 12)
    mapRef.current = map

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    drawnItemsRef.current = drawnItems
    map.addLayer(drawnItems)

    const DrawControl = (L.Control as any)?.Draw
    const DrawEvent = (L as any)?.Draw?.Event
    if (!DrawControl || !DrawEvent) {
      setError('Falha ao carregar editor de poligono no mapa. Recarregue a pagina.')
      return
    }

    const eventNames = {
      CREATED: DrawEvent.CREATED,
      EDITED: DrawEvent.EDITED,
      DELETED: DrawEvent.DELETED,
    }

    const drawControl = new DrawControl({
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })
    map.addControl(drawControl)

    const onCreated = (e: any) => {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      setForm((p) => ({ ...p, polygonGeoJSON: JSON.stringify(e.layer.toGeoJSON()) }))
    }
    const onEdited = (e: any) => {
      let edited: any = null
      e.layers.eachLayer((layer: any) => {
        edited = layer.toGeoJSON()
      })
      setForm((p) => ({ ...p, polygonGeoJSON: edited ? JSON.stringify(edited) : p.polygonGeoJSON }))
    }
    const onDeleted = () => setForm((p) => ({ ...p, polygonGeoJSON: null }))

    map.on(eventNames.CREATED, onCreated)
    map.on(eventNames.EDITED, onEdited)
    map.on(eventNames.DELETED, onDeleted)

    return () => {
      map.off(eventNames.CREATED, onCreated)
      map.off(eventNames.EDITED, onEdited)
      map.off(eventNames.DELETED, onDeleted)
      map.remove()
      mapRef.current = null
      drawnItemsRef.current = null
    }
  }, [editing, form.type])

  const polygonPreview = useMemo(() => parsePolygonGeoJSON(form.polygonGeoJSON), [form.polygonGeoJSON])

  useEffect(() => {
    if (!drawnItemsRef.current) return
    const drawnItems = drawnItemsRef.current
    drawnItems.clearLayers()
    if (polygonPreview.length > 2) {
      drawnItems.addLayer(L.polygon(polygonPreview))
      if (mapRef.current) {
        mapRef.current.fitBounds(L.polygon(polygonPreview).getBounds(), { padding: [10, 10] })
      }
    }
  }, [polygonPreview])

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Truck className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Zonas de Entrega</h1>
        <Button
          type="button"
          variant="outline"
          onClick={openSlotForm}
          disabled={createSlotMut.isPending}
          className="sm:ml-auto"
        >
          <CalendarClock size={16} />
          Nova janela
        </Button>
        <Button
          type="button"
          onClick={openNew}
          disabled={editing !== null}
        >
          <Plus size={16} />
          Nova zona
        </Button>
      </div>

      {error && editing === null && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={18} className="text-[#5D082A]" />
          <p className="text-sm font-semibold text-gray-700">Ocupacao de janelas</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
        {slotsLoading ? (
          <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma janela cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {slots.slice(0, 8).map((slot) => (
              <div key={slot.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
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
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-2">Frete grátis global (regra do carrinho)</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={freeShippingThreshold ?? ''}
            onChange={(e) => setFreeShippingThreshold(e.target.value ? Number(e.target.value) : null)}
            onFocus={handleNumberFocus}
            className="w-56"
            placeholder="Ex: 150,00"
          />
          <Button
            type="button"
            onClick={() => updateThresholdMut.mutate(freeShippingThreshold)}
            disabled={updateThresholdMut.isPending}
          >
            {updateThresholdMut.isPending ? 'Salvando...' : 'Salvar valor minimo'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Deixe em branco para desativar. Essa regra convive com as regras por zona (CEP/poligono).
        </p>
      </div>

      {editing !== null && (
        <div className="bg-white border border-[#D2BB8A] rounded-lg p-5 mb-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-700 mb-4">{editing === 'new' ? 'Nova zona de entrega' : 'Editar zona'}</h2>

          {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs text-gray-600">Nome *</Label>
              <Input
                type="text"
                value={form.name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Tipo de zona</Label>
              <Select
                value={form.type ?? 'CEP_RANGE'}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    type: e.target.value as 'CEP_RANGE' | 'GEO_POLYGON',
                    cepStart: e.target.value === 'GEO_POLYGON' ? '' : p.cepStart,
                    cepEnd: e.target.value === 'GEO_POLYGON' ? '' : p.cepEnd,
                    polygonGeoJSON: e.target.value === 'CEP_RANGE' ? null : p.polygonGeoJSON,
                  }))
                }
              >
                <option value="CEP_RANGE">Faixa de CEP</option>
                <option value="GEO_POLYGON">Poligono geografico</option>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Prioridade</Label>
              <Input
                type="number"
                min="0"
                value={form.priority ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                onFocus={handleNumberFocus}
              />
            </div>

            {form.type === 'CEP_RANGE' && (
              <>
                <div>
                  <Label className="mb-1 block text-xs text-gray-600">CEP inicial</Label>
                  <Input
                    type="text"
                    value={form.cepStart ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, cepStart: maskCep(e.target.value) }))}
                    placeholder="00000-000"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-gray-600">CEP final</Label>
                  <Input
                    type="text"
                    value={form.cepEnd ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, cepEnd: maskCep(e.target.value) }))}
                    placeholder="99999-999"
                    className="font-mono"
                  />
                </div>
              </>
            )}

            {form.type === 'GEO_POLYGON' && (
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-xs text-gray-600">Poligono no mapa</Label>
                <div ref={mapContainerRef} className="h-72 rounded-lg overflow-hidden border border-gray-300" />
                <p className="text-xs text-gray-400 mt-1">Desenhe um poligono cobrindo a area de entrega.</p>
              </div>
            )}

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Taxa de entrega (R$) *</Label>
              <Input
                type="number"
                step="0.50"
                min="0"
                value={form.fee ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, fee: Number(e.target.value) }))}
                onFocus={handleNumberFocus}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-gray-600">Frete gratis acima de (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.freeAbove ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, freeAbove: e.target.value ? Number(e.target.value) : null }))}
                onFocus={handleNumberFocus}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="delivery-zone-active"
                checked={form.active ?? true}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              />
              <Label htmlFor="delivery-zone-active" className="text-sm font-normal text-gray-700">
                Zona ativa
              </Label>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={15} />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={reset}
            >
              <X size={15} />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma zona cadastrada.</p>
          <p className="text-xs mt-1">Crie uma zona para calcular o frete automaticamente no checkout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`bg-white border rounded-lg px-5 py-4 flex items-start gap-4 shadow-sm transition-opacity ${zone.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{zone.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {zone.type === 'GEO_POLYGON' ? 'Poligono' : 'CEP'}
                  </Badge>
                  {!zone.active && <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Inativa</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {zone.type === 'CEP_RANGE'
                    ? zone.cepStart && zone.cepEnd
                      ? `CEP ${zone.cepStart} - ${zone.cepEnd}`
                      : 'Faixa de CEP nao definida'
                    : zone.polygonGeoJSON
                    ? 'Zona geografica desenhada no mapa'
                    : 'Poligono nao definido'}
                  {' · '}
                  <span className="font-semibold text-[#5D082A]">{formatFee(zone.fee)}</span>
                  {zone.freeAbove != null && <span className="text-gray-400 ml-1">(gratis acima de {Number(zone.freeAbove).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMut.mutate({ id: zone.id, active: !zone.active })}
                  title={zone.active ? 'Desativar' : 'Ativar'}
                >
                  {zone.active ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(zone)}
                  disabled={editing !== null}
                  title="Editar"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(zone)}
                  className="text-red-500 hover:text-red-600"
                  title="Remover"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <p className="font-semibold mb-1">Como funciona</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Faixa de CEP: aplica quando o CEP do cliente cai no intervalo cadastrado.</li>
          <li>Poligono: aplica quando a localizacao (lat/lng) esta dentro da area desenhada.</li>
          <li>Em sobreposicao, vence a zona com maior prioridade.</li>
        </ul>
      </div>

      {showSlotForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Nova janela</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Tipo</Label>
                <Select
                  value={slotForm.type}
                  onChange={(e) => setSlotForm((p) => ({ ...p, type: e.target.value as 'DELIVERY' | 'PICKUP' }))}
                >
                  <option value="DELIVERY">Entrega</option>
                  <option value="PICKUP">Retirada</option>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Capacidade de pedidos</Label>
                <Input
                  type="number"
                  min="1"
                  value={slotForm.capacityOrders}
                  onChange={(e) => setSlotForm((p) => ({ ...p, capacityOrders: Number(e.target.value) }))}
                  onFocus={handleNumberFocus}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Inicio</Label>
                <Input
                  type="datetime-local"
                  value={slotForm.startsAt}
                  onChange={(e) => setSlotForm((p) => ({ ...p, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Fim</Label>
                <Input
                  type="datetime-local"
                  value={slotForm.endsAt}
                  onChange={(e) => setSlotForm((p) => ({ ...p, endsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Capacidade de itens</Label>
                <Input
                  type="number"
                  min="1"
                  value={slotForm.capacityItems}
                  onChange={(e) => setSlotForm((p) => ({ ...p, capacityItems: e.target.value }))}
                  onFocus={handleNumberFocus}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Cutoff em minutos</Label>
                <Input
                  type="number"
                  min="0"
                  value={slotForm.cutoffMinutes}
                  onChange={(e) => setSlotForm((p) => ({ ...p, cutoffMinutes: Number(e.target.value) }))}
                  onFocus={handleNumberFocus}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowSlotForm(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={createSlotMut.isPending} onClick={handleCreateSlot}>
                {createSlotMut.isPending ? 'Criando...' : 'Criar janela'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Remover zona?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Esta acao remove "{deleteTarget.name}" da configuracao de frete.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteTarget.id)}
              >
                {deleteMut.isPending ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
