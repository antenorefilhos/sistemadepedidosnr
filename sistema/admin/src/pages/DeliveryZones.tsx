import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { brandAPI, deliveryAPI, fulfillmentAPI, getApiErrorMessage, type DeliveryZone, type DeliveryZonePayload } from '../services/api'
import { Truck, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Save, X, CalendarClock, MapPin, Upload, CheckCircle2, AlertTriangle, Search } from 'lucide-react'
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
import './delivery-zones-map.css'
import { Toast } from '../components/DeliveryZonesToast'
import { DeliveryZonesSlotsTab } from '../components/DeliveryZonesSlotsTab'
import { DeliveryZonesRulesTab } from '../components/DeliveryZonesRulesTab'
import {
  fixLeafletDrawReadableArea, escapeHtml, circleToPolygonLatLngs, maskCep, formatFee,
  localToIso, isoToLocal, parsePolygonGeoJSON,
  type Tab, EMPTY_FORM, EMPTY_SLOT_FORM, DEFAULT_CENTER, BASEMAPS, BASEMAP_STORAGE_KEY,
  REFERENCE_COLORS, SLOTS_PER_PAGE, ESRI_ATTRIBUTION,
} from '../utils/deliveryZonesHelpers'

export default function DeliveryZones() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('zones')
  const [editing, setEditing] = useState<string | null>(null)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null)
  const [form, setForm] = useState<DeliveryZonePayload>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null)
  const [originalThreshold, setOriginalThreshold] = useState<number | null>(null)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [overlaps, setOverlaps] = useState<Array<{ id: string; name: string; reason: string }>>([])
  const [showImport, setShowImport] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [slotsPage, setSlotsPage] = useState(1)
  const [slotsFilter, setSlotsFilter] = useState<'ALL' | 'DELIVERY' | 'PICKUP'>('ALL')

  // Zone tester
  const [testCep, setTestCep] = useState('')
  const [testSubtotal, setTestSubtotal] = useState('')
  const [testResult, setTestResult] = useState<{ calculation: any; matches: Array<{ id: string; name: string; fee: number; priority: number; matchedBy: string }> } | null>(null)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  /** Zonas ja cadastradas desenhadas como referencia (nao editaveis). */
  const referenceGroupRef = useRef<L.FeatureGroup | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState<Array<{ label: string; lat: number; lon: number }>>([])
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
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
      setOriginalThreshold(value)
      return res.data
    },
  })

  /**
   * Zona ativa e obrigatoria: sem ela nenhum endereco casa e o checkout
   * recusa de verdade. Janela de entrega NAO e mais obrigatoria (achado
   * JON-31, 09/09/2026): `validateSlotCapacity` no backend trata falta de
   * janela utilizavel como ASAP valido de proposito (ver comentario la) --
   * o texto daqui dizia "o cliente nao consegue concluir o pedido", que ficou
   * desatualizado e assustava o lojista a toa. Rebaixado pra aviso.
   */
  const readiness = useMemo(() => {
    const activeZones = zones.filter((zone) => zone.active)
    const now = Date.now()
    const upcomingSlots = slots.filter((slot) => {
      const starts = new Date(slot.startsAt).getTime()
      const available = slot.availableOrders ?? null
      return starts > now && (available === null || available > 0)
    })

    const blockers: string[] = []
    if (!activeZones.length) blockers.push('Nenhuma zona ativa: nenhum endereco sera aceito no checkout.')

    const warnings: string[] = []
    if (!upcomingSlots.length) {
      warnings.push('Nenhuma janela de entrega futura com vaga: o sistema aceita o pedido no modo "o quanto antes" (ASAP) automaticamente, mas vale cadastrar janelas novas.')
    }
    const incomplete = activeZones.filter((zone) =>
      zone.type === 'CEP_RANGE' ? !(zone.cepStart && zone.cepEnd) : !zone.polygonGeoJSON,
    )
    if (incomplete.length) {
      warnings.push(
        `${incomplete.length} zona(s) ativa(s) sem area definida (${incomplete.map((z) => z.name).join(', ')}) — nunca vao casar com nenhum endereco.`,
      )
    }

    return { blockers, warnings, activeZones: activeZones.length, upcomingSlots: upcomingSlots.length }
  }, [zones, slots])

  const createMut = useMutation({
    mutationFn: (data: DeliveryZonePayload) => deliveryAPI.createZone(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      setToast({ tone: 'success', message: 'Zona criada.' })
      reset()
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeliveryZonePayload> }) => deliveryAPI.updateZone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      setToast({ tone: 'success', message: 'Zona atualizada.' })
      reset()
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const updateThresholdMut = useMutation({
    mutationFn: (value: number | null) => brandAPI.update({ freeShippingThreshold: value }),
    onSuccess: (_, value) => {
      qc.invalidateQueries({ queryKey: ['brand-config'] })
      qc.invalidateQueries({ queryKey: ['brand-config-delivery'] })
      setOriginalThreshold(value)
      setToast({ tone: 'success', message: 'Valor minimo salvo.' })
    },
    onError: (e: unknown) => setToast({ tone: 'error', message: getApiErrorMessage(e) }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deliveryAPI.deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      setDeleteTarget(null)
      setToast({ tone: 'success', message: 'Zona removida.' })
    },
    onError: (e: unknown) => setToast({ tone: 'error', message: getApiErrorMessage(e) }),
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
      setToast({ tone: 'success', message: 'Janela criada.' })
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e)),
  })

  const bulkImportMut = useMutation({
    mutationFn: (zones: DeliveryZonePayload[]) => deliveryAPI.bulkImportZones(zones),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['delivery-zones'] })
      const { created, errors } = res.data
      setShowImport(false)
      setImportCsv('')
      if (errors.length > 0) {
        setToast({ tone: 'error', message: `Importadas ${created}, ${errors.length} com erro.` })
      } else {
        setToast({ tone: 'success', message: `${created} zonas importadas.` })
      }
    },
    onError: (e: unknown) => setToast({ tone: 'error', message: getApiErrorMessage(e) }),
  })

  const testMut = useMutation({
    mutationFn: (data: { cep?: string; subtotal?: number }) => deliveryAPI.testZone(data),
    onSuccess: (res) => setTestResult(res.data),
    onError: (e: unknown) => setToast({ tone: 'error', message: getApiErrorMessage(e) }),
  })

  const reset = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setOverlaps([])
  }

  const openNew = () => {
    setEditing('new')
    setForm(EMPTY_FORM)
    setError(null)
    setOverlaps([])
  }

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone.id)
    setForm({
      name: zone.name,
      type: zone.type,
      cepStart: zone.cepStart ?? '',
      cepEnd: zone.cepEnd ?? '',
      polygonGeoJSON: zone.polygonGeoJSON ?? null,
      // A API devolve Decimal como string; sem coagir, o campo de taxa recebia
      // "150.00" e o formulario passava a operar com texto.
      fee: Number(zone.fee),
      freeAbove: zone.freeAbove == null ? null : Number(zone.freeAbove),
      active: zone.active,
      priority: zone.priority,
    })
    setError(null)
    setOverlaps([])
  }

  // Overlap detection while editing
  useEffect(() => {
    if (editing === null) return
    const t = setTimeout(async () => {
      if (form.type === 'CEP_RANGE' && form.cepStart && form.cepEnd && form.cepStart.replace(/\D/g, '').length === 8 && form.cepEnd.replace(/\D/g, '').length === 8) {
        try {
          const res = await deliveryAPI.checkOverlap({
            id: editing === 'new' ? undefined : editing,
            type: 'CEP_RANGE',
            cepStart: form.cepStart,
            cepEnd: form.cepEnd,
          })
          setOverlaps(res.data.overlaps)
        } catch { /* ignore */ }
      } else if (form.type === 'GEO_POLYGON' && form.polygonGeoJSON) {
        try {
          const res = await deliveryAPI.checkOverlap({
            id: editing === 'new' ? undefined : editing,
            type: 'GEO_POLYGON',
            polygonGeoJSON: form.polygonGeoJSON,
          })
          setOverlaps(res.data.overlaps)
        } catch { /* ignore */ }
      } else {
        setOverlaps([])
      }
    }, 400)
    return () => clearTimeout(t)
  }, [editing, form.type, form.cepStart, form.cepEnd, form.polygonGeoJSON])

  const handleSave = () => {
    const feeValue = Number(form.fee)
    const rawFreeAbove = form.freeAbove as number | string | null | undefined
    const freeAboveValue =
      rawFreeAbove === null || rawFreeAbove === undefined || rawFreeAbove === ''
        ? null
        : Number(rawFreeAbove)
    const priorityValue = Number(form.priority ?? 0)

    const name = form.name?.trim() || ''
    if (!name) {
      setError('Nome obrigatorio')
      return
    }
    // Nomes como "Pe" ou "110" nao dizem nada na hora de auditar um frete cobrado.
    if (name.length < 3) {
      setError('Use um nome que identifique a regiao (ex.: "Centro", "Pedro do Rio")')
      return
    }
    if (/^\d+$/.test(name)) {
      setError('O nome nao pode ser so numeros — use o nome da regiao atendida')
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
    if (form.type === 'CEP_RANGE') {
      const start = (form.cepStart || '').replace(/\D/g, '')
      const end = (form.cepEnd || '').replace(/\D/g, '')
      if (start.length !== 8 || end.length !== 8) {
        setError('CEPs devem ter 8 digitos')
        return
      }
      if (Number(start) > Number(end)) {
        setError('CEP inicial deve ser menor ou igual ao final')
        return
      }
    }
    if (form.type === 'GEO_POLYGON' && !form.polygonGeoJSON) {
      setError('Para zona geografica, desenhe um poligono no mapa')
      return
    }

    // Grava sempre no mesmo formato. A base tinha "25750-222" e "20000000"
    // convivendo; o backend compara por numero, mas a lista fica ilegivel e
    // qualquer busca textual falha.
    const normalizeCep = (value: string | null | undefined) => {
      const digits = (value || '').replace(/\D/g, '')
      return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : undefined
    }

    const payload: DeliveryZonePayload = {
      name,
      type: form.type,
      cepStart: form.type === 'CEP_RANGE' ? normalizeCep(form.cepStart) : undefined,
      cepEnd: form.type === 'CEP_RANGE' ? normalizeCep(form.cepEnd) : undefined,
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

  const filteredSlots = useMemo(
    () => slots.filter((s) => (slotsFilter === 'ALL' ? true : s.type === slotsFilter)),
    [slots, slotsFilter]
  )
  const slotsPageCount = Math.max(1, Math.ceil(filteredSlots.length / SLOTS_PER_PAGE))
  const paginatedSlots = filteredSlots.slice((slotsPage - 1) * SLOTS_PER_PAGE, slotsPage * SLOTS_PER_PAGE)

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
      startsAt: isoToLocal(new Date(now + 60 * 60 * 1000).toISOString()),
      endsAt: isoToLocal(new Date(now + 2 * 60 * 60 * 1000).toISOString()),
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
    if (new Date(slotForm.endsAt) <= new Date(slotForm.startsAt)) {
      setError('Fim deve ser posterior ao inicio')
      return
    }
    if (!Number.isFinite(capacityOrders) || capacityOrders <= 0) {
      setError('Capacidade de pedidos deve ser maior que zero')
      return
    }
    createSlotMut.mutate({
      type: slotForm.type,
      startsAt: localToIso(slotForm.startsAt),
      endsAt: localToIso(slotForm.endsAt),
      capacityOrders,
      capacityItems: Number.isFinite(Number(capacityItems)) && Number(capacityItems) > 0 ? Number(capacityItems) : null,
      cutoffMinutes: Number.isFinite(cutoffMinutes) && cutoffMinutes > 0 ? cutoffMinutes : 0,
    })
  }

  const handleTest = () => {
    const cep = testCep.replace(/\D/g, '')
    if (cep.length !== 8) {
      setToast({ tone: 'error', message: 'CEP invalido' })
      return
    }
    const subtotal = testSubtotal ? Number(testSubtotal) : undefined
    testMut.mutate({ cep, subtotal })
  }

  const handleImport = () => {
    const lines = importCsv.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) {
      setToast({ tone: 'error', message: 'CSV vazio' })
      return
    }
    const zones: DeliveryZonePayload[] = []
    for (const line of lines) {
      const [name, cepStart, cepEnd, fee, freeAbove, priority] = line.split(',').map((s) => s.trim())
      if (!name || !cepStart || !cepEnd || !fee) continue
      zones.push({
        name,
        type: 'CEP_RANGE',
        cepStart: maskCep(cepStart),
        cepEnd: maskCep(cepEnd),
        polygonGeoJSON: null,
        fee: Number(fee),
        freeAbove: freeAbove ? Number(freeAbove) : null,
        active: true,
        priority: priority ? Number(priority) : 0,
      })
    }
    if (zones.length === 0) {
      setToast({ tone: 'error', message: 'Nenhuma linha valida' })
      return
    }
    bulkImportMut.mutate(zones)
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

    // Rotulos do satelite entram como camada propria: imagem de satelite sozinha
    // nao tem nome de rua, e desenhar zona sem referencia de rua e inviavel.
    const labelsLayer = L.tileLayer(BASEMAPS.satelite.labelsOverlay as string, {
      attribution: ESRI_ATTRIBUTION,
      pane: 'shadowPane',
    })

    const baseLayers: Record<string, L.TileLayer> = {}
    for (const [key, config] of Object.entries(BASEMAPS)) {
      baseLayers[config.label] = L.tileLayer(config.url, { attribution: config.attribution })
      baseLayers[config.label].on('add', () => {
        try {
          window.localStorage.setItem(BASEMAP_STORAGE_KEY, key)
        } catch {
          /* modo privado bloqueia storage; a escolha so nao persiste */
        }
        if (BASEMAPS[key].labelsOverlay) labelsLayer.addTo(map)
        else map.removeLayer(labelsLayer)
      })
    }

    let saved: string | null = null
    try {
      saved = window.localStorage.getItem(BASEMAP_STORAGE_KEY)
    } catch {
      /* idem */
    }
    const initial = saved && BASEMAPS[saved] ? saved : 'ruas'
    baseLayers[BASEMAPS[initial].label].addTo(map)

    const referenceGroup = new L.FeatureGroup()
    referenceGroupRef.current = referenceGroup
    map.addLayer(referenceGroup)

    L.control
      .layers(baseLayers, { 'Zonas ja cadastradas': referenceGroup }, { position: 'topright', collapsed: false })
      .addTo(map)

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

    fixLeafletDrawReadableArea()

    // leaflet-draw so fala ingles por padrao; quem usa isso e a operacao da loja.
    const drawLocal = (L as any).drawLocal
    if (drawLocal) {
      drawLocal.draw.toolbar.actions = { title: 'Cancelar desenho', text: 'Cancelar' }
      drawLocal.draw.toolbar.finish = { title: 'Concluir desenho', text: 'Concluir' }
      drawLocal.draw.toolbar.undo = { title: 'Apagar ultimo ponto', text: 'Apagar ultimo ponto' }
      drawLocal.draw.toolbar.buttons = {
        polygon: 'Desenhar area livre',
        rectangle: 'Desenhar area retangular',
        circle: 'Desenhar raio a partir de um ponto',
      }
      drawLocal.draw.handlers.polygon = {
        tooltip: {
          start: 'Clique para comecar a area.',
          cont: 'Clique para continuar a area.',
          end: 'Clique no primeiro ponto para fechar.',
        },
      }
      drawLocal.draw.handlers.rectangle = { tooltip: { start: 'Arraste para desenhar o retangulo.' } }
      drawLocal.draw.handlers.circle = {
        tooltip: { start: 'Clique no centro e arraste para definir o raio.' },
        radius: 'Raio',
      }
      drawLocal.draw.handlers.simpleshape = { tooltip: { end: 'Solte o mouse para concluir.' } }
      drawLocal.edit.toolbar.actions = {
        save: { title: 'Salvar alteracoes', text: 'Salvar' },
        cancel: { title: 'Descartar alteracoes', text: 'Cancelar' },
        clearAll: { title: 'Limpar tudo', text: 'Limpar tudo' },
      }
      drawLocal.edit.toolbar.buttons = {
        edit: 'Editar area',
        editDisabled: 'Nenhuma area para editar',
        remove: 'Apagar area',
        removeDisabled: 'Nenhuma area para apagar',
      }
      drawLocal.edit.handlers.edit = {
        tooltip: { text: 'Arraste os pontos para ajustar a area.', subtext: 'Cancelar desfaz as alteracoes.' },
      }
      drawLocal.edit.handlers.remove = { tooltip: { text: 'Clique na area para apaga-la.' } }
    }

    const drawControl = new DrawControl({
      draw: {
        polygon: true,
        // Raio a partir da loja: cobertura inicial sai muito mais rapido que
        // tracar poligono a mao. Vira poligono no onCreated (ver abaixo).
        circle: { metric: true, showRadius: true },
        rectangle: true,
        polyline: false,
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

      // Circulo e retangulo viram poligono antes de qualquer coisa: e o unico
      // formato que o backend sabe casar com um endereco.
      const layer =
        e.layer instanceof L.Circle
          ? L.polygon(circleToPolygonLatLngs(e.layer.getLatLng(), e.layer.getRadius()))
          : e.layer

      drawnItems.addLayer(layer)
      setForm((p) => ({ ...p, polygonGeoJSON: JSON.stringify(layer.toGeoJSON()) }))
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
      referenceGroupRef.current = null
    }
  }, [editing, form.type])

  /**
   * Desenha as OUTRAS zonas poligonais como referencia — o pedido central: sem
   * ver o que ja esta coberto, nao da para saber onde falta nem evitar
   * sobreposicao. Nao entram no grupo editavel do leaflet-draw, entao nao ha
   * risco de arrastar a zona errada sem perceber.
   */
  useEffect(() => {
    const group = referenceGroupRef.current
    if (!group) return

    group.clearLayers()

    const others = zones.filter(
      (zone) => zone.id !== editing && zone.type === 'GEO_POLYGON' && zone.polygonGeoJSON,
    )

    others.forEach((zone, index) => {
      const points = parsePolygonGeoJSON(zone.polygonGeoJSON)
      if (points.length < 3) return

      const color = REFERENCE_COLORS[index % REFERENCE_COLORS.length]
      L.polygon(points, {
        color,
        weight: 2,
        opacity: zone.active ? 0.9 : 0.4,
        fillColor: color,
        fillOpacity: zone.active ? 0.12 : 0.05,
        dashArray: zone.active ? undefined : '5,5',
        interactive: false,
      })
        .addTo(group)

      // Rotulo fixo no centro: no hover so da para ler uma zona por vez, e a
      // pergunta ("o que ja esta coberto e por quanto?") precisa ser respondida
      // de relance, com o mapa inteiro a vista.
      L.marker(L.polygon(points).getBounds().getCenter(), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'zone-label',
          html: `<span style="border-color:${color};color:${color}">${escapeHtml(zone.name)}<b>${formatFee(zone.fee)}</b>${zone.active ? '' : '<i>inativa</i>'}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(group)
    })

    // Zona nova ainda sem desenho: enquadra no que ja existe, senao o mapa abre
    // numa area vazia e o operador perde tempo se localizando.
    const map = mapRef.current
    const hasOwnPolygon = parsePolygonGeoJSON(form.polygonGeoJSON).length > 2
    if (map && !hasOwnPolygon && others.length) {
      const bounds = group.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [zones, editing, form.type, form.polygonGeoJSON])

  const polygonPreview = useMemo(() => parsePolygonGeoJSON(form.polygonGeoJSON), [form.polygonGeoJSON])

  useEffect(() => {
    if (!drawnItemsRef.current) return
    const drawnItems = drawnItemsRef.current
    drawnItems.clearLayers()
    if (polygonPreview.length > 2) {
      const poly = L.polygon(polygonPreview)
      drawnItems.addLayer(poly)
      if (mapRef.current && !mapRef.current.getBounds().intersects(poly.getBounds())) {
        mapRef.current.fitBounds(poly.getBounds(), { padding: [10, 10] })
      }

      // Zona sendo editada nunca entra no grupo "others" (fica excluida por id),
      // entao sem isto ela era a unica sem nome/valor no mapa -- inclusive logo
      // depois de salva, se o operador reabre pra conferir.
      const feeValue = Number(form.fee)
      L.marker(poly.getBounds().getCenter(), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'zone-label',
          html: `<span style="border-color:#5D082A;color:#5D082A">${escapeHtml(form.name || 'Nova zona')}${Number.isFinite(feeValue) && feeValue > 0 ? `<b>${formatFee(feeValue)}</b>` : ''}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(drawnItems)
    }
  }, [polygonPreview, form.name, form.fee])

  const thresholdDirty = freeShippingThreshold !== originalThreshold

  /**
   * Busca de endereco para levar o mapa ate a regiao, via Nominatim (OSM).
   *
   * Gratuito e sem chave, mas a politica de uso proibe autocomplete a cada tecla
   * — por isso a busca so dispara no submit. Nao guarda nem envia dado de
   * cliente: e so o texto que o operador digitou para navegar o mapa.
   */
  const searchAddress = async (event: React.FormEvent) => {
    event.preventDefault()
    const query = addressQuery.trim()
    if (query.length < 3) return

    setAddressSearching(true)
    setAddressError(null)
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: query,
        limit: '5',
        countrycodes: 'br',
        'accept-language': 'pt-BR',
      })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!response.ok) throw new Error(String(response.status))

      const found = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
      setAddressResults(found.map((item) => ({ label: item.display_name, lat: Number(item.lat), lon: Number(item.lon) })))
      if (!found.length) setAddressError('Nenhum endereco encontrado.')
    } catch {
      setAddressError('Nao foi possivel buscar agora. Verifique a conexao e tente de novo.')
      setAddressResults([])
    } finally {
      setAddressSearching(false)
    }
  }

  const goToAddress = (lat: number, lon: number) => {
    mapRef.current?.setView([lat, lon], 16)
    setAddressResults([])
  }

  const drawingPolygon = editing !== null && form.type === 'GEO_POLYGON'

  return (
    // Desenhando poligono a tela usa toda a largura: mapa estreito obriga a
    // arrastar o tempo todo e atrapalha o tracado.
    <div className={`p-4 sm:p-6 ${drawingPolygon ? 'max-w-none' : 'max-w-5xl'}`}>
      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3 mb-4">
        <Truck className="text-[#5D082A]" size={24} />
        <h1 className="text-2xl font-bold text-gray-800">Taxas de Entrega</h1>
      </div>

      {/* Prontidao: a tela nao pode parecer saudavel com a loja incapaz de vender. */}
      {!isLoading && !slotsLoading && (
        <div
          className={`mb-6 rounded-lg border px-5 py-4 ${
            readiness.blockers.length
              ? 'border-red-300 bg-red-50'
              : readiness.warnings.length
              ? 'border-amber-300 bg-amber-50'
              : 'border-emerald-300 bg-emerald-50'
          }`}
          role={readiness.blockers.length ? 'alert' : undefined}
        >
          <div className="flex items-start gap-3">
            {readiness.blockers.length ? (
              <AlertTriangle size={20} className="text-red-700 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2
                size={20}
                className={`shrink-0 mt-0.5 ${readiness.warnings.length ? 'text-amber-700' : 'text-emerald-700'}`}
              />
            )}
            <div className="min-w-0">
              <p
                className={`font-semibold ${
                  readiness.blockers.length
                    ? 'text-red-800'
                    : readiness.warnings.length
                    ? 'text-amber-800'
                    : 'text-emerald-800'
                }`}
              >
                {readiness.blockers.length
                  ? 'A loja nao consegue receber pedidos agora'
                  : readiness.warnings.length
                  ? 'A loja esta recebendo pedidos, com ressalvas'
                  : 'A loja esta pronta para receber pedidos'}
              </p>

              {readiness.blockers.map((item) => (
                <p key={item} className="text-sm text-red-700 mt-1">
                  {item}
                </p>
              ))}
              {readiness.warnings.map((item) => (
                <p key={item} className="text-sm text-amber-700 mt-1">
                  {item}
                </p>
              ))}

              <p className="text-xs text-gray-600 mt-2">
                {readiness.activeZones} zona(s) ativa(s) · {readiness.upcomingSlots} janela(s) futura(s) com vaga
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'zones' as Tab, label: 'Zonas', icon: MapPin },
          { key: 'slots' as Tab, label: 'Janelas', icon: CalendarClock },
          { key: 'rules' as Tab, label: 'Regras globais', icon: CheckCircle2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-[#5D082A] text-[#5D082A]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ============ ZONES TAB ============ */}
      {tab === 'zones' && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button type="button" onClick={openNew} disabled={editing !== null}>
              <Plus size={16} />
              Nova zona
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowImport(true)} disabled={editing !== null}>
              <Upload size={16} />
              Importar CSV
            </Button>
            <div className="ml-auto text-xs text-gray-500">{zones.length} zona(s) cadastrada(s)</div>
          </div>

          {/* Zone tester widget */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-blue-700" />
              <p className="text-sm font-semibold text-blue-900">Testar CEP</p>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="mb-1 block text-xs text-gray-600">CEP</Label>
                <Input
                  type="text"
                  value={testCep}
                  onChange={(e) => setTestCep(maskCep(e.target.value))}
                  placeholder="00000-000"
                  className="font-mono w-40"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Subtotal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={testSubtotal}
                  onChange={(e) => setTestSubtotal(e.target.value)}
                  onFocus={handleNumberFocus}
                  placeholder="Opcional"
                  className="w-32"
                />
              </div>
              <Button type="button" onClick={handleTest} disabled={testMut.isPending}>
                {testMut.isPending ? 'Testando...' : 'Testar'}
              </Button>
              {testResult && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setTestResult(null)} title="Limpar">
                  <X size={16} />
                </Button>
              )}
            </div>
            {testResult && (
              <div className="mt-3 bg-white border border-blue-100 rounded-lg p-3">
                {testResult.calculation.outOfArea ? (
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Fora da area de cobertura
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      Zona aplicada: <span className="font-semibold">{testResult.calculation.zoneName || 'N/A'}</span>
                      {' · '}
                      Taxa: <span className="font-semibold text-[#5D082A]">{formatFee(testResult.calculation.fee ?? 0)}</span>
                      {testResult.calculation.isFree && <span className="text-emerald-600 ml-1">(gratis pelo valor)</span>}
                    </p>
                    {testResult.matches.length > 1 && (
                      <div className="mt-2 text-xs text-gray-500">
                        <p className="mb-1">Outras zonas que casam ({testResult.matches.length} total):</p>
                        <ul className="list-disc pl-4">
                          {testResult.matches.map((m) => (
                            <li key={m.id}>{m.name} · {formatFee(m.fee)} · prioridade {m.priority} · {m.matchedBy === 'CEP' ? 'CEP' : 'poligono'}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {error && editing === null && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {editing !== null && (
            <div className="bg-white border border-[#D2BB8A] rounded-lg p-5 mb-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-700 mb-4">{editing === 'new' ? 'Nova zona de entrega' : 'Editar zona'}</h2>

              {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              {overlaps.length > 0 && (
                <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                  <p className="font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={14} /> Sobreposicao detectada</p>
                  <ul className="list-disc pl-5 text-xs">
                    {overlaps.map((o) => <li key={o.id}>{o.name} — {o.reason}</li>)}
                  </ul>
                  <p className="text-xs mt-1 opacity-80">Ajuste prioridades para definir qual zona vence.</p>
                </div>
              )}

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
                    {/* Desenhar zona exige ver quarteirao: 288px nao davam. Usa a
                        altura da janela, com piso para telas baixas. */}
                    {/* Levar o mapa ate o bairro digitando, em vez de arrastar. */}
                    <div className="mb-2">
                      <form onSubmit={searchAddress} className="flex gap-2">
                        <Input
                          value={addressQuery}
                          onChange={(e) => setAddressQuery(e.target.value)}
                          placeholder="Ir para endereco, bairro ou cidade"
                          aria-label="Buscar endereco no mapa"
                        />
                        <Button type="submit" variant="outline" disabled={addressSearching || addressQuery.trim().length < 3}>
                          <Search size={16} />
                          {addressSearching ? 'Buscando...' : 'Ir'}
                        </Button>
                      </form>

                      {addressError && <p className="text-xs text-red-600 mt-1">{addressError}</p>}

                      {addressResults.length > 0 && (
                        <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                          {addressResults.map((item) => (
                            <li key={`${item.lat},${item.lon}`}>
                              <button
                                type="button"
                                onClick={() => goToAddress(item.lat, item.lon)}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                {item.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* No celular o mapa sangra ate a borda do card: tres niveis de
                        padding empilhados deixavam so ~247px de largura util. */}
                    <div
                      ref={mapContainerRef}
                      className="h-[clamp(420px,68vh,760px)] -mx-5 sm:mx-0 overflow-hidden border-y sm:border sm:rounded-lg border-gray-300"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Desenhe a area de entrega com o poligono, o retangulo ou o circulo (raio a partir
                      de um ponto — o mais rapido para comecar). Qualquer um deles e gravado como
                      poligono. As zonas ja cadastradas aparecem com nome e taxa. Troque o mapa base no
                      canto superior direito: o satelite ajuda a enxergar quarteirao e barreira fisica.
                    </p>
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
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  <Save size={15} />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="secondary" onClick={reset}>
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
                      {zone.priority > 0 && <Badge variant="outline" className="text-[10px]">P{zone.priority}</Badge>}
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
                      {zone.freeAbove != null && (
                        <span className="text-gray-500">{' · gratis acima de '}{formatFee(zone.freeAbove)}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon" onClick={() => toggleMut.mutate({ id: zone.id, active: !zone.active })} title={zone.active ? 'Desativar' : 'Ativar'}>
                      {zone.active ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(zone)} disabled={editing !== null} title="Editar">
                      <Pencil size={16} />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(zone)} className="text-red-500 hover:text-red-600" title="Remover">
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
              <li>Em sobreposicao, vence a zona com maior prioridade (numero maior).</li>
              <li>Use o testador acima para simular antes de publicar.</li>
            </ul>
          </div>
        </>
      )}

      {/* ============ SLOTS TAB ============ */}
      {tab === 'slots' && (
        <DeliveryZonesSlotsTab
          onNewSlot={openSlotForm}
          createPending={createSlotMut.isPending}
          slotsFilter={slotsFilter}
          onSlotsFilterChange={(value) => { setSlotsFilter(value); setSlotsPage(1) }}
          slotSummary={slotSummary}
          slotsLoading={slotsLoading}
          filteredSlots={filteredSlots}
          paginatedSlots={paginatedSlots}
          slotsPage={slotsPage}
          slotsPageCount={slotsPageCount}
          onSlotsPageChange={setSlotsPage}
        />
      )}

      {/* ============ RULES TAB ============ */}
      {tab === 'rules' && (
        <DeliveryZonesRulesTab
          freeShippingThreshold={freeShippingThreshold}
          onFreeShippingThresholdChange={setFreeShippingThreshold}
          onNumberFocus={handleNumberFocus}
          onSave={() => updateThresholdMut.mutate(freeShippingThreshold)}
          savePending={updateThresholdMut.isPending}
          thresholdDirty={thresholdDirty}
          onUndo={() => setFreeShippingThreshold(originalThreshold)}
        />
      )}

      {/* Slot form modal */}
      {showSlotForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Nova janela</h2>
            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Tipo</Label>
                <Select value={slotForm.type} onChange={(e) => setSlotForm((p) => ({ ...p, type: e.target.value as 'DELIVERY' | 'PICKUP' }))}>
                  <option value="DELIVERY">Entrega</option>
                  <option value="PICKUP">Retirada</option>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Capacidade de pedidos</Label>
                <Input type="number" min="1" value={slotForm.capacityOrders} onChange={(e) => setSlotForm((p) => ({ ...p, capacityOrders: Number(e.target.value) }))} onFocus={handleNumberFocus} />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Inicio (horario local)</Label>
                <Input type="datetime-local" value={slotForm.startsAt} onChange={(e) => setSlotForm((p) => ({ ...p, startsAt: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Fim (horario local)</Label>
                <Input type="datetime-local" value={slotForm.endsAt} onChange={(e) => setSlotForm((p) => ({ ...p, endsAt: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Capacidade de itens</Label>
                <Input type="number" min="1" value={slotForm.capacityItems} onChange={(e) => setSlotForm((p) => ({ ...p, capacityItems: e.target.value }))} onFocus={handleNumberFocus} placeholder="Opcional" />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-gray-600">Cutoff em minutos</Label>
                <Input type="number" min="0" value={slotForm.cutoffMinutes} onChange={(e) => setSlotForm((p) => ({ ...p, cutoffMinutes: Number(e.target.value) }))} onFocus={handleNumberFocus} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowSlotForm(false); setError(null) }}>Cancelar</Button>
              <Button type="button" disabled={createSlotMut.isPending} onClick={handleCreateSlot}>
                {createSlotMut.isPending ? 'Criando...' : 'Criar janela'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Importar zonas por CSV</h2>
            <p className="text-sm text-gray-500 mt-1">Uma zona por linha, campos separados por virgula:</p>
            <code className="block mt-2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono">nome,cep_inicial,cep_final,taxa,frete_gratis_acima,prioridade</code>
            <p className="text-xs text-gray-500 mt-1">Exemplo: <code className="bg-gray-50 px-1">Centro,26000000,26099999,10.00,150.00,10</code></p>
            <textarea
              value={importCsv}
              onChange={(e) => setImportCsv(e.target.value)}
              rows={10}
              className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#5D082A] focus:outline-none"
              placeholder="Centro,26000000,26099999,10.00,,10"
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setShowImport(false); setImportCsv('') }}>Cancelar</Button>
              <Button type="button" disabled={bulkImportMut.isPending || !importCsv.trim()} onClick={handleImport}>
                {bulkImportMut.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Remover zona?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Esta acao remove "{deleteTarget.name}" da configuracao de frete.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteTarget.id)}>
                {deleteMut.isPending ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
