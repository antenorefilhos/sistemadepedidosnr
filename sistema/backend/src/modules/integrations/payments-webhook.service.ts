import { Injectable, Logger } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { PaymentsLedgerService } from './payments-ledger.service'

export type WebhookEventType =
  | 'charge.authorized'
  | 'charge.captured'
  | 'charge.paid'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.chargeback'
  | 'payment.authorized'
  | 'payment.captured'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.refunded'
  | 'payment.chargeback'
  | string

export interface WebhookPayload {
  eventId?: string
  event: WebhookEventType
  chargeId: string
  orderId?: string
  provider?: string
  method?: string
  status: string
  amount?: number
  paidAt?: string
  metadata?: Record<string, unknown>
  data?: Record<string, unknown>
}

// Pedido nesses estados nunca deve ser mexido por webhook de pagamento --
// ver comentario no processEvent (JON-134).
const FINAL_ORDER_STATUSES = ['CANCELLED', 'COMPLETED', 'DELIVERED', 'REFUNDED', 'FAILED_SYNC']

const EVENT_STATUS_MAP: Record<string, string> = {
  'charge.authorized': 'CONFIRMED',
  'payment.authorized': 'CONFIRMED',
  'charge.captured': 'CONFIRMED',
  'payment.captured': 'CONFIRMED',
  'charge.paid': 'CONFIRMED',
  'payment.paid': 'CONFIRMED',
  'charge.failed': 'CANCELLED',
  'payment.failed': 'CANCELLED',
  'charge.refunded': 'CANCELLED',
  'payment.refunded': 'CANCELLED',
  'charge.chargeback': 'CANCELLED',
  'payment.chargeback': 'CANCELLED',
}

const EVENT_PAYMENT_STATUS_MAP: Record<string, string> = {
  'charge.authorized': 'AUTHORIZED',
  'payment.authorized': 'AUTHORIZED',
  'charge.captured': 'PAID',
  'payment.captured': 'PAID',
  'charge.paid': 'PAID',
  'payment.paid': 'PAID',
  'charge.failed': 'FAILED',
  'payment.failed': 'FAILED',
  'charge.refunded': 'REFUNDED',
  'payment.refunded': 'REFUNDED',
  'charge.chargeback': 'CHARGEBACK',
  'payment.chargeback': 'CHARGEBACK',
}

const EVENT_TRANSACTION_STATUS_MAP: Record<string, string> = {
  'charge.authorized': 'AUTHORIZED',
  'payment.authorized': 'AUTHORIZED',
  'charge.captured': 'CAPTURED',
  'payment.captured': 'CAPTURED',
  'charge.paid': 'CAPTURED',
  'payment.paid': 'CAPTURED',
  'charge.failed': 'FAILED',
  'payment.failed': 'FAILED',
  'charge.refunded': 'REFUNDED',
  'payment.refunded': 'REFUNDED',
  'charge.chargeback': 'CHARGEBACK',
  'payment.chargeback': 'CHARGEBACK',
}

@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name)

  constructor(
    private prisma: PrismaService,
    private paymentsLedger: PaymentsLedgerService,
  ) {}

  private get webhookSecret(): string {
    return process.env.PAYMENTS_WEBHOOK_SECRET || ''
  }

  private get gatewayActive(): boolean {
    return ['ENABLE_PAYMENTS_INTEGRATION', 'INTEGRATION_PAYMENTS_ENABLED'].some((key) => {
      const value = String(process.env[key] || '').trim().toLowerCase()
      return value === 'true' || value === '1' || value === 'yes' || value === 'on'
    })
  }

  private resolveOrderId(payload: WebhookPayload): string | undefined {
    if (payload.orderId) return payload.orderId

    const metadataOrderId = payload.metadata?.orderId
    if (typeof metadataOrderId === 'string' && metadataOrderId.trim()) {
      return metadataOrderId
    }

    const nested = payload.data || {}
    const nestedOrderId = (nested.orderId || (nested.metadata as Record<string, unknown> | undefined)?.orderId)
    if (typeof nestedOrderId === 'string' && nestedOrderId.trim()) {
      return nestedOrderId
    }

    return undefined
  }

  private resolveProvider(payload: WebhookPayload): string {
    const nestedProvider = payload.data?.provider
    const metadataProvider = payload.metadata?.provider
    return String(payload.provider || nestedProvider || metadataProvider || process.env.PAYMENTS_PROVIDER_NAME || 'MANUAL')
      .trim()
      .toUpperCase()
  }

  private resolveProviderEventId(payload: WebhookPayload): string {
    const nestedEventId = payload.data?.eventId || payload.data?.id
    const metadataEventId = payload.metadata?.eventId
    return String(payload.eventId || nestedEventId || metadataEventId || `${payload.chargeId}:${payload.event}:${payload.status}`).trim()
  }

  private normalizeGatewayAmount(amount: number | undefined, orderTotal: number): number {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return orderTotal
    if (orderTotal > 0 && amount > orderTotal * 10) {
      return Number((amount / 100).toFixed(2))
    }
    return Number(amount.toFixed(2))
  }

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.webhookSecret
    if (!secret) {
      // Auditoria 360 JON-133: sem segredo configurado, NENHUMA assinatura
      // pode ser verificada -- devolver `true` aqui (mesmo com o gateway
      // "inativo") deixava qualquer requisicao com um header nao-vazio
      // passar pro processEvent(), que atualiza status/paymentStatus do
      // pedido sem prova nenhuma de que veio do gateway de verdade.
      // Endpoint publico sem segredo tem que rejeitar sempre, nao confiar.
      this.logger.warn(
        this.gatewayActive
          ? 'PAYMENTS_WEBHOOK_SECRET ausente com gateway de pagamento ativo -- webhook rejeitado.'
          : 'PAYMENTS_WEBHOOK_SECRET nao configurado -- webhook rejeitado (nao ha como verificar assinatura nenhuma).',
      )
      return false
    }

    try {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
      const normalized = signature.replace(/^sha256=/, '')
      const expectedBuf = Buffer.from(expected, 'hex')
      const signatureBuf = Buffer.from(normalized, 'hex')

      if (expectedBuf.length !== signatureBuf.length) return false
      return timingSafeEqual(expectedBuf, signatureBuf)
    } catch {
      return false
    }
  }

  async processEvent(
    payload: WebhookPayload,
    signatureOk = true,
  ): Promise<{ processed: boolean; reason?: string; orderId?: string; newStatus?: string; newPaymentStatus?: string }> {
    const targetStatus = EVENT_STATUS_MAP[payload.event]
    const targetPaymentStatus = EVENT_PAYMENT_STATUS_MAP[payload.event]
    const targetTransactionStatus = EVENT_TRANSACTION_STATUS_MAP[payload.event] || String(payload.status || 'PENDING').toUpperCase()
    const orderId = this.resolveOrderId(payload)
    const sanitizedPayload = PaymentsLedgerService.sanitizePayload(payload) as Record<string, unknown>

    await this.prisma.auditLog.create({
      data: {
        action: 'PAYMENT_WEBHOOK_RECEIVED',
        entity: 'PAYMENT_CHARGE',
        entityId: payload.chargeId,
        changes: JSON.stringify({
          event: payload.event,
          chargeId: payload.chargeId,
          orderId: orderId ?? null,
          status: payload.status,
          amount: payload.amount ?? null,
          paidAt: payload.paidAt ?? null,
          mappedStatus: targetStatus ?? null,
          mappedPaymentStatus: targetPaymentStatus ?? null,
          signatureOk,
        }),
      },
    })

    if (!targetStatus || !orderId) {
      this.logger.log(`Webhook ignorado - evento "${payload.event}" sem mapeamento ou orderId ausente.`)
      return { processed: false, reason: 'no_mapping_or_order_id' }
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      this.logger.warn(`Webhook: pedido ${orderId} nao encontrado para evento ${payload.event}.`)
      return { processed: false, reason: 'order_not_found', orderId }
    }

    // JON-134 (Auditoria 360): o update de status era incondicional -- um
    // webhook atrasado ou fora de ordem (retry do gateway, replay de evento
    // antigo) regredia pedido ja DELIVERED de volta pra CONFIRMED. Estado
    // final nao aceita mais transicao nenhuma via webhook; se precisar
    // corrigir manualmente e decisao de admin, nao de evento de terceiro.
    // ponytail: FINAL_ORDER_STATUSES ja existe duplicado em
    // data-privacy.service.ts e pdv-cancellation.scheduler.ts -- unificar
    // os tres numa constante compartilhada quando mexer de novo aqui.
    if (FINAL_ORDER_STATUSES.includes(order.status)) {
      this.logger.warn(`Webhook ignorado - pedido ${orderId} ja esta em estado final (${order.status}), evento ${payload.event} nao aplicado.`)
      return { processed: false, reason: 'order_already_final', orderId }
    }

    // Valor divergente (inclusive centavos pra pedido de valor bem maior)
    // nao pode aprovar o pedido -- so aceita dentro de 1 centavo de
    // tolerancia, mesmo padrao ja usado no antifraude do checkout
    // (PRICE_DIVERGED). Sem isso, um evento com amount ausente ou errado
    // confirmava pagamento pelo valor cheio do pedido sem checar nada.
    const normalizedAmount = this.normalizeGatewayAmount(payload.amount, order.total)
    const amountDiverged = Math.abs(normalizedAmount - Number(order.total)) > 0.01
    if (amountDiverged && targetPaymentStatus === 'PAID') {
      this.logger.warn(
        `Webhook ignorado - valor divergente pro pedido ${orderId}: recebido ${normalizedAmount}, esperado ${order.total}.`,
      )
      await this.prisma.auditLog.create({
        data: {
          action: 'PAYMENT_AMOUNT_DIVERGED',
          entity: 'ORDER',
          entityId: orderId,
          changes: JSON.stringify({ received: normalizedAmount, expected: Number(order.total), event: payload.event, chargeId: payload.chargeId }),
        },
      })
      return { processed: false, reason: 'amount_diverged', orderId }
    }

    const provider = this.resolveProvider(payload)
    const transaction = await this.paymentsLedger.createTransaction({
      tenantId: order.tenantId,
      storeId: order.storeId,
      orderId,
      provider,
      method: payload.method || order.paymentMethod,
      status: 'PENDING',
      amount: this.normalizeGatewayAmount(payload.amount, order.total),
      providerRef: payload.chargeId,
      idempotencyKey: `webhook:${provider}:${payload.chargeId}`,
      metadata: {
        source: 'webhook',
        initialEvent: payload.event,
        payload: sanitizedPayload,
      },
    })

    const eventResult = await this.paymentsLedger.recordEvent({
      tenantId: order.tenantId,
      storeId: order.storeId,
      transactionId: transaction.id,
      type: payload.event,
      payload: sanitizedPayload,
      signatureOk,
      providerEventId: this.resolveProviderEventId(payload),
    })

    if (eventResult.duplicate) {
      this.logger.log(`Webhook duplicado ignorado - evento "${payload.event}" para chargeId "${payload.chargeId}" ja registrado.`)
      return { processed: false, reason: 'duplicate', orderId }
    }

    await this.paymentsLedger.updateTransactionStatus(transaction.id, targetTransactionStatus, {
      source: 'webhook',
      lastEvent: payload.event,
      providerRef: payload.chargeId,
      payload: sanitizedPayload,
    })

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        ...(targetPaymentStatus ? { paymentStatus: targetPaymentStatus } : {}),
      },
    })

    await this.prisma.auditLog.create({
      data: {
        action: 'PAYMENT_STATUS_UPDATED',
        entity: 'ORDER',
        entityId: orderId,
        changes: JSON.stringify({
          previousStatus: order.status,
          newStatus: targetStatus,
          previousPaymentStatus: order.paymentStatus,
          newPaymentStatus: targetPaymentStatus ?? order.paymentStatus,
          triggeredByWebhook: payload.event,
          chargeId: payload.chargeId,
          transactionId: transaction.id,
          paymentEventId: eventResult.event.id,
        }),
      },
    })

    this.logger.log(`Pedido ${orderId} atualizado para ${targetStatus} via webhook ${payload.event}.`)
    return {
      processed: true,
      orderId,
      newStatus: targetStatus,
      ...(targetPaymentStatus ? { newPaymentStatus: targetPaymentStatus } : {}),
    }
  }

  async listRecentEvents(limit = 30) {
    const take = Math.max(1, Math.min(limit, 100))

    const logs = await this.prisma.auditLog.findMany({
      where: { action: 'PAYMENT_WEBHOOK_RECEIVED', entity: 'PAYMENT_CHARGE' },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return {
      total: logs.length,
      items: logs.map((log) => {
        let parsed: Record<string, unknown> = {}
        try {
          parsed = JSON.parse(log.changes || '{}') as Record<string, unknown>
        } catch { /* empty */ }

        return {
          id: log.id,
          chargeId: log.entityId,
          event: parsed.event as string | undefined,
          orderId: parsed.orderId as string | undefined,
          status: parsed.status as string | undefined,
          mappedStatus: parsed.mappedStatus as string | undefined,
          amount: parsed.amount as number | undefined,
          paidAt: parsed.paidAt as string | undefined,
          signatureOk: parsed.signatureOk as boolean | undefined,
          createdAt: log.createdAt,
        }
      }),
    }
  }
}
