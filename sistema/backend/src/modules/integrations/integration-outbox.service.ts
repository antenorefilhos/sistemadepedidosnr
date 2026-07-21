import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'

type IntegrationContext = {
  tenantId?: string
  storeId?: string
}

type ConnectorInput = IntegrationContext & {
  type: string
  provider: string
  status?: string
  config?: Record<string, unknown>
}

type OutboxInput = IntegrationContext & {
  connectorId?: string | null
  connectorType?: string
  provider?: string
  aggregate: string
  aggregateId: string
  type: string
  payload: Record<string, unknown>
  idempotencyKey?: string | null
  maxAttempts?: number
}

type DispatchResult = {
  ok: boolean
  result?: Record<string, unknown>
  error?: string
}

@Injectable()
export class IntegrationOutboxService {
  constructor(private prisma: PrismaService) {}

  async createConnector(input: ConnectorInput) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const type = this.normalizeCode(input.type)
    const provider = this.normalizeCode(input.provider)

    return this.prisma.integrationConnector.upsert({
      where: {
        tenantId_storeId_type_provider: { tenantId, storeId, type, provider },
      },
      update: {
        status: this.normalizeCode(input.status || 'ACTIVE'),
        config: this.toJson(input.config || {}),
      },
      create: {
        tenantId,
        storeId,
        type,
        provider,
        status: this.normalizeCode(input.status || 'ACTIVE'),
        config: this.toJson(input.config || {}),
      },
    })
  }

  async listConnectors(filters: IntegrationContext & { type?: string; provider?: string; status?: string } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const where: Prisma.IntegrationConnectorWhereInput = {
      tenantId,
      storeId,
      ...(filters.type ? { type: this.normalizeCode(filters.type) } : {}),
      ...(filters.provider ? { provider: this.normalizeCode(filters.provider) } : {}),
      ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
    }

    const connectors = await this.prisma.integrationConnector.findMany({
      where,
      orderBy: [{ type: 'asc' }, { provider: 'asc' }],
    })

    const withHealth = await Promise.all(
      connectors.map(async (connector) => {
        const [pending, failed, dead, lastJob] = await Promise.all([
          this.prisma.outboxEvent.count({ where: { connectorId: connector.id, status: { in: ['PENDING', 'PROCESSING'] } } }),
          this.prisma.outboxEvent.count({ where: { connectorId: connector.id, status: 'FAILED' } }),
          this.prisma.integrationDeadLetter.count({ where: { connectorId: connector.id, resolvedAt: null } }),
          this.prisma.integrationJob.findFirst({
            where: { connectorId: connector.id },
            orderBy: { createdAt: 'desc' },
          }),
        ])

        return {
          ...connector,
          health: {
            pending,
            failed,
            dead,
            lastJobStatus: lastJob?.status || null,
            lastJobAt: lastJob?.createdAt || null,
          },
        }
      }),
    )

    return { total: withHealth.length, items: withHealth }
  }

  async enqueueEvent(input: OutboxInput) {
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const connector = await this.resolveConnector(input)
    const idempotencyKey = this.optionalString(input.idempotencyKey)

    if (idempotencyKey) {
      const existing = await this.prisma.outboxEvent.findFirst({
        where: { tenantId, storeId, connectorId: connector?.id || null, idempotencyKey },
      })
      if (existing) return { event: existing, duplicate: true }
    }

    const event = await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        storeId,
        connectorId: connector?.id || null,
        aggregate: this.normalizeCode(input.aggregate),
        aggregateId: input.aggregateId,
        type: this.normalizeCode(input.type),
        payload: this.toJson(input.payload),
        status: 'PENDING',
        maxAttempts: Math.max(1, Math.min(Number(input.maxAttempts || 5), 20)),
        idempotencyKey,
        nextRetryAt: new Date(),
      },
    })

    return { event, duplicate: false }
  }

  async listOutboxEvents(filters: IntegrationContext & {
    status?: string
    connectorId?: string
    aggregate?: string
    aggregateId?: string
    limit?: number
  } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const take = Math.max(1, Math.min(Number(filters.limit || 50), 200))
    const where: Prisma.OutboxEventWhereInput = {
      tenantId,
      storeId,
      ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
      ...(filters.connectorId ? { connectorId: filters.connectorId } : {}),
      ...(filters.aggregate ? { aggregate: this.normalizeCode(filters.aggregate) } : {}),
      ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.outboxEvent.count({ where }),
      this.prisma.outboxEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: { connector: true },
      }),
    ])

    return { total, items }
  }

  async listJobs(filters: IntegrationContext & { status?: string; connectorId?: string; limit?: number } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const take = Math.max(1, Math.min(Number(filters.limit || 50), 200))
    const where: Prisma.IntegrationJobWhereInput = {
      tenantId,
      storeId,
      ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
      ...(filters.connectorId ? { connectorId: filters.connectorId } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.integrationJob.count({ where }),
      this.prisma.integrationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: { connector: true, attemptLogs: { orderBy: { startedAt: 'desc' }, take: 5 } },
      }),
    ])

    return { total, items }
  }

  async listDeadLetters(filters: IntegrationContext & { connectorId?: string; unresolvedOnly?: boolean; limit?: number } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const take = Math.max(1, Math.min(Number(filters.limit || 50), 200))
    const where: Prisma.IntegrationDeadLetterWhereInput = {
      tenantId,
      storeId,
      ...(filters.connectorId ? { connectorId: filters.connectorId } : {}),
      ...(filters.unresolvedOnly === false ? {} : { resolvedAt: null }),
    }

    const [total, items] = await Promise.all([
      this.prisma.integrationDeadLetter.count({ where }),
      this.prisma.integrationDeadLetter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: { connector: true },
      }),
    ])

    return { total, items }
  }

  async getPanel() {
    const [connectors, outboxByStatus, jobsByStatus, deadLetters, attempts] = await Promise.all([
      this.prisma.integrationConnector.findMany({ orderBy: [{ type: 'asc' }, { provider: 'asc' }] }),
      this.prisma.outboxEvent.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.integrationJob.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.integrationDeadLetter.count({ where: { resolvedAt: null } }),
      this.prisma.integrationAttempt.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
    ])

    return {
      connectors: connectors.length,
      outbox: this.groupCounts(outboxByStatus),
      jobs: this.groupCounts(jobsByStatus),
      deadLetters,
      recentAttempts: attempts,
    }
  }

  async runDueOutboxBatch(limit = 10) {
    const take = Math.max(1, Math.min(Number(limit || 10), 50))
    const now = new Date()
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
      take,
      include: { connector: true },
    })

    const results = []
    for (const event of events) {
      results.push(await this.processOutboxEvent(event.id))
    }

    return {
      processed: results.length,
      results,
    }
  }

  async processOutboxEvent(eventId: string) {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: eventId },
      include: { connector: true },
    })

    if (!event) throw new NotFoundException('Evento de outbox nao encontrado.')
    if (event.status === 'SENT') return { eventId, skipped: true, reason: 'already_sent' }
    if (event.attempts >= event.maxAttempts) {
      await this.moveToDeadLetter(event, null, event.lastError || 'Limite de tentativas excedido.')
      return { eventId, status: 'DEAD' }
    }
    if (!event.connector) {
      await this.failEvent(event, null, 'Evento sem connector associado.')
      return { eventId, status: 'FAILED', error: 'Evento sem connector associado.' }
    }

    const startedAt = new Date()
    const attemptNo = event.attempts + 1
    const job = await this.prisma.integrationJob.create({
      data: {
        tenantId: event.tenantId,
        storeId: event.storeId,
        connectorId: event.connector.id,
        outboxEventId: event.id,
        type: event.type,
        status: 'PROCESSING',
        payload: event.payload,
        attempts: attemptNo,
        idempotencyKey: event.idempotencyKey ? `job:${event.idempotencyKey}` : null,
        startedAt,
      },
    })

    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lockedAt: startedAt,
      },
    })

    const attempt = await this.prisma.integrationAttempt.create({
      data: {
        tenantId: event.tenantId,
        storeId: event.storeId,
        jobId: job.id,
        attemptNo,
        status: 'PROCESSING',
        requestPayload: event.payload,
      },
    })

    const dispatched = await this.dispatchEvent(event.connector.status, event.payload as Record<string, unknown>)
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()

    if (dispatched.ok) {
      await this.prisma.integrationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SENT',
          responsePayload: this.toJson(dispatched.result || { accepted: true }),
          finishedAt,
          durationMs,
        },
      })
      await this.prisma.integrationJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          result: this.toJson(dispatched.result || { accepted: true }),
          finishedAt,
        },
      })
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'SENT',
          processedAt: finishedAt,
          lockedAt: null,
          lastError: null,
        },
      })
      return { eventId, jobId: job.id, status: 'SENT' }
    }

    await this.prisma.integrationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        error: dispatched.error,
        finishedAt,
        durationMs,
      },
    })
    await this.failEvent(event, job.id, dispatched.error || 'Falha de dispatch.')
    return { eventId, jobId: job.id, status: 'FAILED', error: dispatched.error }
  }

  async replayOutboxEvent(eventId: string) {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id: eventId } })
    if (!event) throw new NotFoundException('Evento de outbox nao encontrado.')

    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lockedAt: null,
        processedAt: null,
        lastError: null,
      },
    })
  }

  async replayDeadLetter(deadLetterId: string) {
    const dead = await this.prisma.integrationDeadLetter.findUnique({ where: { id: deadLetterId } })
    if (!dead) throw new NotFoundException('DLQ nao encontrada.')

    const replay = await this.prisma.outboxEvent.create({
      data: {
        tenantId: dead.tenantId,
        storeId: dead.storeId,
        connectorId: dead.connectorId,
        aggregate: 'DEAD_LETTER_REPLAY',
        aggregateId: dead.id,
        type: 'DLQ_REPLAY',
        payload: dead.payload,
        status: 'PENDING',
        idempotencyKey: `dlq:${dead.id}:${dead.replayCount + 1}`,
        nextRetryAt: new Date(),
      },
    })

    await this.prisma.integrationDeadLetter.update({
      where: { id: dead.id },
      data: {
        replayCount: { increment: 1 },
        resolvedAt: new Date(),
      },
    })

    return { deadLetterId: dead.id, replayEventId: replay.id }
  }

  async enqueueSolidcomOrderFailure(orderId: string, payload: Record<string, unknown>, error: string) {
    return this.enqueueEvent({
      connectorType: 'ERP',
      provider: 'SOLIDCOM',
      aggregate: 'ORDER',
      aggregateId: orderId,
      type: 'ORDER_SYNC_TO_ERP',
      payload: { orderId, payload, previousError: error },
      idempotencyKey: `solidcom:order:${orderId}:sync`,
    })
  }

  private async resolveConnector(input: OutboxInput) {
    if (input.connectorId) {
      const connector = await this.prisma.integrationConnector.findUnique({ where: { id: input.connectorId } })
      if (!connector) throw new NotFoundException('Conector de integracao nao encontrado.')
      return connector
    }

    if (!input.connectorType || !input.provider) return null

    return this.createConnector({
      tenantId: input.tenantId,
      storeId: input.storeId,
      type: input.connectorType,
      provider: input.provider,
      status: 'ACTIVE',
      config: { autoCreated: true },
    })
  }

  private async failEvent(
    event: Prisma.OutboxEventGetPayload<{ include: { connector: true } }>,
    jobId: string | null,
    error: string,
  ) {
    const nextAttempts = event.attempts + 1
    if (nextAttempts >= event.maxAttempts) {
      await this.moveToDeadLetter(event, jobId, error)
      return
    }

    const nextRetryAt = new Date(Date.now() + this.backoffMs(nextAttempts))
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'FAILED',
        lastError: error,
        lockedAt: null,
        nextRetryAt,
      },
    })
    if (jobId) {
      await this.prisma.integrationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error,
          nextRetryAt,
          finishedAt: new Date(),
        },
      })
    }
  }

  private async moveToDeadLetter(
    event: Prisma.OutboxEventGetPayload<{ include: { connector: true } }>,
    jobId: string | null,
    reason: string,
  ) {
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'DEAD',
        lastError: reason,
        lockedAt: null,
        nextRetryAt: null,
      },
    })
    if (jobId) {
      await this.prisma.integrationJob.update({
        where: { id: jobId },
        data: {
          status: 'DEAD',
          error: reason,
          finishedAt: new Date(),
        },
      })
    }
    await this.prisma.integrationDeadLetter.create({
      data: {
        tenantId: event.tenantId,
        storeId: event.storeId,
        connectorId: event.connectorId,
        outboxEventId: event.id,
        jobId,
        reason,
        payload: event.payload,
        lastError: reason,
      },
    })
  }

  private async dispatchEvent(connectorStatus: string, payload: Record<string, unknown>): Promise<DispatchResult> {
    if (this.normalizeCode(connectorStatus) !== 'ACTIVE') {
      return { ok: false, error: 'Conector inativo.' }
    }
    if (payload?.simulateFailure === true) {
      return { ok: false, error: 'Falha simulada para validacao de retry/DLQ.' }
    }
    return { ok: true, result: { acceptedAt: new Date().toISOString(), queuedBy: 'postgres-outbox' } }
  }

  private backoffMs(attempt: number) {
    return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1))
  }

  private groupCounts(rows: Array<{ status: string; _count: { _all: number } }>) {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all
      return acc
    }, {})
  }

  private normalizeCode(value?: string | null) {
    const normalized = String(value || '').trim().toUpperCase()
    if (!normalized) throw new BadRequestException('Codigo de integracao obrigatorio.')
    return normalized
  }

  private optionalString(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized.length > 0 ? normalized : null
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
  }
}
