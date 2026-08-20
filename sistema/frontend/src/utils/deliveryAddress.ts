export const DELIVERY_ADDRESS_STORAGE_KEY = 'antenor.deliveryAddress'
const DELIVERY_ADDRESS_UPDATED_EVENT = 'delivery-address-updated'

export interface DeliveryAddressSnapshot {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  /**
   * Posicao exata do aparelho, quando o cliente usou a localizacao automatica.
   *
   * Existe para o teste de zona por poligono: sem ela o calculo do frete usa o
   * centroide do endereco geocodificado, o que em rua de divisa joga o cliente
   * para o lado errado da zona. So e preenchida pelo GPS — endereco digitado
   * nao tem posicao confiavel.
   */
  lat?: number | null
  lng?: number | null
  /**
   * CEP com mais de um ponto de entrega mapeado (ver DeliveryCalcSnapshot em
   * deliveryVerification.ts) -- localidade/condominio escolhido pelo
   * cliente no seletor, reenviado ao recalcular o frete e ao criar a sessao
   * de checkout.
   */
  locality?: string | null
  deliveryPointCode?: string | null
}

/**
 * Campos que, se o cliente editar, invalidam a posicao do GPS.
 *
 * Detectar a localizacao e depois corrigir a rua na mao e comum; manter as
 * coordenadas antigas cobraria o frete do lugar errado, calado.
 */
const ADDRESS_IDENTITY_FIELDS = ['street', 'number', 'neighborhood', 'city', 'state', 'zipCode'] as const

/** Descarta lat/lng e a localidade escolhida quando algum campo de
 * identidade do endereco mudou (ex.: editar o CEP invalida a escolha de
 * ponto de entrega feita pro CEP antigo). */
export const dropStaleCoords = (
  next: DeliveryAddressSnapshot,
  previous?: DeliveryAddressSnapshot | null,
): DeliveryAddressSnapshot => {
  if (!previous) return next

  const changed = ADDRESS_IDENTITY_FIELDS.some(
    (field) => String(next[field] ?? '').trim() !== String(previous[field] ?? '').trim(),
  )
  if (!changed) return next

  const dropsCoords = next.lat != null && next.lng != null
  const dropsLocality = next.locality != null || next.deliveryPointCode != null
  if (!dropsCoords && !dropsLocality) return next

  return {
    ...next,
    ...(dropsCoords ? { lat: null, lng: null } : {}),
    ...(dropsLocality ? { locality: null, deliveryPointCode: null } : {}),
  }
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isDeliveryAddressSnapshot = (value: unknown): value is DeliveryAddressSnapshot => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeliveryAddressSnapshot>

  return (
    isNonEmptyString(candidate.street) &&
    isNonEmptyString(candidate.number) &&
    isNonEmptyString(candidate.neighborhood) &&
    isNonEmptyString(candidate.city) &&
    isNonEmptyString(candidate.state) &&
    isNonEmptyString(candidate.zipCode)
  )
}

export const saveDeliveryAddress = (address: DeliveryAddressSnapshot) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(DELIVERY_ADDRESS_STORAGE_KEY, JSON.stringify(address))
  window.dispatchEvent(new Event(DELIVERY_ADDRESS_UPDATED_EVENT))
}

export const readDeliveryAddress = (): DeliveryAddressSnapshot | null => {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(DELIVERY_ADDRESS_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return isDeliveryAddressSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const subscribeDeliveryAddress = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => undefined

  const onStorage = (event: StorageEvent) => {
    if (event.key === DELIVERY_ADDRESS_STORAGE_KEY) {
      onChange()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(DELIVERY_ADDRESS_UPDATED_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(DELIVERY_ADDRESS_UPDATED_EVENT, onChange)
  }
}

export const formatDeliveryAddressLabel = (address: DeliveryAddressSnapshot) => {
  const complementPart = address.complement?.trim() ? `, ${address.complement.trim()}` : ''
  return `${address.street}, ${address.number}${complementPart} - ${address.neighborhood}`
}