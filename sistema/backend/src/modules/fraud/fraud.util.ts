import { isIP } from 'net'
import { isPrivateIp } from '../../common/real-client-ip'

/** O que o navegador conta do aparelho (cabecalhos X-Device-*, ver frontend/src/utils/device.ts). */
export type DeviceContext = {
  deviceId: string | null
  fingerprint: string | null
  automation: boolean
  ip: string | null
  country: string | null
}

const clean = (v: unknown, max = 80) => {
  const s = String(v ?? '').trim()
  return s && s.length <= max && /^[\w.:-]+$/.test(s) ? s : null
}

/** Le os sinais do aparelho de uma requisicao. IP de rede interna nao conta (nao identifica cliente). */
export function deviceContextFrom(req: { headers?: Record<string, unknown>; ip?: string } | undefined, bodyDeviceId?: string | null): DeviceContext {
  const h = (req?.headers || {}) as Record<string, unknown>
  const ip = req?.ip && isIP(req.ip.replace(/^::ffff:/i, '')) && !isPrivateIp(req.ip) ? req.ip.replace(/^::ffff:/i, '') : null
  const country = clean(h['cf-ipcountry'], 2)
  return {
    deviceId: clean(h['x-device-id']) || clean(bodyDeviceId),
    fingerprint: clean(h['x-device-fp'], 64),
    automation: String(h['x-device-bot'] || '') === '1',
    ip,
    country: country && country !== 'XX' ? country.toUpperCase() : null,
  }
}

/** Rede do cliente: /24 no IPv4, /48 no IPv6 (o 4G troca o final do IP a toda hora). */
export function ipNetwork(ip: string | null): string | null {
  if (!ip) return null
  if (isIP(ip) === 4) return ip.split('.').slice(0, 3).join('.')
  if (isIP(ip) === 6) return ip.split(':').slice(0, 3).join(':')
  return null
}

/**
 * Chave do aparelho: impressao digital + rede. A impressao digital sozinha
 * colide (iPhones do mesmo modelo geram a mesma); junto com a rede, liga com
 * seguranca o mesmo aparelho em contas diferentes.
 */
export function deviceKey(ctx: Pick<DeviceContext, 'fingerprint' | 'ip'>): string | null {
  const net = ipNetwork(ctx.ip)
  return ctx.fingerprint && net ? `${ctx.fingerprint}@${net}` : null
}

/** E-mail como caixa real: gmail ignora pontos e +sufixo; os demais, so o +sufixo. */
export function normalizeEmail(email?: string | null): string | null {
  const e = String(email || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return null
  let local = e.slice(0, at).split('+')[0]
  let domain = e.slice(at + 1)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return local ? `${local}@${domain}` : null
}

const STREET_PREFIX = /^(rua|r|avenida|av|estrada|estr|est|travessa|tv|trav|alameda|al|rodovia|rod|praca|pca|largo|lg|servidao|serv|beco|vila|condominio|cond)\b\.?\s*/
/** Endereco comparavel: CEP + rua sem tipo/acento/pontuacao + numero ("R. Sao Joao, 10" = "Rua São João 10"). */
export function addressKey(a: { zipCode?: string | null; street?: string | null; number?: string | null }): string | null {
  const cep = String(a.zipCode || '').replace(/\D/g, '')
  const street = String(a.street || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(STREET_PREFIX, '').trim()
  const number = String(a.number || '').replace(/\D/g, '') || String(a.number || '').trim().toLowerCase()
  return cep.length === 8 && street && number ? `${cep}|${street}|${number}` : null
}

// Provedores de e-mail descartavel mais usados (lista curta e estavel).
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'temp-mail.org', 'tempmail.com', 'yopmail.com', 'trashmail.com',
  'getnada.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'tempail.com', 'emailondeck.com',
  'mohmal.com', 'fakeinbox.com', 'throwawaymail.com', 'minuteinbox.com', 'mintemail.com', 'tempr.email', 'discard.email',
])
export const isDisposableEmail = (email?: string | null) => DISPOSABLE.has(String(email || '').split('@')[1]?.toLowerCase() || '')
