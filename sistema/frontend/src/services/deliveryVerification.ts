import { addressesAPI, deliveryAPI } from './api'
import {
  readDeliveryAddress,
  saveDeliveryAddress,
  type DeliveryAddressSnapshot,
} from '../utils/deliveryAddress'

export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || '').trim()

/**
 * Acima disso a leitura de geolocalizacao do navegador nao e confiavel pra
 * decidir zona por poligono -- desktop resolve por Wi-Fi/IP e erra por
 * quilometros mesmo com enableHighAccuracy, mas ainda retorna coordenada
 * "valida" (nao gera erro). GPS de celular real fica bem abaixo disso.
 */
export const GPS_ACCURACY_THRESHOLD_M = 150

const DELIVERY_VERIFICATION_STORAGE_KEY = 'antenor.deliveryVerification'
const DELIVERY_VERIFICATION_UPDATED_EVENT = 'delivery-verification-updated'

export interface DeliveryCalcSnapshot {
  fee: number | null
  freeAbove: number | null
  zoneName: string | null
  zoneId?: string | null
  isFree: boolean
  outOfArea: boolean
}

export interface DeliveryVerificationSnapshot {
  address: DeliveryAddressSnapshot
  calc: DeliveryCalcSnapshot
  verifiedAt: string
}

export function formatZipCode(value: string) {
  const clean = value.replace(/\D/g, '').slice(0, 8)
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean
}

function getMapboxContext(feature: any, prefix: string) {
  const context = Array.isArray(feature?.context) ? feature.context : []
  return context.find((c: any) => String(c?.id || '').startsWith(prefix))
}

export function normalizeMapboxContext(feature: any): DeliveryAddressSnapshot {
  const region = getMapboxContext(feature, 'region')
  const shortCode = String(region?.short_code || '')
  const state = shortCode.includes('-') ? shortCode.split('-')[1] : String(region?.text || '').slice(0, 2).toUpperCase()
  const postcode = String(getMapboxContext(feature, 'postcode')?.text || '').replace(/\D/g, '')

  return {
    street: String(feature?.text || ''),
    number: String(feature?.address || 's/n'),
    complement: null,
    neighborhood: String(getMapboxContext(feature, 'neighborhood')?.text || getMapboxContext(feature, 'locality')?.text || getMapboxContext(feature, 'district')?.text || ''),
    city: String(getMapboxContext(feature, 'place')?.text || ''),
    state: String(state || '').slice(0, 2).toUpperCase(),
    zipCode: formatZipCode(postcode || '00000000'),
  }
}

export async function requestCurrentPosition() {
  if (!('geolocation' in navigator)) throw new Error('geolocation-not-supported')

  return await new Promise<{ lat: number; lng: number; accuracy: number | null }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  })
}

export async function reverseGeocodeByMapbox(lat: number, lng: number): Promise<DeliveryAddressSnapshot> {
  if (!MAPBOX_TOKEN) throw new Error('mapbox-token-missing')

  // Mapbox usa [longitude, latitude]
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&country=BR&language=pt&limit=1`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('mapbox-reverse-failed')

  const data = await resp.json()
  const feature = data?.features?.[0]
  if (!feature) throw new Error('mapbox-reverse-empty')

  return normalizeMapboxContext(feature)
}

export async function fetchAddressByCep(cep: string, prev?: Partial<DeliveryAddressSnapshot>) {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) throw new Error('invalid-cep')

  const res = await addressesAPI.searchCEP(clean)
  const d = res.data

  return {
    street: d.street || prev?.street || '',
    number: prev?.number || '',
    complement: prev?.complement || null,
    neighborhood: d.neighborhood || prev?.neighborhood || '',
    city: d.city || prev?.city || '',
    state: d.state || prev?.state || '',
    zipCode: formatZipCode(clean),
  } satisfies DeliveryAddressSnapshot
}

export async function forwardGeocodeAddressByMapbox(address: DeliveryAddressSnapshot) {
  if (!MAPBOX_TOKEN) throw new Error('mapbox-token-missing')

  const q = [
    `${address.street}, ${address.number || 's/n'}`,
    address.neighborhood,
    `${address.city} - ${address.state}`,
    address.zipCode,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=BR&language=pt&limit=1&autocomplete=false`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('mapbox-forward-failed')

  const data = await resp.json()
  const feature = data?.features?.[0]
  const coords = feature?.center
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('mapbox-forward-empty')

  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('mapbox-forward-invalid-coords')

  return { lat: Number(lat), lng: Number(lng) }
}

export async function verifyDeliveryForAddress(address: DeliveryAddressSnapshot): Promise<DeliveryCalcSnapshot> {
  const zipCode = address.zipCode?.trim() || undefined

  // A API pode omitir outOfArea; normalizamos aqui num unico ponto.
  const toSnapshot = (data: Omit<DeliveryCalcSnapshot, 'outOfArea'> & { outOfArea?: boolean }) => {
    const { fee, freeAbove, zoneName, zoneId, isFree, outOfArea } = data
    return { fee, freeAbove, zoneName, zoneId, isFree, outOfArea: Boolean(outOfArea || fee == null || fee === -1) }
  }

  // Posicao do proprio aparelho vence: e a unica exata. Geocodificar o endereco
  // devolveria o centroide da via, que numa rua de divisa cai do lado errado da
  // zona. Coordenada so chega aqui vinda do GPS, e `dropStaleCoords` a descarta
  // se o cliente editar o endereco depois.
  if (address.lat != null && address.lng != null) {
    const res = await deliveryAPI.calculate(zipCode, address.lat, address.lng)
    return toSnapshot(res.data)
  }

  if (!MAPBOX_TOKEN) {
    const res = await deliveryAPI.calculate(zipCode)
    return toSnapshot(res.data)
  }

  try {
    const coords = await forwardGeocodeAddressByMapbox(address)
    const res = await deliveryAPI.calculate(zipCode, coords.lat, coords.lng)
    return toSnapshot(res.data)
  } catch {
    // Mapbox fora do ar nao pode impedir a compra: sem coordenada o backend
    // ainda resolve por faixa de CEP.
    const res = await deliveryAPI.calculate(zipCode)
    return toSnapshot(res.data)
  }
}

export function saveDeliveryVerification(snapshot: DeliveryVerificationSnapshot) {
  if (typeof window === 'undefined') return
  saveDeliveryAddress(snapshot.address)
  localStorage.setItem(DELIVERY_VERIFICATION_STORAGE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new Event(DELIVERY_VERIFICATION_UPDATED_EVENT))
}

export function readDeliveryVerification(): DeliveryVerificationSnapshot | null {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(DELIVERY_VERIFICATION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as DeliveryVerificationSnapshot
    if (!parsed?.address || !parsed?.calc) return null
    return parsed
  } catch {
    return null
  }
}

export function subscribeDeliveryVerification(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  const onStorage = (event: StorageEvent) => {
    if (event.key === DELIVERY_VERIFICATION_STORAGE_KEY) onChange()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(DELIVERY_VERIFICATION_UPDATED_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(DELIVERY_VERIFICATION_UPDATED_EVENT, onChange)
  }
}

export function readInitialDeliveryAddress() {
  return readDeliveryAddress()
}
