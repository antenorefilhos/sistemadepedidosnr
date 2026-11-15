import { Injectable } from '@nestjs/common'
import { createHash } from 'crypto'
import { winstonLogger } from '../../common/logger'

/**
 * API de Conversoes da Meta (15/11/2026): manda o Purchase tambem pelo servidor,
 * com o MESMO event_id do pixel do navegador, para a Meta deduplicar. Cobre o que o
 * navegador perde (bloqueador, navegador interno do Instagram/WhatsApp, aba fechada
 * antes do pixel disparar): ate 14/11 o pixel recebeu 2 Purchase para 4 pedidos reais.
 *
 * Contrato com o navegador (frontend/src/utils/analytics.ts, trackPurchase):
 *   event_name = 'Purchase', event_id = id do pedido, value = order.total, BRL.
 * Se mudar um lado, mude o outro: sem o mesmo event_id e o mesmo event_name a Meta
 * conta duas compras.
 *
 * Variaveis de ambiente (todas opcionais; sem o token o envio vira no-op e o checkout
 * segue igual):
 *   META_CAPI_ACCESS_TOKEN     credencial (Gerenciador de Eventos > pixel > Configuracoes >
 *                              API de Conversoes > Gerar token). Nunca vai para o repo.
 *   META_PIXEL_ID              padrao: o pixel que a loja ja publica no index.html.
 *   META_CAPI_TEST_EVENT_CODE  codigo da aba "Testar eventos"; com ele a Meta mostra o
 *                              evento so la e nao usa para anuncios. Remover depois do teste.
 *   META_GRAPH_VERSION         padrao v25.0.
 *
 * Nunca lanca excecao: marketing nao pode derrubar ou atrasar checkout. Os logs saem
 * pelo winstonLogger (o Logger do Nest e descartado em producao, ver main.ts).
 */

const DEFAULT_PIXEL_ID = '2308084703100170'
const DEFAULT_GRAPH_VERSION = 'v25.0'
const REQUEST_TIMEOUT_MS = 5000

export interface MetaBrowserContext {
  /** Cookie _fbp do navegador. */
  fbp?: string
  /** Cookie _fbc (ou fbclid montado) do navegador. */
  fbc?: string
  /** URL da pagina onde a compra foi feita. */
  eventSourceUrl?: string
  clientIp?: string
  userAgent?: string
}

export interface MetaPurchaseOrder {
  id: string
  total: number
  createdAt?: Date | string | null
  customerId?: string | null
  customer?: { name?: string | null; email?: string | null; whatsapp?: string | null } | null
  items: Array<{ productId: string; quantity: number; unitPrice: number; subtotal?: number | null }>
}

export interface MetaSendResult {
  sent: boolean
  reason?: string
  eventsReceived?: number
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

export function normalizeEmail(email?: string | null): string | null {
  const v = String(email || '').trim().toLowerCase()
  return v.includes('@') ? v : null
}

/** Digitos com codigo do pais, sem zeros a esquerda: 24999998888 -> 5524999998888. */
export function normalizePhone(phone?: string | null): string | null {
  let digits = String(phone || '').replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length < 10) return null
  // Celular/fixo brasileiro sem DDI (10 ou 11 digitos): prefixa 55.
  if (digits.length <= 11) digits = `55${digits}`
  return digits
}

/** Minusculas, sem acento e sem pontuacao (a Meta pede a grafia romana). */
export function normalizeName(name?: string | null): string | null {
  const v = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return v || null
}

export function splitName(name?: string | null): { first: string | null; last: string | null } {
  const v = normalizeName(name)
  if (!v) return { first: null, last: null }
  const parts = v.split(' ')
  return { first: parts[0] || null, last: parts.length > 1 ? parts[parts.length - 1] : null }
}

const money = (n: number) => Math.round(n * 100) / 100

/**
 * Itens do pedido no formato da Meta. Item pesavel (quantidade fracionada, ex.: 0,8 kg)
 * entra como 1 unidade pelo valor da linha, porque a Meta espera quantidade inteira.
 * Mesma regra do navegador (analytics.ts, buildPurchaseParams).
 */
export function buildContents(items: MetaPurchaseOrder['items']) {
  const contents = items.map((item) => {
    const qty = Number(item.quantity) || 0
    const line = item.subtotal != null ? Number(item.subtotal) : qty * Number(item.unitPrice)
    return Number.isInteger(qty) && qty > 0
      ? { id: item.productId, quantity: qty, item_price: money(Number(item.unitPrice)) }
      : { id: item.productId, quantity: 1, item_price: money(line) }
  })
  return {
    content_ids: [...new Set(contents.map((c) => c.id))],
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
  }
}

@Injectable()
export class MetaConversionsService {
  private warnedNoToken = false

  isConfigured(): boolean {
    return Boolean(process.env.META_CAPI_ACCESS_TOKEN)
  }

  /** Monta o evento sem enviar (exposto para teste e para conferencia manual). */
  buildPurchaseEvent(order: MetaPurchaseOrder, ctx: MetaBrowserContext = {}) {
    const created = order.createdAt ? new Date(order.createdAt) : new Date()
    const eventTime = Math.floor((Number.isNaN(created.getTime()) ? Date.now() : created.getTime()) / 1000)

    const email = normalizeEmail(order.customer?.email)
    const phone = normalizePhone(order.customer?.whatsapp)
    const { first, last } = splitName(order.customer?.name)

    const userData: Record<string, unknown> = {
      country: [sha256('br')],
      // Estes quatro NAO vao em hash: a Meta exige o valor cru.
      client_ip_address: ctx.clientIp || undefined,
      client_user_agent: ctx.userAgent || undefined,
      fbp: ctx.fbp || undefined,
      fbc: ctx.fbc || undefined,
    }
    if (email) userData.em = [sha256(email)]
    if (phone) userData.ph = [sha256(phone)]
    if (first) userData.fn = [sha256(first)]
    if (last) userData.ln = [sha256(last)]
    if (order.customerId) userData.external_id = [sha256(order.customerId)]

    return {
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: order.id,
      action_source: 'website',
      event_source_url: ctx.eventSourceUrl || undefined,
      user_data: userData,
      custom_data: {
        currency: 'BRL',
        value: money(Number(order.total)),
        content_type: 'product',
        order_id: order.id,
        ...buildContents(order.items),
      },
    }
  }

  async sendPurchase(order: MetaPurchaseOrder, ctx: MetaBrowserContext = {}): Promise<MetaSendResult> {
    try {
      const token = process.env.META_CAPI_ACCESS_TOKEN
      if (!token) {
        if (!this.warnedNoToken) {
          this.warnedNoToken = true
          winstonLogger.warn('meta_capi_desligada', { motivo: 'META_CAPI_ACCESS_TOKEN vazio: Purchase so sai pelo navegador' })
        }
        return { sent: false, reason: 'sem_token' }
      }

      const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID
      const version = process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION
      const testCode = process.env.META_CAPI_TEST_EVENT_CODE || undefined
      // Token no corpo, nao na URL: URL cai em log de proxy.
      const body = JSON.stringify({ data: [this.buildPurchaseEvent(order, ctx)], access_token: token, test_event_code: testCode })

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      const json = (await res.json().catch(() => ({}))) as {
        events_received?: number
        fbtrace_id?: string
        error?: { message?: string; code?: number; error_subcode?: number }
      }
      if (!res.ok) {
        winstonLogger.warn('meta_capi_recusada', {
          orderId: order.id,
          status: res.status,
          code: json.error?.code,
          subcode: json.error?.error_subcode,
          message: json.error?.message,
          fbtrace_id: json.fbtrace_id,
        })
        return { sent: false, reason: `http_${res.status}` }
      }
      winstonLogger.info('meta_capi_enviada', { orderId: order.id, eventsReceived: json.events_received, fbtrace_id: json.fbtrace_id, teste: Boolean(testCode) })
      return { sent: true, eventsReceived: json.events_received }
    } catch (error) {
      winstonLogger.warn('meta_capi_falhou', { orderId: order.id, erro: error instanceof Error ? error.message : String(error) })
      return { sent: false, reason: 'erro' }
    }
  }
}
