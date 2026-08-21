import { addressesAPI, deliveryAPI, type DeliveryLocalityOption } from './api'
import {
  readDeliveryAddress,
  saveDeliveryAddress,
  clearDeliveryAddress,
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
  /**
   * Coordenada que decidiu esse resultado (do GPS ou do geocode do endereco
   * pelo Mapbox) -- precisa ser reenviada pro backend na criacao da sessao
   * de checkout, senao o calculo la so tem o CEP e nunca bate com zona por
   * poligono. Ver Checkout.tsx (getDeliveryPayload).
   */
  lat?: number | null
  lng?: number | null
  /**
   * CEP com mais de um ponto mapeado na planilha de balcao (ex.: 25750-222
   * cobre de Chafariz a Cond. Bosque das Mangueiras) -- true enquanto o
   * cliente ainda nao escolheu qual dos pontos e o dele. `fee` acima fica
   * como estimativa (a menor taxa do grupo) ate a escolha.
   */
  requiresLocalitySelection?: boolean
  availableLocalities?: DeliveryLocalityOption[]
  locality?: string | null
  deliveryPointCode?: string | null
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

/** Normaliza a resposta crua de deliveryAPI.calculate() num DeliveryCalcSnapshot
 * -- repetido em 3 pontos de captura de CEP/localidade (modal de entrega e
 * checkout) antes de virar essa funcao unica. */
export function mapDeliveryCalcResponse(
  data: {
    fee: number | null
    freeAbove: number | null
    zoneName: string | null
    zoneId: string | null
    isFree: boolean
    outOfArea?: boolean
    requiresLocalitySelection?: boolean
    availableLocalities?: DeliveryLocalityOption[]
  },
  overrides?: { locality?: string | null; deliveryPointCode?: string | null },
): DeliveryCalcSnapshot {
  return {
    fee: data.fee,
    freeAbove: data.freeAbove,
    zoneName: data.zoneName,
    zoneId: data.zoneId,
    isFree: data.isFree,
    outOfArea: Boolean(data.outOfArea || data.fee == null),
    lat: null,
    lng: null,
    requiresLocalitySelection: Boolean(data.requiresLocalitySelection),
    availableLocalities: data.availableLocalities || [],
    locality: overrides?.locality ?? null,
    deliveryPointCode: overrides?.deliveryPointCode ?? null,
  }
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
    number: String(feature?.address || ''),
    complement: null,
    neighborhood: String(getMapboxContext(feature, 'neighborhood')?.text || getMapboxContext(feature, 'locality')?.text || getMapboxContext(feature, 'district')?.text || ''),
    city: String(getMapboxContext(feature, 'place')?.text || ''),
    state: String(state || '').slice(0, 2).toUpperCase(),
    zipCode: formatZipCode(postcode || '00000000'),
  }
}

type GeolocationResult = { lat: number; lng: number; accuracy: number | null }

function getPosition(options: PositionOptions): Promise<GeolocationResult> {
  return new Promise<GeolocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }),
      (error) => reject(error),
      options,
    )
  })
}

export async function requestCurrentPosition() {
  if (!('geolocation' in navigator)) throw new Error('geolocation-not-supported')

  try {
    return await getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 })
  } catch (error: any) {
    // Permissao negada e definitiva -- repetir so atrasa o aviso pro cliente.
    if (error?.code === 1) throw error

    // Desktop/Windows sem GPS real costuma estourar TIMEOUT ou responder
    // POSITION_UNAVAILABLE no modo de alta precisao, e resolver na hora por
    // Wi-Fi/IP. A coordenada vem menos precisa, mas
    // GPS_ACCURACY_THRESHOLD_M ja descarta ela pra decisao de zona -- aqui
    // ela ainda serve pra preencher o endereco em vez de nao entregar nada.
    return await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 })
  }
}

/**
 * Traduz erro de geolocalizacao/geocode na orientacao que o cliente precisa.
 * Sem isso, "permissao negada" (que so ele resolve, no navegador ou no
 * Windows) e "Mapbox fora do ar" (que ele nao pode resolver) mostravam a
 * mesma frase generica.
 */
export function describeGeolocationError(error: any): string {
  switch (error?.code) {
    case 1:
      return 'Permissão de localização negada no navegador ou desativada no Windows. Ative nas configurações ou digite seu CEP abaixo.'
    case 2:
      return 'Não foi possível determinar sua localização: o serviço de localização do aparelho está indisponível. Digite seu CEP abaixo.'
    case 3:
      return 'A busca pela sua localização demorou demais. Tente de novo ou digite seu CEP abaixo.'
    default:
      break
  }

  const message = String(error?.message || '')
  if (message.startsWith('mapbox-')) {
    return 'Encontramos sua localização, mas não conseguimos converter em endereço agora. Digite seu CEP abaixo.'
  }
  if (message === 'geolocation-not-supported') {
    return 'Este navegador não tem localização automática. Digite seu CEP abaixo.'
  }
  return 'Não foi possível obter sua localização. Digite seu CEP abaixo.'
}

/** Geocodificacao reversa: tenta a base local do IBGE primeiro (instantanea,
 * gratuita, com numero predial real -- so cobre Petropolis) e cai pro
 * Mapbox se nao achar nada num raio de 100m (cliente fora da area, ou GPS
 * impreciso o suficiente pra nao bater com nenhum ponto do CNEFE). */
export async function reverseGeocode(lat: number, lng: number): Promise<DeliveryAddressSnapshot> {
  try {
    const res = await deliveryAPI.ibgeReverse(lat, lng)
    const match = res.data
    if (match) {
      return {
        street: match.logradouro,
        number: match.numero || '',
        complement: null,
        neighborhood: match.bairro,
        city: 'Petrópolis',
        state: 'RJ',
        zipCode: formatZipCode(match.cep),
      }
    }
  } catch {
    // Base local fora do ar ou sem match -- segue pro Mapbox normalmente.
  }
  return reverseGeocodeByMapbox(lat, lng)
}

/** Fallback do Mapbox, usado internamente por reverseGeocode() quando a base
 * local do IBGE nao acha nada no raio (cliente fora de Petropolis, ou GPS
 * impreciso). Nao exportada -- desde a integracao do IBGE, nenhuma chamada
 * de GPS no app chama isso direto, sempre via reverseGeocode(). */
async function reverseGeocodeByMapbox(lat: number, lng: number): Promise<DeliveryAddressSnapshot> {
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

export async function verifyDeliveryForAddress(
  address: DeliveryAddressSnapshot,
  // Sem isto o preview da etapa de endereco nunca reconhece frete gratis --
  // o backend so aplica freeAbove quando recebe o subtotal (calculate() sem
  // ele sempre devolve isFree:false). O valor real cobrado ja calculava
  // certo depois, mas o cliente via a taxa cheia antes da hora.
  subtotal?: number,
): Promise<DeliveryCalcSnapshot> {
  const zipCode = address.zipCode?.trim() || undefined
  const locality = address.locality?.trim() || undefined
  const deliveryPointCode = address.deliveryPointCode?.trim() || undefined

  // A API pode omitir outOfArea; normalizamos aqui num unico ponto. Guarda
  // tambem a coordenada que decidiu o resultado -- o checkout precisa dela
  // pra criar a sessao com o mesmo calculo, nao so o CEP (ver getDeliveryPayload).
  const toSnapshot = (
    data: Omit<DeliveryCalcSnapshot, 'outOfArea' | 'lat' | 'lng'> & { outOfArea?: boolean },
    coords?: { lat: number; lng: number } | null,
  ) => {
    const { fee, freeAbove, zoneName, zoneId, isFree, outOfArea, requiresLocalitySelection, availableLocalities } = data
    return {
      fee,
      freeAbove,
      zoneName,
      zoneId,
      isFree,
      outOfArea: Boolean(outOfArea || fee == null || fee === -1),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      requiresLocalitySelection: Boolean(requiresLocalitySelection),
      availableLocalities: availableLocalities || [],
      locality: locality || null,
      deliveryPointCode: deliveryPointCode || null,
    }
  }

  // Posicao do proprio aparelho vence: e a unica exata. Geocodificar o endereco
  // devolveria o centroide da via, que numa rua de divisa cai do lado errado da
  // zona. Coordenada so chega aqui vinda do GPS, e `dropStaleCoords` a descarta
  // se o cliente editar o endereco depois.
  if (address.lat != null && address.lng != null) {
    const res = await deliveryAPI.calculate(zipCode, address.lat, address.lng, subtotal, locality, deliveryPointCode)
    return toSnapshot(res.data, { lat: address.lat, lng: address.lng })
  }

  if (!MAPBOX_TOKEN) {
    const res = await deliveryAPI.calculate(zipCode, undefined, undefined, subtotal, locality, deliveryPointCode)
    return toSnapshot(res.data)
  }

  try {
    const coords = await forwardGeocodeAddressByMapbox(address)
    const res = await deliveryAPI.calculate(zipCode, coords.lat, coords.lng, subtotal, locality, deliveryPointCode)
    return toSnapshot(res.data, coords)
  } catch {
    // Mapbox fora do ar nao pode impedir a compra: sem coordenada o backend
    // ainda resolve por faixa de CEP.
    const res = await deliveryAPI.calculate(zipCode, undefined, undefined, subtotal, locality, deliveryPointCode)
    return toSnapshot(res.data)
  }
}

export function saveDeliveryVerification(snapshot: DeliveryVerificationSnapshot) {
  if (typeof window === 'undefined') return
  saveDeliveryAddress(snapshot.address)
  localStorage.setItem(DELIVERY_VERIFICATION_STORAGE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new Event(DELIVERY_VERIFICATION_UPDATED_EVENT))
}

/** Remove o endereco verificado e o endereco salvo do localStorage. */
export function clearDeliveryVerification() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DELIVERY_VERIFICATION_STORAGE_KEY)
  clearDeliveryAddress()
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
