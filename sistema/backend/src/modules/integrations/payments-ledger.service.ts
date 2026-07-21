import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { PublicApiService } from '../public-api/public-api.service'

type LedgerContext = {
  tenantId?: string
  storeId?: string
}

type PaymentTransactionInput = LedgerContext & {
  orderId: string
  provider?: string
  method?: string
  status?: string
  amount: number | string | Prisma.Decimal
  providerRef?: string | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown> | null
}

type PaymentEventInput = LedgerContext & {
  transactionId: string
  type: string
  payload: Record<string, unknown>
  signatureOk: boolean
  providerEventId?: string | null
}

type ProviderReconciliationRow = {
  providerRef: string
  amount: number
  status?: string
  metadata?: Record<string, unknown>
}

@Injectable()
export class PaymentsLedgerService {
  constructor(
    private prisma: PrismaService,
    private publicApiService: PublicApiService,
  ) {}

  async listTransactions(filters: LedgerContext & {
    orderId?: string
    status?: string
    provider?: string
    limit?: number
  } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const take = Math.max(1, Math.min(Number(filters.limit || 50), 200))

    const where: Prisma.PaymentTransactionWhereInput = {
      tenantId,
      storeId,
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
      ...(filters.provider ? { provider: this.normalizeProvider(filters.provider) } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.paymentTransaction.count({ where }),
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          events: { orderBy: { receivedAt: 'desc' }, take: 5 },
          refunds: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
    ])

    return { total, items }
  }

  async createTransaction(input: PaymentTransactionInput) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const provider = this.normalizeProvider(input.provider)
    const providerRef = this.optionalString(input.providerRef)
    const idempotencyKey = this.optionalString(input.idempotencyKey)

    if (idempotencyKey) {
      const existingByKey = await this.prisma.paymentTransaction.findFirst({
        where: { tenantId, storeId, idempotencyKey },
      })
      if (existingByKey) return existingByKey
    }

    if (providerRef) {
      const existingByProviderRef = await this.prisma.paymentTransaction.findFirst({
        where: { provider, providerRef },
      })
      if (existingByProviderRef) return existingByProviderRef
    }

    try {
      return await this.prisma.paymentTransaction.create({
        data: {
          tenantId,
          storeId,
          orderId: input.orderId,
          provider,
          method: this.normalizeCode(input.method || 'PIX'),
          status: this.normalizeCode(input.status || 'PENDING'),
          amount: this.decimal2(input.amount),
          currency: 'BRL',
          providerRef,
          idempotencyKey,
          metadata: input.metadata ? this.toJsonPayload(PaymentsLedgerService.sanitizePayload(input.metadata)) : Prisma.JsonNull,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = providerRef
          ? await this.prisma.paymentTransaction.findFirst({ where: { provider, providerRef } })
          : idempotencyKey
            ? await this.prisma.paymentTransaction.findFirst({ where: { tenantId, storeId, idempotencyKey } })
            : null
        if (existing) return existing
      }
      throw error
    }
  }

  async createTransactionForOrder(orderId: string, input: Omit<PaymentTransactionInput, 'orderId' | 'tenantId' | 'storeId' | 'amount' | 'method'> & {
    amount?: number | string | Prisma.Decimal
    method?: string
  }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Pedido nao encontrado para transacao de pagamento.')

    return this.createTransaction({
      tenantId: order.tenantId,
      storeId: order.storeId,
      orderId,
      provider: input.provider,
      method: input.method || order.paymentMethod,
      status: input.status,
      amount: input.amount ?? order.total,
      providerRef: input.providerRef,
      idempotencyKey: input.idempotencyKey || `order:${order.id}:${this.normalizeProvider(input.provider)}:${input.providerRef || order.paymentMethod}`,
      metadata: input.metadata || null,
    })
  }

  async recordEvent(input: PaymentEventInput) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const providerEventId = this.optionalString(input.providerEventId)

    if (providerEventId) {
      const existing = await this.prisma.paymentEvent.findFirst({
        where: { transactionId: input.transactionId, providerEventId },
      })
      if (existing) return { event: existing, duplicate: true }
    }

    try {
      const event = await this.prisma.paymentEvent.create({
        data: {
          tenantId,
          storeId,
          transactionId: input.transactionId,
          type: this.normalizeCode(input.type),
          payload: this.toJsonPayload(PaymentsLedgerService.sanitizePayload(input.payload)),
          signatureOk: input.signatureOk,
          providerEventId,
        },
      })
      return { event, duplicate: false }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && providerEventId) {
        const event = await this.prisma.paymentEvent.findFirst({
          where: { transactionId: input.transactionId, providerEventId },
        })
        if (event) return { event, duplicate: true }
      }
      throw error
    }
  }

  async updateTransactionStatus(transactionId: string, status: string, metadata?: Record<string, unknown>) {
    const transaction = await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: this.normalizeCode(status),
        ...(metadata ? { metadata: this.toJsonPayload(PaymentsLedgerService.sanitizePayload(metadata)) } : {}),
      },
    })
    this.publicApiService.emitWebhookEvent('payment.updated', {
      transactionId: transaction.id,
      orderId: transaction.orderId,
      status: transaction.status,
      provider: transaction.provider,
      providerRef: transaction.providerRef,
    }, transaction.tenantId, transaction.storeId).catch(() => null)
    return transaction
  }

  async createRefund(input: LedgerContext & {
    orderId: string
    transactionId?: string | null
    amount: number | string | Prisma.Decimal
    reason: string
    providerRef?: string | null
  }) {
    const order = await this.prisma.order.findUnique({ where: { id: input.orderId } })
    if (!order) throw new NotFoundException('Pedido nao encontrado para reembolso.')

    const tenantId = input.tenantId || order.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || order.storeId || DEFAULT_STORE_ID
    const amount = this.moneyNumber(input.amount)
    if (amount <= 0) throw new BadRequestException('Valor do reembolso deve ser maior que zero.')

    const transaction = input.transactionId
      ? await this.prisma.paymentTransaction.findFirst({
          where: { id: input.transactionId, tenantId, storeId, orderId: order.id },
        })
      : await this.prisma.paymentTransaction.findFirst({
          where: { tenantId, storeId, orderId: order.id, status: { in: ['PAID', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED'] } },
          orderBy: { createdAt: 'desc' },
        })

    if (input.transactionId && !transaction) {
      throw new NotFoundException('Transacao de pagamento nao encontrada para reembolso.')
    }

    const refunded = await this.prisma.refund.aggregate({
      where: {
        tenantId,
        storeId,
        orderId: order.id,
        status: { not: 'FAILED' },
        ...(transaction ? { transactionId: transaction.id } : {}),
      },
      _sum: { amount: true },
    })

    const paidAmount = transaction ? this.moneyNumber(transaction.amount) : this.moneyNumber(order.total)
    const alreadyRefunded = this.moneyNumber(refunded._sum.amount || 0)
    const refundable = this.roundMoney(paidAmount - alreadyRefunded)
    if (amount > refundable) {
      throw new BadRequestException(`Valor do reembolso excede saldo reembolsavel (${refundable.toFixed(2)}).`)
    }

    const refund = await this.prisma.refund.create({
      data: {
        tenantId,
        storeId,
        orderId: order.id,
        transactionId: transaction?.id || null,
        status: 'SUCCEEDED',
        amount: this.decimal2(amount),
        reason: input.reason,
        providerRef: this.optionalString(input.providerRef),
      },
    })

    if (transaction) {
      const newStatus = amount >= refundable ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
      await this.updateTransactionStatus(transaction.id, newStatus, {
        lastRefundId: refund.id,
        lastRefundAmount: amount,
        reason: input.reason,
      })
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: amount >= this.moneyNumber(order.total) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    }).catch(() => null)

    return refund
  }

  async registerChargeback(input: LedgerContext & {
    orderId?: string | null
    transactionId?: string | null
    providerRef?: string | null
    amount: number | string | Prisma.Decimal
    reason: string
  }) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const providerRef = this.optionalString(input.providerRef)

    const transaction = input.transactionId
      ? await this.prisma.paymentTransaction.findFirst({ where: { id: input.transactionId, tenantId, storeId } })
      : providerRef
        ? await this.prisma.paymentTransaction.findFirst({ where: { providerRef, tenantId, storeId } })
        : input.orderId
          ? await this.prisma.paymentTransaction.findFirst({
              where: { orderId: input.orderId, tenantId, storeId },
              orderBy: { createdAt: 'desc' },
            })
          : null

    if (!transaction) throw new NotFoundException('Transacao de pagamento nao encontrada para chargeback.')

    const providerEventId = `chargeback:${transaction.providerRef || transaction.id}:${this.roundMoney(this.moneyNumber(input.amount)).toFixed(2)}`
    const eventResult = await this.recordEvent({
      tenantId: transaction.tenantId,
      storeId: transaction.storeId,
      transactionId: transaction.id,
      type: 'charge.chargeback',
      signatureOk: true,
      providerEventId,
      payload: {
        amount: this.moneyNumber(input.amount),
        reason: input.reason,
        providerRef: transaction.providerRef,
      },
    })

    const updated = await this.updateTransactionStatus(transaction.id, 'CHARGEBACK', {
      chargebackAmount: this.moneyNumber(input.amount),
      chargebackReason: input.reason,
    })

    await this.prisma.order.update({
      where: { id: transaction.orderId },
      data: { paymentStatus: 'CHARGEBACK' },
    }).catch(() => null)

    return { transaction: updated, event: eventResult.event, duplicate: eventResult.duplicate }
  }

  async reconcile(input: LedgerContext & {
    provider?: string
    from: string | Date
    to: string | Date
    providerRows?: ProviderReconciliationRow[]
    createdBy?: string | null
    dryRun?: boolean
  }) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const provider = this.normalizeProvider(input.provider)
    const periodStart = new Date(input.from)
    const periodEnd = new Date(input.to)
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Periodo de conciliacao invalido.')
    }
    if (periodStart > periodEnd) {
      throw new BadRequestException('Data inicial deve ser menor ou igual a data final.')
    }

    const localTransactions = await this.prisma.paymentTransaction.findMany({
      where: {
        tenantId,
        storeId,
        provider,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { createdAt: 'asc' },
    })

    const providerRows = (input.providerRows || []).map((row) => ({
      ...row,
      providerRef: String(row.providerRef || '').trim(),
      amount: this.roundMoney(Number(row.amount || 0)),
      status: row.status ? this.normalizeCode(row.status) : undefined,
    })).filter((row) => row.providerRef)

    const providerByRef = new Map(providerRows.map((row) => [row.providerRef, row]))
    const localByRef = new Map(localTransactions.filter((tx) => tx.providerRef).map((tx) => [tx.providerRef!, tx]))

    const matched: Array<Record<string, unknown>> = []
    const amountMismatch: Array<Record<string, unknown>> = []
    const missingProvider: Array<Record<string, unknown>> = []
    const missingLocal: Array<Record<string, unknown>> = []

    for (const transaction of localTransactions) {
      const providerRef = transaction.providerRef || ''
      const remote = providerRef ? providerByRef.get(providerRef) : undefined
      if (!remote) {
        missingProvider.push(this.reconciliationLocalRow(transaction))
        continue
      }

      const localAmount = this.moneyNumber(transaction.amount)
      const difference = this.roundMoney(remote.amount - localAmount)
      if (Math.abs(difference) >= 0.01) {
        amountMismatch.push({
          providerRef,
          orderId: transaction.orderId,
          localAmount,
          providerAmount: remote.amount,
          difference,
          localStatus: transaction.status,
          providerStatus: remote.status || null,
        })
        continue
      }

      matched.push({
        providerRef,
        orderId: transaction.orderId,
        amount: localAmount,
        localStatus: transaction.status,
        providerStatus: remote.status || null,
      })
    }

    for (const remote of providerRows) {
      if (!localByRef.has(remote.providerRef)) {
        missingLocal.push({
          providerRef: remote.providerRef,
          providerAmount: remote.amount,
          providerStatus: remote.status || null,
          metadata: PaymentsLedgerService.sanitizePayload(remote.metadata || {}),
        })
      }
    }

    const totalDifference = amountMismatch.reduce((sum, item) => sum + Number(item.difference || 0), 0)
    const report = {
      matched,
      missingProvider,
      missingLocal,
      amountMismatch,
      generatedAt: new Date().toISOString(),
    }

    const runData = {
      tenantId,
      storeId,
      provider,
      status: 'COMPLETED',
      periodStart,
      periodEnd,
      matchedCount: matched.length,
      missingProviderCount: missingProvider.length,
      missingLocalCount: missingLocal.length,
      amountMismatchCount: amountMismatch.length,
      totalDifference: this.decimal2(totalDifference),
      report: this.toJsonPayload(report),
      createdBy: this.optionalString(input.createdBy),
    }

    const run = input.dryRun
      ? { id: null, ...runData, createdAt: new Date(), updatedAt: new Date() }
      : await this.prisma.paymentReconciliationRun.create({ data: runData })

    return {
      run,
      summary: {
        matched: matched.length,
        missingProvider: missingProvider.length,
        missingLocal: missingLocal.length,
        amountMismatch: amountMismatch.length,
        totalDifference: this.roundMoney(totalDifference),
      },
      report,
    }
  }

  static sanitizePayload(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => PaymentsLedgerService.sanitizePayload(item))
    }

    if (!value || typeof value !== 'object') return value

    const sanitized: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.toLowerCase()
      if (
        normalized.includes('card') ||
        normalized.includes('cvv') ||
        normalized.includes('cvc') ||
        normalized.includes('token') ||
        normalized === 'pan' ||
        normalized === 'security_code'
      ) {
        sanitized[key] = '[REDACTED]'
        continue
      }
      sanitized[key] = PaymentsLedgerService.sanitizePayload(nestedValue)
    }
    return sanitized
  }

  private reconciliationLocalRow(transaction: {
    id: string
    orderId: string
    providerRef: string | null
    amount: Prisma.Decimal | number | string
    status: string
  }) {
    return {
      transactionId: transaction.id,
      orderId: transaction.orderId,
      providerRef: transaction.providerRef,
      localAmount: this.moneyNumber(transaction.amount),
      localStatus: transaction.status,
    }
  }

  private normalizeProvider(provider?: string | null) {
    return this.normalizeCode(provider || process.env.PAYMENTS_PROVIDER_NAME || 'MANUAL')
  }

  private normalizeCode(value?: string | null) {
    return String(value || '').trim().toUpperCase()
  }

  private optionalString(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private decimal2(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(this.roundMoney(this.moneyNumber(value)).toFixed(2))
  }

  private moneyNumber(value: number | string | Prisma.Decimal | null | undefined) {
    if (value === null || value === undefined) return 0
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? this.roundMoney(numberValue) : 0
  }

  private roundMoney(value: number) {
    return Number(Number(value || 0).toFixed(2))
  }

  private toJsonPayload(payload: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(payload || {})) as Prisma.InputJsonObject
  }
}
