import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import '../pages/delivery-zones-map.css'
import { AlertCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { deliveryAPI, getApiErrorMessage, type DeliveryZone, type DeliveryZonePayload } from '../services/api'
import { Switch } from '@/components/ui/switch'
import { WorkspaceDialog } from './WorkspaceDialog'
import {
  fixLeafletDrawReadableArea, escapeHtml, circleToPolygonLatLngs, maskCep, formatFee, parsePolygonGeoJSON,
  EMPTY_FORM, DEFAULT_CENTER, BASEMAPS, BASEMAP_STORAGE_KEY, REFERENCE_COLORS, ESRI_ATTRIBUTION,
} from '../utils/deliveryZonesHelpers'

// Areas no mapa (refeita em 01/10/2026). Area desenhada vale quando o cliente
// usa a localizacao do celular e ela cai dentro: vence a tabela de frete. Faixa
// de CEP e reserva para CEP que nao esta na tabela. Ordem do calculo em
// DeliveryService.calculate.

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const input = 'h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm focus:border-gray-900 focus:outline-none'

/** Ruas ou satelite (escolha lembrada), com nome de rua por cima do satelite. */
function addBaseLayers(map: L.Map) {
  const labels = L.tileLayer(BASEMAPS.satelite.labelsOverlay as string, { attribution: ESRI_ATTRIBUTION, pane: 'shadowPane' })
  const layers: Record<string, L.TileLayer> = {}
  for (const [key, config] of Object.entries(BASEMAPS)) {
    layers[config.label] = L.tileLayer(config.url, { attribution: config.attribution })
    layers[config.label].on('add', () => {
      try {
        window.localStorage.setItem(BASEMAP_STORAGE_KEY, key)
      } catch {
        /* modo privado: a escolha so nao fica salva */
      }
      if (BASEMAPS[key].labelsOverlay) labels.addTo(map)
      else map.removeLayer(labels)
    })
  }
  let saved: string | null = null
  try {
    saved = window.localStorage.getItem(BASEMAP_STORAGE_KEY)
  } catch {
    /* idem */
  }
  layers[BASEMAPS[saved && BASEMAPS[saved] ? saved : 'ruas'].label].addTo(map)
  return layers
}

/** Areas com nome e taxa fixos no centro: o que esta coberto e por quanto, de relance. */
function drawAreas(group: L.FeatureGroup, zones: DeliveryZone[]) {
  group.clearLayers()
  zones.forEach((zone, index) => {
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
    }).addTo(group)
    L.marker(L.polygon(points).getBounds().getCenter(), {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'zone-label',
        html: `<span style="border-color:${color};color:${color}">${escapeHtml(zone.name)}<b>${formatFee(zone.fee)}</b>${zone.active ? '' : '<i>desligada</i>'}</span>`,
        iconSize: [0, 0],
      }),
    }).addTo(group)
  })
}

export function DeliveryAreasTab() {
  const qc = useQueryClient()
  const { data: zones = [], isLoading } = useQuery({ queryKey: ['delivery-zones'], queryFn: async () => (await deliveryAPI.listZones()).data })
  const [editing, setEditing] = useState<DeliveryZone | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DeliveryZone | null>(null)
  const [error, setError] = useState('')
  const polygons = useMemo(() => zones.filter((z) => z.type === 'GEO_POLYGON' && z.polygonGeoJSON), [zones])
  const refresh = () => qc.invalidateQueries({ queryKey: ['delivery-zones'] })

  // Mapa geral (so leitura): a cobertura por GPS inteira a vista.
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const overviewMap = useRef<{ map: L.Map; group: L.FeatureGroup } | null>(null)
  useEffect(() => {
    if (!overviewRef.current || !polygons.length) return
    if (!overviewMap.current) {
      const map = L.map(overviewRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12)
      L.control.layers(addBaseLayers(map), undefined, { position: 'topright' }).addTo(map)
      const group = new L.FeatureGroup().addTo(map)
      overviewMap.current = { map, group }
    }
    const { map, group } = overviewMap.current
    drawAreas(group, polygons)
    const bounds = group.getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] })
  }, [polygons])
  useEffect(() => () => {
    overviewMap.current?.map.remove()
    overviewMap.current = null
  }, [])

  const toggle = async (zone: DeliveryZone) => {
    setError('')
    try {
      await deliveryAPI.updateZone(zone.id, { active: !zone.active })
      refresh()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível mudar a área.'))
    }
  }
  const remove = async (zone: DeliveryZone) => {
    try {
      await deliveryAPI.deleteZone(zone.id)
      setDeleting(null)
      refresh()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível apagar a área.'))
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-gray-500">
          Área desenhada vale quando o cliente usa a localização do celular e ela cai dentro: vence a tabela de frete. Faixa de CEP é reserva para CEP que não está na tabela.
        </p>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          <Plus size={16} /> Nova área
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {polygons.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div ref={overviewRef} className="h-[280px] sm:h-[380px]" aria-label="Mapa das áreas de entrega" />
        </section>
      )}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/70" />
      ) : zones.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-6 text-sm text-gray-500">Nenhuma área cadastrada. O frete sai só da tabela de frete, pelo CEP.</p>
      ) : (
        <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {zones.map((zone) => {
            const color = zone.type === 'GEO_POLYGON' ? REFERENCE_COLORS[Math.max(0, polygons.indexOf(zone)) % REFERENCE_COLORS.length] : '#9ca3af'
            return (
              <li key={zone.id} className={`flex items-start gap-3 p-4 ${zone.active ? '' : 'bg-gray-50/60'}`}>
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, opacity: zone.active ? 1 : 0.4 }} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${zone.active ? 'text-gray-900' : 'text-gray-500'}`}>
                    {zone.name}
                    <span className="ml-2 text-xs text-gray-400">
                      {zone.type === 'GEO_POLYGON' ? 'área no mapa' : `CEP ${zone.cepStart} a ${zone.cepEnd}`}
                      {zone.priority > 0 && ` · prioridade ${zone.priority}`}
                      {!zone.active && ' · desligada'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-gray-500">
                    {formatFee(zone.fee)}
                    {zone.freeAbove != null && ` · grátis acima de ${formatFee(zone.freeAbove)}`}
                    {' · '}
                    {zone.orders90d ? `${zone.orders90d} pedido(s) em 90 dias, ${brl(zone.revenue90d || 0)}` : 'nenhum pedido em 90 dias'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={zone.active} onChange={() => toggle(zone)} aria-label={zone.active ? `Desligar ${zone.name}` : `Ligar ${zone.name}`} />
                  <button type="button" onClick={() => setEditing(zone)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label={`Editar ${zone.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => setDeleting(zone)} className="rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Apagar ${zone.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <AreaEditor
          zone={editing === 'new' ? null : editing}
          others={editing === 'new' ? polygons : polygons.filter((z) => z.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setDeleting(null)}>
          <div role="alertdialog" aria-label="Apagar área" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-gray-900">Apagar "{deleting.name}"?</p>
            <p className="mt-1 text-sm text-gray-500">Os pedidos antigos não mudam. Para só parar de usar, desligue em vez de apagar.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2 text-sm text-gray-600 ring-1 ring-black/[0.08]">Cancelar</button>
              <button type="button" onClick={() => remove(deleting)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AreaEditor({ zone, others, onClose, onSaved }: { zone: DeliveryZone | null; others: DeliveryZone[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<DeliveryZonePayload>(
    zone
      ? {
          name: zone.name,
          type: zone.type,
          cepStart: zone.cepStart ?? '',
          cepEnd: zone.cepEnd ?? '',
          polygonGeoJSON: zone.polygonGeoJSON ?? null,
          // A API devolve Decimal como string.
          fee: Number(zone.fee),
          freeAbove: zone.freeAbove == null ? null : Number(zone.freeAbove),
          active: zone.active,
          priority: zone.priority,
        }
      : { ...EMPTY_FORM, type: 'GEO_POLYGON' },
  )
  const [fee, setFee] = useState(zone ? String(Number(zone.fee)).replace('.', ',') : '')
  const [free, setFree] = useState(zone?.freeAbove == null ? '' : String(Number(zone.freeAbove)).replace('.', ','))
  const [overlaps, setOverlaps] = useState<Array<{ id: string; name: string; reason: string }>>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isMap = form.type === 'GEO_POLYGON'
  const money = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')))

  // Sobreposicao com outra area (aviso, nao bloqueia: a prioridade decide).
  useEffect(() => {
    const t = setTimeout(async () => {
      const cepOk = (v?: string) => (v || '').replace(/\D/g, '').length === 8
      const body = isMap
        ? form.polygonGeoJSON && { type: 'GEO_POLYGON', polygonGeoJSON: form.polygonGeoJSON }
        : cepOk(form.cepStart) && cepOk(form.cepEnd) && { type: 'CEP_RANGE', cepStart: form.cepStart, cepEnd: form.cepEnd }
      if (!body) return setOverlaps([])
      try {
        setOverlaps((await deliveryAPI.checkOverlap({ id: zone?.id, ...body })).data.overlaps)
      } catch {
        /* aviso opcional */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [isMap, form.cepStart, form.cepEnd, form.polygonGeoJSON, zone?.id])

  const problems = useMemo(() => {
    const p: string[] = []
    const name = (form.name || '').trim()
    if (name.length < 3 || /^\d+$/.test(name)) p.push('um nome que identifique a região (ex.: "Centro", "Pedro do Rio")')
    const f = money(fee)
    if (f == null || !Number.isFinite(f) || f < 0) p.push('a taxa')
    const fa = money(free)
    if (fa != null && (!Number.isFinite(fa) || fa < 0)) p.push('um valor válido em "grátis acima de"')
    if (isMap && parsePolygonGeoJSON(form.polygonGeoJSON).length < 3) p.push('a área desenhada no mapa')
    if (!isMap) {
      const s = (form.cepStart || '').replace(/\D/g, '')
      const e = (form.cepEnd || '').replace(/\D/g, '')
      if (s.length !== 8 || e.length !== 8) p.push('os dois CEPs com 8 números')
      else if (Number(s) > Number(e)) p.push('o CEP inicial menor que o final')
    }
    return p
  }, [form, fee, free, isMap])

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    setError('')
    const cep = (v?: string) => {
      const d = (v || '').replace(/\D/g, '')
      return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : undefined
    }
    const payload: DeliveryZonePayload = {
      name: (form.name || '').trim(),
      type: form.type,
      cepStart: isMap ? undefined : cep(form.cepStart),
      cepEnd: isMap ? undefined : cep(form.cepEnd),
      polygonGeoJSON: isMap ? form.polygonGeoJSON || null : null,
      fee: money(fee) as number,
      freeAbove: money(free),
      active: form.active ?? true,
      priority: Number(form.priority || 0),
    }
    try {
      if (zone) await deliveryAPI.updateZone(zone.id, payload)
      else await deliveryAPI.createZone(payload)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar a área.'))
    } finally {
      setSaving(false)
    }
  }

  const fields = (
    <div className="space-y-4">
      {!zone && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-sm">
          {[
            { type: 'GEO_POLYGON' as const, label: 'Área no mapa' },
            { type: 'CEP_RANGE' as const, label: 'Faixa de CEP' },
          ].map((o) => (
            <button key={o.type} type="button" onClick={() => setForm((p) => ({ ...p, type: o.type }))} className={`rounded-lg px-3 py-1.5 ${form.type === o.type ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      <label className="block text-xs text-gray-500">
        Nome
        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: Chafariz" className={`${input} mt-1`} />
      </label>
      {!isMap && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-500">
            CEP inicial
            <input value={form.cepStart || ''} onChange={(e) => setForm((p) => ({ ...p, cepStart: maskCep(e.target.value) }))} inputMode="numeric" placeholder="00000-000" className={`${input} mt-1 tabular-nums`} />
          </label>
          <label className="block text-xs text-gray-500">
            CEP final
            <input value={form.cepEnd || ''} onChange={(e) => setForm((p) => ({ ...p, cepEnd: maskCep(e.target.value) }))} inputMode="numeric" placeholder="99999-999" className={`${input} mt-1 tabular-nums`} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-gray-500">
          Taxa (R$)
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${input} mt-1 tabular-nums`} />
        </label>
        <label className="block text-xs text-gray-500">
          Grátis acima de (R$)
          <input value={free} onChange={(e) => setFree(e.target.value)} inputMode="decimal" placeholder="vazio = regra geral" className={`${input} mt-1 tabular-nums`} />
        </label>
      </div>
      <label className="block text-xs text-gray-500">
        Prioridade
        <input type="number" min={0} value={form.priority ?? 0} onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) }))} className={`${input} mt-1 w-28 tabular-nums`} />
        <span className="mt-1 block text-[11px] text-gray-400">Só conta quando duas áreas se sobrepõem: a de número maior vence.</span>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-gray-900">
        Área ligada
        <Switch checked={form.active ?? true} onChange={(on) => setForm((p) => ({ ...p, active: on }))} aria-label="Área ligada" />
      </label>
      {overlaps.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-medium">Sobrepõe outra área</p>
          <ul className="mt-1 space-y-0.5">
            {overlaps.map((o) => (
              <li key={o.id}>{o.name}: {o.reason}</li>
            ))}
          </ul>
          <p className="mt-1 text-amber-800">Na parte em comum vale a de maior prioridade.</p>
        </div>
      )}
    </div>
  )

  return (
    <WorkspaceDialog
      label={zone ? `Editar ${zone.name}` : 'Nova área'}
      size="xl"
      closeOnEsc={false}
      onClose={onClose}
      title={<h3 className="text-base font-semibold text-gray-900">{zone ? zone.name : 'Nova área de entrega'}</h3>}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className={`mr-auto text-xs ${error ? 'text-rose-700' : 'text-gray-500'}`}>{error || (problems.length ? `Falta ${problems.join(', ')}.` : '')}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-600 ring-1 ring-black/[0.08]">Cancelar</button>
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      {isMap ? (
        <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <AreaMap form={form} others={others} onPolygon={(geo) => setForm((p) => ({ ...p, polygonGeoJSON: geo }))} onError={setError} />
          <div className="border-t border-black/[0.06] p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">{fields}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-xl p-4 sm:p-6">{fields}</div>
      )}
    </WorkspaceDialog>
  )
}

/** Mapa de desenho: poligono, retangulo ou raio (vira poligono), com as outras areas de referencia. */
function AreaMap({ form, others, onPolygon, onError }: { form: DeliveryZonePayload; others: DeliveryZone[]; onPolygon: (geo: string | null) => void; onError: (msg: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.FeatureGroup | null>(null)
  const refGroupRef = useRef<L.FeatureGroup | null>(null)
  const fittedRef = useRef(false)
  const onPolygonRef = useRef(onPolygon)
  onPolygonRef.current = onPolygon
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ label: string; lat: number; lon: number }>>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12)
    mapRef.current = map
    const refGroup = new L.FeatureGroup().addTo(map)
    refGroupRef.current = refGroup
    L.control.layers(addBaseLayers(map), { 'Outras áreas': refGroup }, { position: 'topright' }).addTo(map)
    const drawn = new L.FeatureGroup().addTo(map)
    drawnRef.current = drawn

    const DrawControl = (L.Control as any)?.Draw
    const DrawEvent = (L as any)?.Draw?.Event
    if (!DrawControl || !DrawEvent) {
      onError('O editor do mapa não carregou. Recarregue a página.')
      return
    }
    fixLeafletDrawReadableArea()
    // leaflet-draw so fala ingles por padrao.
    const t = (L as any).drawLocal
    if (t) {
      t.draw.toolbar.actions = { title: 'Cancelar desenho', text: 'Cancelar' }
      t.draw.toolbar.finish = { title: 'Concluir desenho', text: 'Concluir' }
      t.draw.toolbar.undo = { title: 'Apagar último ponto', text: 'Apagar último ponto' }
      t.draw.toolbar.buttons = { polygon: 'Desenhar área livre', rectangle: 'Desenhar área retangular', circle: 'Desenhar raio a partir de um ponto' }
      t.draw.handlers.polygon = { tooltip: { start: 'Clique para começar a área.', cont: 'Clique para continuar a área.', end: 'Clique no primeiro ponto para fechar.' } }
      t.draw.handlers.rectangle = { tooltip: { start: 'Arraste para desenhar o retângulo.' } }
      t.draw.handlers.circle = { tooltip: { start: 'Clique no centro e arraste para definir o raio.' }, radius: 'Raio' }
      t.draw.handlers.simpleshape = { tooltip: { end: 'Solte o mouse para concluir.' } }
      t.edit.toolbar.actions = { save: { title: 'Salvar alterações', text: 'Salvar' }, cancel: { title: 'Descartar alterações', text: 'Cancelar' }, clearAll: { title: 'Limpar tudo', text: 'Limpar tudo' } }
      t.edit.toolbar.buttons = { edit: 'Editar área', editDisabled: 'Nenhuma área para editar', remove: 'Apagar área', removeDisabled: 'Nenhuma área para apagar' }
      t.edit.handlers.edit = { tooltip: { text: 'Arraste os pontos para ajustar a área.', subtext: 'Cancelar desfaz as alterações.' } }
      t.edit.handlers.remove = { tooltip: { text: 'Clique na área para apagá-la.' } }
    }
    map.addControl(
      new DrawControl({
        // Raio a partir da loja: cobertura inicial bem mais rapida que tracar a mao.
        draw: { polygon: true, circle: { metric: true, showRadius: true }, rectangle: true, polyline: false, circlemarker: false, marker: false },
        edit: { featureGroup: drawn, remove: true },
      }),
    )
    // Circulo e retangulo viram poligono: e o unico formato que o servidor casa com um endereco.
    map.on(DrawEvent.CREATED, (e: any) => {
      const layer = e.layer instanceof L.Circle ? L.polygon(circleToPolygonLatLngs(e.layer.getLatLng(), e.layer.getRadius())) : e.layer
      onPolygonRef.current(JSON.stringify(layer.toGeoJSON()))
    })
    map.on(DrawEvent.EDITED, (e: any) => {
      let edited: any = null
      e.layers.eachLayer((layer: any) => {
        edited = layer.toGeoJSON()
      })
      if (edited) onPolygonRef.current(JSON.stringify(edited))
    })
    map.on(DrawEvent.DELETED, () => onPolygonRef.current(null))
    // A janela abre animada: sem isso o mapa calcula o tamanho antes e fica cinza em parte.
    setTimeout(() => map.invalidateSize(), 150)
    return () => {
      map.remove()
      mapRef.current = null
      drawnRef.current = null
      refGroupRef.current = null
    }
  }, [onError])

  const own = useMemo(() => parsePolygonGeoJSON(form.polygonGeoJSON), [form.polygonGeoJSON])
  useEffect(() => {
    const map = mapRef.current
    const refGroup = refGroupRef.current
    const drawn = drawnRef.current
    if (!map || !refGroup || !drawn) return
    drawAreas(refGroup, others)
    drawn.clearLayers()
    if (own.length > 2) {
      const poly = L.polygon(own, { color: '#5D082A', fillColor: '#5D082A', fillOpacity: 0.15 })
      drawn.addLayer(poly)
      const feeNum = Number(String(form.fee))
      L.marker(poly.getBounds().getCenter(), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'zone-label',
          html: `<span style="border-color:#5D082A;color:#5D082A">${escapeHtml(form.name || 'Nova área')}${feeNum > 0 ? `<b>${formatFee(feeNum)}</b>` : ''}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(drawn)
      if (!fittedRef.current || !map.getBounds().intersects(poly.getBounds())) map.fitBounds(poly.getBounds(), { padding: [20, 20] })
      fittedRef.current = true
    } else if (!fittedRef.current) {
      // Area nova: abre enquadrando o que ja existe, nao num ponto vazio (so uma vez).
      const bounds = refGroup.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] })
      fittedRef.current = true
    }
  }, [own, others, form.name, form.fee])

  // Busca de endereco via Nominatim (OSM): gratis, sem chave; a politica proibe
  // autocomplete a cada tecla, por isso so no envio. Nao envia dado de cliente.
  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 3) return
    setSearching(true)
    setSearchError('')
    try {
      const params = new URLSearchParams({ format: 'json', q: query.trim(), limit: '5', countrycodes: 'br', 'accept-language': 'pt-BR' })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!response.ok) throw new Error(String(response.status))
      const found = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
      setResults(found.map((f) => ({ label: f.display_name, lat: Number(f.lat), lon: Number(f.lon) })))
      if (!found.length) setSearchError('Nenhum endereço encontrado.')
    } catch {
      setSearchError('Não deu para buscar agora. Confira a conexão e tente de novo.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="relative flex min-h-[55vh] flex-col lg:min-h-0">
      <form onSubmit={search} className="absolute left-12 right-3 top-3 z-[500] flex gap-2 sm:right-auto sm:w-80">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ir para bairro, rua ou cidade" aria-label="Buscar endereço no mapa" className="h-9 min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-white/95 px-3 text-sm shadow-sm focus:outline-none" />
        <button type="submit" disabled={searching || query.trim().length < 3} className="inline-flex h-9 items-center rounded-xl bg-white/95 px-3 text-gray-700 shadow-sm ring-1 ring-black/[0.1] disabled:opacity-50" aria-label="Buscar">
          <Search size={15} />
        </button>
      </form>
      {(results.length > 0 || searchError) && (
        <div className="absolute left-12 right-3 top-14 z-[500] overflow-hidden rounded-xl bg-white text-xs shadow-lg ring-1 ring-black/[0.08] sm:right-auto sm:w-80">
          {searchError && <p className="p-3 text-rose-700">{searchError}</p>}
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lon}`}
              type="button"
              onClick={() => {
                mapRef.current?.setView([r.lat, r.lon], 16)
                setResults([])
              }}
              className="block w-full border-b border-black/[0.05] px-3 py-2 text-left text-gray-700 last:border-0 hover:bg-gray-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <div ref={containerRef} className="flex-1" />
      <p className="border-t border-black/[0.06] px-3 py-2 text-[11px] text-gray-500">
        Desenhe com o polígono, o retângulo ou o raio (o mais rápido para começar). As outras áreas aparecem com nome e taxa; o satélite, no canto, ajuda a ver quarteirão e barreira.
      </p>
    </div>
  )
}
