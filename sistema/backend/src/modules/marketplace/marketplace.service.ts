import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { PrismaService } from '../../common/prisma.service'
import { OrdersService } from '../orders/orders.service'

type ChannelContext = {
  tenantId?: string
  storeId?: string
}

type ExternalOrderPayload = {
  externalId: string
  customer?: {
    name?: string
    cpf?: string
    whatsapp?: string
    email?: string
  }
  items: Array<{
    externalId?: string
    productId?: string
    quantity: number
  }>
  delivery?: number
  paymentMethod?: string
  fulfillmentType?: string
  notes?: string
  raw?: Record<string, unknown>
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async upsertSalesChannel(body: any) {
    const tenantId = body.tenantId || DEFAULT_TENANT_ID
    const storeId = body.storeId || DEFAULT_STORE_ID
    const type = this.normalizeCode(body.type || body.provider || 'STOREFRONT')
    const provider = this.normalizeCode(body.provider || type)
    const name = String(body.name || `${type} ${provider}`).trim()
    if (!name) throw new BadRequestException('Nome do canal e obrigatorio.')

    return this.prisma.salesChannel.upsert({
      where: { tenantId_storeId_type_provider: { tenantId, storeId, type, provider } },
      update: {
        name,
        status: this.normalizeCode(body.status || 'ACTIVE'),
        config: this.toJson(body.config || {}),
      },
      create: {
        tenantId,
        storeId,
        type,
        provider,
        name,
        status: this.normalizeCode(body.status || 'ACTIVE'),
        config: this.toJson(body.config || {}),
      },
    })
  }

  async listSalesChannels(filters: ChannelContext & { status?: string; type?: string } = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const channels = await this.prisma.salesChannel.findMany({
      where: {
        tenantId,
        storeId,
        ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
        ...(filters.type ? { type: this.normalizeCode(filters.type) } : {}),
      },
      include: {
        _count: {
          select: {
            products: true,
            marketplaceOrders: true,
            pricePolicies: true,
            stockPolicies: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { type: 'asc' }, { provider: 'asc' }],
    })
    return { total: channels.length, items: channels }
  }

  async upsertChannelProduct(channelId: string, body: any) {
    const channel = await this.requireChannel(channelId)
    const productId = String(body.productId || '').trim()
    if (!productId) throw new BadRequestException('productId e obrigatorio.')

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId: channel.tenantId, storeId: channel.storeId },
      select: { id: true },
    })
    if (!product) throw new BadRequestException('Produto nao encontrado para o canal.')

    return this.prisma.channelProduct.upsert({
      where: { channelId_productId: { channelId, productId } },
      update: {
        externalId: body.externalId || null,
        externalSku: body.externalSku || null,
        status: this.normalizeCode(body.status || 'ACTIVE'),
        priceMode: this.normalizeCode(body.priceMode || 'INHERIT'),
        stockMode: this.normalizeCode(body.stockMode || 'INHERIT'),
        metadata: body.metadata || undefined,
      },
      create: {
        tenantId: channel.tenantId,
        storeId: channel.storeId,
        channelId,
        productId,
        externalId: body.externalId || null,
        externalSku: body.externalSku || null,
        status: this.normalizeCode(body.status || 'ACTIVE'),
        priceMode: this.normalizeCode(body.priceMode || 'INHERIT'),
        stockMode: this.normalizeCode(body.stockMode || 'INHERIT'),
        metadata: body.metadata || undefined,
      },
    })
  }

  async upsertPricePolicy(channelId: string, body: any) {
    const channel = await this.requireChannel(channelId)
    const mode = this.normalizeCode(body.mode || 'INHERIT')
    return this.prisma.channelPricePolicy.upsert({
      where: { channelId_mode: { channelId, mode } },
      update: {
        markupPercent: this.decimal(Number(body.markupPercent || 0)),
        minMargin: body.minMargin == null ? null : this.decimal(Number(body.minMargin)),
        roundingMode: this.normalizeCode(body.roundingMode || 'NONE'),
        status: this.normalizeCode(body.status || 'ACTIVE'),
      },
      create: {
        tenantId: channel.tenantId,
        storeId: channel.storeId,
        channelId,
        mode,
        markupPercent: this.decimal(Number(body.markupPercent || 0)),
        minMargin: body.minMargin == null ? null : this.decimal(Number(body.minMargin)),
        roundingMode: this.normalizeCode(body.roundingMode || 'NONE'),
        status: this.normalizeCode(body.status || 'ACTIVE'),
      },
    })
  }

  async upsertStockPolicy(channelId: string, body: any) {
    const channel = await this.requireChannel(channelId)
    const stockMode = this.normalizeCode(body.stockMode || 'AVAILABLE')
    return this.prisma.channelStockPolicy.upsert({
      where: { channelId_stockMode: { channelId, stockMode } },
      update: {
        bufferQuantity: this.decimal(Number(body.bufferQuantity || 0)),
        allowOversell: Boolean(body.allowOversell),
        status: this.normalizeCode(body.status || 'ACTIVE'),
      },
      create: {
        tenantId: channel.tenantId,
        storeId: channel.storeId,
        channelId,
        stockMode,
        bufferQuantity: this.decimal(Number(body.bufferQuantity || 0)),
        allowOversell: Boolean(body.allowOversell),
        status: this.normalizeCode(body.status || 'ACTIVE'),
      },
    })
  }

  async ingestMarketplaceOrder(channelId: string, payload: ExternalOrderPayload, headers?: Record<string, string | string[] | undefined>) {
    const channel = await this.requireChannel(channelId)
    this.assertWebhookSecret(channel, headers)

    if (!payload?.externalId) throw new BadRequestException('externalId e obrigatorio.')
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new BadRequestException('Pedido externo deve conter itens.')

    const existing = await this.prisma.marketplaceOrder.findUnique({
      where: { channelId_externalId: { channelId, externalId: payload.externalId } },
    })
    if (existing?.orderId) return { marketplaceOrder: existing, duplicate: true }

    const marketplaceOrder = existing || await this.prisma.marketplaceOrder.create({
      data: {
        tenantId: channel.tenantId,
        storeId: channel.storeId,
        channelId,
        externalId: payload.externalId,
        status: 'RECEIVED',
        mappedStatus: 'PENDING',
        payload: this.toJson(payload as any),
      },
    })

    try {
      const customerId = await this.ensureCustomer(channel, payload)
      const mappedItems = await this.mapExternalItems(channelId, payload.items)
      const orderResult = await this.ordersService.create({
        tenantId: channel.tenantId,
        storeId: channel.storeId,
        customerId,
        channel: channel.type,
        fulfillmentType: payload.fulfillmentType || 'PICKUP',
        delivery: Number(payload.delivery || 0),
        paymentMethod: payload.paymentMethod || 'MARKETPLACE',
        notes: this.buildMarketplaceNotes(channel, payload),
        idempotencyKey: `marketplace:${channelId}:${payload.externalId}`,
        items: mappedItems,
      })

      const updated = await this.prisma.marketplaceOrder.update({
        where: { id: marketplaceOrder.id },
        data: {
          orderId: orderResult.order.id,
          status: 'CONSOLIDATED',
          mappedStatus: orderResult.order.status,
          processedAt: new Date(),
          failureReason: null,
        },
      })

      return { marketplaceOrder: updated, order: orderResult.order, duplicate: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed = await this.prisma.marketplaceOrder.update({
        where: { id: marketplaceOrder.id },
        data: { status: 'FAILED', failureReason: message },
      })
      return { marketplaceOrder: failed, error: message, duplicate: false }
    }
  }

  async getMarketplacePanel(filters: ChannelContext = {}) {
    const tenantId = filters.tenantId || DEFAULT_TENANT_ID
    const storeId = filters.storeId || DEFAULT_STORE_ID
    const channels = await this.prisma.salesChannel.findMany({
      where: { tenantId, storeId },
      include: {
        products: true,
        marketplaceOrders: true,
        pricePolicies: true,
        stockPolicies: true,
      },
      orderBy: [{ type: 'asc' }, { provider: 'asc' }],
    })

    const byChannel = await Promise.all(channels.map(async (channel) => {
      const orders = await this.prisma.order.findMany({
        where: { tenantId, storeId, channel: channel.type, status: { not: 'CANCELLED' } },
        select: { total: true, items: { select: { finalSubtotal: true, subtotal: true } } },
      })
      const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
      const estimatedMargin = revenue * 0.1
      return {
        id: channel.id,
        type: channel.type,
        provider: channel.provider,
        status: channel.status,
        products: channel.products.length,
        receivedOrders: channel.marketplaceOrders.length,
        failedOrders: channel.marketplaceOrders.filter((order) => order.status === 'FAILED').length,
        consolidatedOrders: channel.marketplaceOrders.filter((order) => order.status === 'CONSOLIDATED').length,
        pricePolicies: channel.pricePolicies.length,
        stockPolicies: channel.stockPolicies.length,
        revenue,
        estimatedMargin,
      }
    }))

    return {
      total: byChannel.length,
      items: byChannel,
      dependencyPanel: byChannel.map((channel) => ({
        channel: channel.type,
        provider: channel.provider,
        status: channel.status,
        failing: channel.failedOrders > 0,
      })),
    }
  }

  private async requireChannel(channelId: string) {
    const channel = await this.prisma.salesChannel.findUnique({ where: { id: channelId } })
    if (!channel) throw new NotFoundException('Canal de venda nao encontrado.')
    return channel
  }

  private assertWebhookSecret(channel: any, headers?: Record<string, string | string[] | undefined>) {
    const config = this.asObject(channel.config)
    const expected = String(config.webhookSecret || '').trim()
    if (!expected) return
    const received = this.getHeader(headers, 'x-marketplace-secret')
    if (received !== expected) throw new ForbiddenException('Segredo do canal invalido.')
  }

  private async ensureCustomer(channel: any, payload: ExternalOrderPayload) {
    const externalCustomer = payload.customer || {}
    const cpf = String(externalCustomer.cpf || `MKT-${channel.id}-${payload.externalId}`).slice(0, 64)
    const whatsapp = String(externalCustomer.whatsapp || `mkt-${this.hash(`${channel.id}:${payload.externalId}`)}@marketplace`).slice(0, 64)
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId: channel.tenantId,
        OR: [
          { cpf },
          { whatsapp },
          ...(externalCustomer.email ? [{ email: externalCustomer.email }] : []),
        ],
      },
    })
    if (existing) return existing.id

    const created = await this.prisma.customer.create({
      data: {
        tenantId: channel.tenantId,
        name: externalCustomer.name || `Cliente ${channel.type}`,
        cpf,
        whatsapp,
        email: externalCustomer.email || null,
        origin: `MARKETPLACE_${channel.type}`,
      },
    })
    return created.id
  }

  private async mapExternalItems(channelId: string, items: ExternalOrderPayload['items']) {
    const mapped = []
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantidade invalida no pedido externo.')

      if (item.productId) {
        mapped.push({ productId: item.productId, quantity })
        continue
      }

      const mapping = await this.prisma.channelProduct.findFirst({
        where: {
          channelId,
          status: 'ACTIVE',
          OR: [
            item.externalId ? { externalId: item.externalId } : undefined,
          ].filter(Boolean) as any,
        },
      })
      if (!mapping) throw new BadRequestException(`Produto externo sem mapeamento: ${item.externalId || 'sem-id'}`)
      mapped.push({ productId: mapping.productId, quantity })
    }
    return mapped
  }

  private buildMarketplaceNotes(channel: any, payload: ExternalOrderPayload) {
    const base = `Marketplace ${channel.type}/${channel.provider} externalId=${payload.externalId}`
    return payload.notes ? `${base}. ${payload.notes}` : base
  }

  private normalizeCode(value: string, fallback = 'UNKNOWN') {
    const normalized = String(value || fallback).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
    return normalized || fallback
  }

  private toJson(value: Record<string, unknown>) {
    return value as Prisma.InputJsonObject
  }

  private asObject(value: Prisma.JsonValue) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }

  private decimal(value: number) {
    return new Prisma.Decimal(Number.isFinite(value) ? value : 0)
  }

  private getHeader(headers: Record<string, string | string[] | undefined> | undefined, name: string) {
    const value = headers?.[name] || headers?.[name.toLowerCase()]
    if (Array.isArray(value)) return String(value[0] || '').trim()
    return String(value || '').trim()
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16)
  }
}
