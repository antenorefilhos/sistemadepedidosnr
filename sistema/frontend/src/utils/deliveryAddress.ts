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