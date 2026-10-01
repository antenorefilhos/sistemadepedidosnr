/**
 * GPS so faz sentido no aparelho que o cliente carrega consigo -- desktop
 * resolve geolocalizacao por Wi-Fi/IP e erra por quilometros mesmo "com
 * sucesso" (documentado em GPS_ACCURACY_THRESHOLD_M), e o numero da casa
 * nunca vem de GPS de qualquer forma, so decide rua/bairro/CEP. Testa
 * userAgent + touch, no padrao ja usado pra iOS em useNotifications.ts
 * (iPad em modo desktop se identifica como Mac no userAgent).
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

const DEVICE_ID_KEY = 'antenor_device_id'
const DEVICE_COOKIE = 'aef_did'

const readCookie = (name: string) => {
  try {
    return document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) || null
  } catch {
    return null
  }
}

/**
 * Identificador do aparelho (antifraude, 01/10/2026). Fica no localStorage e
 * num cookie de espelho: limpar so um dos dois nao gera aparelho "novo". Quem
 * limpa tudo continua reconhecivel pela impressao digital + rede, no servidor.
 */
export const getDeviceId = (): string => {
  let deviceId: string | null = null
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY)
  } catch {
    /* modo privado sem storage */
  }
  deviceId = deviceId || readCookie(DEVICE_COOKIE)
  if (!deviceId || !/^[\w.:-]{8,80}$/.test(deviceId)) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  }
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  } catch {
    /* idem */
  }
  try {
    document.cookie = `${DEVICE_COOKIE}=${deviceId}; Max-Age=34560000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  } catch {
    /* idem */
  }
  return deviceId
}
