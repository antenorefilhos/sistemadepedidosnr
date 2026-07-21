import { Injectable, ForbiddenException, UnauthorizedException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import * as crypto from 'crypto'
import axios from 'axios'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'

type ApiRequestMeta = {
  path: string
  method: string
  ip?: string
  userAgent?: string
}

@Injectable()
export class PublicApiService {
  constructor(private prisma: PrismaService) {}

  static hashSecret(secret: string) {
    return crypto.createHash('sha256').update(secret).digest('hex')
  }

  async createClient(input: {
    name: string
    scopes: string[]
    status?: string
    rateLimitPerMinute?: number
    tenantId?: string
    storeId?: string
  }) {
    const secret = crypto.randomBytes(24).toString('hex')
    const clientId = `ak_${crypto.randomBytes(12).toString('hex')}`
    const tenantId = input.tenantId || DEFAULT_TENANT_ID
    const storeId = input.storeId || DEFAULT_STORE_ID
    const client = await this.prisma.apiClient.create({
      data: {
        tenantId,
        storeId,
        name: input.name,
        clientId,
        secretHash: PublicApiService.hashSecret(secret),
        scopes: input.scopes.map((scope) => this.normalizeScope(scope)),
        status: this.normalizeCode(input.status || 'ACTIVE'),
        rateLimitPerMinute: Math.max(1, Math.min(Number(input.rateLimitPerMinute || 120), 10000)),
      },
    })

    return { client, secret, apiKey: `${clientId}.${secret}` }
  }

  async listClients() {
    const items = await this.prisma.apiClient.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        storeId: true,
        name: true,
        clientId: true,
        scopes: true,
        status: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return { total: items.length, items }
  }

  async authenticate(apiKey: string | undefined, requiredScope: string | undefined, meta: ApiRequestMeta) {
    const parsed = this.parseApiKey(apiKey)
    if (!parsed) {
      await this.logUsage(null, null, requiredScope, false, 'missing_api_key', meta)
      throw new UnauthorizedException('API key ausente ou invalida.')
    }

    const client = await this.prisma.apiClient.findUnique({ where: { clientId: parsed.clientId } })
    if (!client) {
      await this.logUsage(null, parsed.clientId, requiredScope, false, 'unknown_client', meta)
      throw new UnauthorizedException('API client nao encontrado.')
    }

    if (client.status !== 'ACTIVE') {
      await this.logUsage(client, client.clientId, requiredScope, false, 'revoked_client', meta)
      throw new UnauthorizedException('API client revogado ou inativo.')
    }

    if (client.secretHash !== PublicApiService.hashSecret(parsed.secret)) {
      await this.logUsage(client, client.clientId, requiredScope, false, 'invalid_secret', meta)
      throw new UnauthorizedException('API secret invalido.')
    }

    const scope = requiredScope ? this.normalizeScope(requiredScope) : undefined
    if (scope && !client.scopes.includes(scope) && !client.scopes.includes('*')) {
      await this.logUsage(client, client.clientId, scope, false, 'missing_scope', meta)
      throw new ForbiddenException(`Scope necessario: ${scope}`)
    }

    const since = new Date(Date.now() - 60_000)
    const used = await this.prisma.apiUsageLog.count({
      where: { apiClientId: client.id, allowed: true, createdAt: { gte: since } },
    })
    if (used >= client.rateLimitPerMinute) {
      await this.logUsage(client, client.clientId, scope, false, 'rate_limited', meta)
      throw new HttpException('Rate limit do cliente excedido.', HttpStatus.TOO_MANY_REQUESTS)
    }

    await this.prisma.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
    await this.logUsage(client, client.clientId, scope, true, null, meta)
    return client
  }

  async listOrders(client: { tenantId: string; storeId: string }, limit = 50) {
    const take = Math.max(1, Math.min(Number(limit || 50), 200))
    const [total, items] = await Promise.all([
      this.prisma.order.count({ where: { tenantId: client.tenantId, storeId: client.storeId } }),
      this.prisma.order.findMany({
        where: { tenantId: client.tenantId, storeId: client.storeId },
        orderBy: { createdAt: 'desc' },
        take,
        include: { items: true, customer: true },
      }),
    ])
    return { total, items }
  }

  async getOrder(client: { tenantId: string; storeId: string }, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId: client.tenantId, storeId: client.storeId },
      include: { items: true, customer: true },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado.')
    const events = await this.prisma.orderEvent.findMany({
      where: { tenantId: client.tenantId, storeId: client.storeId, orderId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return { ...order, events }
  }

  async listProducts(client: { tenantId: string; storeId: string }, limit = 50) {
    const take = Math.max(1, Math.min(Number(limit || 50), 200))
    const where = {
      tenantId: client.tenantId,
      storeId: client.storeId,
      active: true,
    }
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        select: { id: true, name: true, ean: true, price: true, promotionalPrice: true, stock: true, unit: true, category: true, updatedAt: true },
      }),
    ])
    return { total, items }
  }

  async listStock(client: { tenantId: string; storeId: string }, productIds?: string[]) {
    const rows = await this.prisma.stockPosition.findMany({
      where: {
        tenantId: client.tenantId,
        storeId: client.storeId,
        ...(productIds?.length ? { productId: { in: productIds } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })
    return { total: rows.length, items: rows }
  }

  async createWebhookEndpoint(input: {
    url: string
    events: string[]
    status?: string
    description?: string
    tenantId?: string
    storeId?: string
  }) {
    return this.prisma.webhookEndpoint.create({
      data: {
        tenantId: input.tenantId || DEFAULT_TENANT_ID,
        storeId: input.storeId || DEFAULT_STORE_ID,
        url: input.url,
        secret: crypto.randomBytes(24).toString('hex'),
        events: input.events.map((event) => this.normalizeEvent(event)),
        status: this.normalizeCode(input.status || 'ACTIVE'),
        description: input.description || null,
      },
    })
  }

  async listWebhookEndpoints() {
    const items = await this.prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } })
    return { total: items.length, items }
  }

  async emitWebhookEvent(eventType: string, payload: Record<string, unknown>, tenantId = DEFAULT_TENANT_ID, storeId = DEFAULT_STORE_ID) {
    const normalizedEvent = this.normalizeEvent(eventType)
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        storeId,
        status: 'ACTIVE',
        events: { has: normalizedEvent },
      },
    })

    const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`
    const envelope = {
      id: eventId,
      type: normalizedEvent,
      createdAt: new Date().toISOString(),
      data: payload,
    }

    const deliveries = await Promise.all(endpoints.map((endpoint) =>
      this.prisma.webhookDelivery.create({
        data: {
          tenantId,
          storeId,
          endpointId: endpoint.id,
          eventType: normalizedEvent,
          payload: envelope as Prisma.InputJsonObject,
          status: 'PENDING',
          nextRetryAt: new Date(),
        },
      }),
    ))

    return { eventId, eventType: normalizedEvent, deliveries }
  }

  async listWebhookDeliveries(filters: { status?: string; endpointId?: string; limit?: number } = {}) {
    const take = Math.max(1, Math.min(Number(filters.limit || 50), 200))
    const where: Prisma.WebhookDeliveryWhereInput = {
      ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
      ...(filters.endpointId ? { endpointId: filters.endpointId } : {}),
    }
    const [total, items] = await Promise.all([
      this.prisma.webhookDelivery.count({ where }),
      this.prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, take, include: { endpoint: true } }),
    ])
    return { total, items }
  }

  async runWebhookDeliveries(limit = 10) {
    const now = new Date()
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.max(1, Math.min(Number(limit || 10), 50)),
      include: { endpoint: true },
    })

    const results = []
    for (const delivery of deliveries) {
      results.push(await this.processWebhookDelivery(delivery.id))
    }
    return { processed: results.length, results }
  }

  async processWebhookDelivery(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } })
    if (!delivery) throw new NotFoundException('Webhook delivery nao encontrado.')
    if (delivery.status === 'DELIVERED') return { deliveryId, skipped: true, reason: 'already_delivered' }
    if (delivery.attempts >= delivery.maxAttempts) {
      await this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'DEAD', nextRetryAt: null } })
      return { deliveryId, status: 'DEAD' }
    }

    const body = JSON.stringify(delivery.payload)
    const signature = this.signPayload(delivery.endpoint.secret, body)
    try {
      await axios.post(delivery.endpoint.url, delivery.payload, {
        timeout: 5000,
        headers: {
          'content-type': 'application/json',
          'x-antenor-event': delivery.eventType,
          'x-antenor-delivery': delivery.id,
          'x-antenor-signature': signature,
        },
      })
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'DELIVERED',
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      })
      return { deliveryId, status: 'DELIVERED' }
    } catch (error) {
      const nextAttempts = delivery.attempts + 1
      const dead = nextAttempts >= delivery.maxAttempts
      const lastError = (error as Error).message
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: dead ? 'DEAD' : 'FAILED',
          attempts: { increment: 1 },
          lastError,
          nextRetryAt: dead ? null : new Date(Date.now() + this.backoffMs(nextAttempts)),
        },
      })
      return { deliveryId, status: dead ? 'DEAD' : 'FAILED', error: lastError }
    }
  }

  async replayWebhookDelivery(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } })
    if (!delivery) throw new NotFoundException('Webhook delivery nao encontrado.')
    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PENDING', attempts: 0, nextRetryAt: new Date(), lastError: null, deliveredAt: null },
    })
  }

  signPayload(secret: string, body: string) {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  }

  private parseApiKey(apiKey?: string) {
    const raw = String(apiKey || '').replace(/^Bearer\s+/i, '').trim()
    const [clientId, secret] = raw.split('.')
    if (!clientId || !secret) return null
    return { clientId, secret }
  }

  private async logUsage(
    client: { id: string; tenantId: string; storeId: string } | null,
    clientId: string | null,
    scope: string | undefined,
    allowed: boolean,
    error: string | null,
    meta: ApiRequestMeta,
  ) {
    await this.prisma.apiUsageLog.create({
      data: {
        tenantId: client?.tenantId || DEFAULT_TENANT_ID,
        storeId: client?.storeId || DEFAULT_STORE_ID,
        apiClientId: client?.id || null,
        clientId,
        path: meta.path,
        method: meta.method,
        scope: scope || null,
        allowed,
        error,
        ip: meta.ip || null,
        userAgent: meta.userAgent || null,
      },
    })
  }

  private normalizeScope(scope: string) {
    return String(scope || '').trim().toLowerCase()
  }

  private normalizeEvent(event: string) {
    return String(event || '').trim().toLowerCase()
  }

  private normalizeCode(value: string) {
    return String(value || '').trim().toUpperCase()
  }

  private backoffMs(attempt: number) {
    return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempt - 1))
  }
}
