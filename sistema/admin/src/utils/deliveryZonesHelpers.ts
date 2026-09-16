import type { DeliveryZonePayload, FulfillmentSlotOccupancy } from '../services/api'
import L from 'leaflet'

const AREA_PRECISION: Record<string, number> = { km: 2, ha: 2, m: 0, mi: 2, ac: 2, yd: 0, ft: 0, nm: 2 }

/**
 * Corrige um bug do leaflet-draw 1.0.4 (versao fixada aqui).
 *
 * `L.GeometryUtil.readableArea` faz `type = typeof isMetric` sem declarar
 * `type`. Em script solto isso criaria uma global silenciosa; modulo ES roda
 * sempre em strict mode e lanca `ReferenceError: type is not defined`, matando
 * o handler de desenho no primeiro mousemove. Na pratica o retangulo congelava
 * num ponto, e so dava para ajustar entrando em "Editar area" e separando os
 * vertices empilhados um a um.
 *
 * Atingia so o retangulo: e o unico com `showArea: true` por padrao — o
 * poligono vem `false` e o circulo usa `readableDistance`. Passar
 * `showArea: false` mascararia este caso e deixaria a funcao quebrada para
 * qualquer outro caminho, entao a correcao vai na origem.
 *
 * Precisa ser chamada de dentro de codigo que executa (o efeito do mapa): como
 * bloco solto no topo do modulo, o bundler descarta por parecer sem efeito.
 */
export function fixLeafletDrawReadableArea() {
  const geometryUtil = (L as any).GeometryUtil
  if (!geometryUtil?.readableArea || geometryUtil.__readableAreaFixed) return

  geometryUtil.readableArea = function (
    area: number,
    isMetric: boolean | string | string[],
    precision?: Record<string, number>,
  ) {
    const digits = { ...AREA_PRECISION, ...(precision || {}) }
    const format = (value: number, casas: number) => geometryUtil.formattedNumber(value, casas)

    if (isMetric) {
      let units = ['ha', 'm']
      const type = typeof isMetric
      if (type === 'string') units = [isMetric as string]
      else if (type !== 'boolean') units = isMetric as string[]

      if (area >= 1000000 && units.indexOf('km') !== -1) return `${format(area * 0.000001, digits.km)} km²`
      if (area >= 10000 && units.indexOf('ha') !== -1) return `${format(area * 0.0001, digits.ha)} ha`
      return `${format(area, digits.m)} m²`
    }

    const squareYards = area / 0.836127
    if (squareYards >= 3097600) return `${format(squareYards / 3097600, digits.mi)} mi²`
    if (squareYards >= 4840) return `${format(squareYards / 4840, digits.ac)} acres`
    return `${format(squareYards, digits.yd)} yd²`
  }

  geometryUtil.__readableAreaFixed = true
}

export type Tab = 'zones' | 'slots' | 'rules'

export const EMPTY_FORM: DeliveryZonePayload = {
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

export const EMPTY_SLOT_FORM = {
  type: 'DELIVERY' as 'DELIVERY' | 'PICKUP',
  startsAt: '',
  endsAt: '',
  capacityOrders: 10,
  capacityItems: '',
  cutoffMinutes: 30,
}

export const DEFAULT_CENTER: [number, number] = [-22.313628, -43.130604]
export const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, USGS, OpenStreetMap contributors'
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

/**
 * Mapas base disponiveis no seletor. Todos gratuitos e sem chave de API.
 *
 * "Satelite" e o mais util para desenhar zona de entrega: da para ver quarteirao,
 * condominio e barreira fisica (rio, morro) que o mapa de ruas nao mostra. Como
 * imagem de satelite nao tem nome de rua, ele vem com uma camada de rotulos por
 * cima. "Claro" deixa o poligono colorido saltar, bom para conferir cobertura.
 */
export const BASEMAPS: Record<string, { label: string; url: string; attribution: string; labelsOverlay?: string }> = {
  ruas: {
    label: 'Ruas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
  },
  satelite: {
    label: 'Satelite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
    labelsOverlay:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  claro: {
    label: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
  },
  escuro: {
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTRIBUTION,
  },
}

export const BASEMAP_STORAGE_KEY = 'antenor.deliveryZones.basemap'

/** Cores das zonas ja cadastradas exibidas como referencia (nao editaveis). */
export const REFERENCE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2']

export const EARTH_RADIUS_M = 6378137

/**
 * O rotulo da zona vai para dentro de um L.divIcon, que recebe HTML cru. O nome
 * e digitado pelo operador, entao precisa ser escapado — senao vira XSS
 * armazenado no admin.
 */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Converte um circulo desenhado no mapa em poligono.
 *
 * O backend so entende GeoJSON `Polygon` (ver `parsePolygonFeature` no
 * DeliveryService). O `toGeoJSON()` de um L.Circle devolve um `Point` com a
 * propriedade `radius` — que seria aceito no cadastro e depois NUNCA casaria com
 * endereco nenhum, sem erro visivel. Por isso o raio vira poligono aqui, no
 * momento do desenho: o que trafega e persiste e sempre um poligono comum.
 */
export function circleToPolygonLatLngs(center: L.LatLng, radiusMeters: number, segments = 64): Array<[number, number]> {
  const latRad = (center.lat * Math.PI) / 180
  const dLat = ((radiusMeters / EARTH_RADIUS_M) * 180) / Math.PI
  const dLng = ((radiusMeters / (EARTH_RADIUS_M * Math.cos(latRad))) * 180) / Math.PI

  const points: Array<[number, number]> = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI
    points.push([center.lat + dLat * Math.sin(theta), center.lng + dLng * Math.cos(theta)])
  }
  points.push(points[0]) // anel fechado, exigido pelo GeoJSON
  return points
}

export const SLOTS_PER_PAGE = 10

export function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/**
 * A API devolve valores monetarios como string (Decimal do Prisma), mas o tipo
 * declarava `number` — e `String.prototype.toLocaleString` ignora as opcoes de
 * moeda em silencio, entao a taxa aparecia como "150" e "8.9" em vez de
 * "R$ 150,00" e "R$ 8,90". Coagimos aqui para nao depender da anotacao.
 */
export function formatFee(value: number | string | null | undefined) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return amount === 0
    ? 'Gratis'
    : amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatWindow(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function slotLabel(slot: FulfillmentSlotOccupancy) {
  return slot.type === 'PICKUP' ? 'Retirada' : 'Entrega'
}

export function localToIso(local: string): string {
  return new Date(local).toISOString()
}

export function isoToLocal(iso: string): string {
  const d = new Date(iso)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 16)
}

export function parsePolygonGeoJSON(raw: string | null | undefined): Array<[number, number]> {
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
