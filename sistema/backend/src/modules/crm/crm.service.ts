import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { CreateCampaignDto, CreateShoppingListDto, LoyaltyMutationDto, RefreshSegmentsDto, ReorderFromOrderDto, UpsertCustomerConsentDto, UpsertCustomerProfileDto } from './dto/crm.dto'

type CrmContext = {
  tenantId?: string
  storeId?: string
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerRelationship(customerId: string, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        profile: true,
        consents: { orderBy: { updatedAt: 'desc' } },
        loyaltyAccount: { include: { ledger: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        shoppingLists: { where: { status: 'ACTIVE' }, include: { items: true }, orderBy: { updatedAt: 'desc' }, take: 10 },
        orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { items: true } },
      },
    })
    if (!customer) throw new NotFoundException('Cliente nao encontrado.')

    return {
      customer,
      quickReorder: customer.orders.map((order) => ({
        orderId: order.id,
        createdAt: order.createdAt,
        total: order.total,
        items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      })),
    }
  }

  async upsertProfile(customerId: string, body: UpsertCustomerProfileDto, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    await this.ensureCustomer(customerId, tenantId)
    return this.prisma.customerProfile.upsert({
      where: { tenantId_customerId: { tenantId, customerId } },
      create: {
        tenantId,
        storeId,
        customerId,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        gender: this.optional(body.gender),
        preferences: body.preferences ? this.toJson(body.preferences) : Prisma.JsonNull,
        tags: this.normalizeArray(body.tags),
      },
      update: {
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        gender: body.gender !== undefined ? this.optional(body.gender) : undefined,
        preferences: body.preferences !== undefined ? this.toJson(body.preferences) : undefined,
        tags: body.tags !== undefined ? this.normalizeArray(body.tags) : undefined,
      },
    })
  }

  async upsertConsent(customerId: string, body: UpsertCustomerConsentDto, context?: CrmContext & { ip?: string; userAgent?: string }) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    await this.ensureCustomer(customerId, tenantId)
    const type = this.normalizeCode(body.type)
    return this.prisma.customerConsent.upsert({
      where: { tenantId_customerId_type: { tenantId, customerId, type } },
      create: {
        tenantId,
        storeId,
        customerId,
        type,
        status: this.normalizeConsentStatus(body.status),
        source: this.normalizeCode(body.source),
        ip: context?.ip || null,
        userAgent: context?.userAgent || null,
      },
      update: {
        status: this.normalizeConsentStatus(body.status),
        source: this.normalizeCode(body.source),
        ip: context?.ip || null,
        userAgent: context?.userAgent || null,
      },
    })
  }

  async refreshCustomerMetrics(context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const customers = await this.prisma.customer.findMany({ where: { tenantId }, select: { id: true } })

    for (const customer of customers) {
      const aggregate = await this.prisma.order.aggregate({
        where: { tenantId, storeId, customerId: customer.id, status: { notIn: ['CANCELLED', 'FAILED_SYNC'] } },
        _sum: { total: true },
        _avg: { total: true },
        _count: { _all: true },
        _max: { createdAt: true },
      })
      const lastOrderAt = aggregate._max.createdAt
      const daysSinceLastOrder = lastOrderAt ? Math.floor((Date.now() - lastOrderAt.getTime()) / 86_400_000) : 999
      const churnRiskScore = Math.max(0, Math.min(100, daysSinceLastOrder))
      await this.prisma.customerProfile.upsert({
        where: { tenantId_customerId: { tenantId, customerId: customer.id } },
        create: {
          tenantId,
          storeId,
          customerId: customer.id,
          ltv: this.decimal2(aggregate._sum.total || 0),
          orderCount: aggregate._count._all,
          averageTicket: this.decimal2(aggregate._avg.total || 0),
          lastOrderAt,
          churnRiskScore,
          tags: [],
        },
        update: {
          ltv: this.decimal2(aggregate._sum.total || 0),
          orderCount: aggregate._count._all,
          averageTicket: this.decimal2(aggregate._avg.total || 0),
          lastOrderAt,
          churnRiskScore,
        },
      })
    }

    return { updated: customers.length }
  }

  async refreshSegments(body: RefreshSegmentsDto = {}, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    await this.refreshCustomerMetrics({ tenantId, storeId })
    const inactiveDays = Number(body.inactiveDays || 45)
    const highTicketThreshold = Number(body.highTicketThreshold || 200)

    const segmentDefinitions = [
      { key: 'inactive', name: 'Clientes inativos', rules: { lastOrderOlderThanDays: inactiveDays } },
      { key: 'high_ticket', name: 'Alto ticket', rules: { averageTicketGte: highTicketThreshold } },
      { key: 'new_customers', name: 'Novos clientes', rules: { createdWithinDays: 30 } },
      { key: 'churn_risk', name: 'Risco de churn', rules: { churnRiskScoreGte: 30 } },
    ]

    const results = []
    for (const definition of segmentDefinitions) {
      const segment = await this.prisma.customerSegment.upsert({
        where: { tenantId_key: { tenantId, key: definition.key } },
        create: { tenantId, storeId, key: definition.key, name: definition.name, rules: definition.rules, status: 'ACTIVE', refreshedAt: new Date() },
        update: { name: definition.name, rules: definition.rules, status: 'ACTIVE', refreshedAt: new Date() },
      })

      const members = await this.matchSegmentMembers(definition.key, { tenantId, storeId, inactiveDays, highTicketThreshold })
      await this.prisma.customerSegmentMember.deleteMany({ where: { segmentId: segment.id } })
      if (members.length > 0) {
        await this.prisma.customerSegmentMember.createMany({
          data: members.map((member) => ({
            tenantId,
            storeId,
            segmentId: segment.id,
            customerId: member.customerId,
            reason: member.reason,
            score: member.score,
          })),
        })
      }
      results.push({ segmentId: segment.id, key: definition.key, members: members.length })
    }
    return { refreshed: results.length, segments: results }
  }

  async mutateLoyalty(customerId: string, type: string, body: LoyaltyMutationDto, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    await this.ensureCustomer(customerId, tenantId)
    const pointsDelta = Number(body.points || 0)
    const cashbackDelta = Number(body.cashback || 0)
    if (pointsDelta === 0 && cashbackDelta === 0) throw new BadRequestException('Movimento de fidelidade deve alterar pontos ou cashback.')

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.upsert({
        where: { tenantId_customerId: { tenantId, customerId } },
        create: { tenantId, storeId, customerId, points: 0, cashback: 0, tier: 'BASIC' },
        update: {},
      })
      const nextPoints = Number(account.points) + pointsDelta
      const nextCashback = Number(account.cashback) + cashbackDelta
      if (nextPoints < 0 || nextCashback < 0) throw new BadRequestException('Saldo de fidelidade insuficiente.')
      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: this.decimal2(nextPoints),
          cashback: this.decimal2(nextCashback),
          tier: this.resolveTier(nextPoints, nextCashback),
        },
      })
      const ledger = await tx.loyaltyLedger.create({
        data: {
          tenantId,
          storeId,
          accountId: account.id,
          customerId,
          type: this.normalizeCode(type),
          pointsDelta: this.decimal2(pointsDelta),
          cashbackDelta: this.decimal2(cashbackDelta),
          pointsBalance: updated.points,
          cashbackBalance: updated.cashback,
          referenceType: this.optional(body.referenceType),
          referenceId: this.optional(body.referenceId),
          reason: body.reason,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      })
      return { account: updated, ledger }
    })
  }

  async getLoyalty(customerId: string, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    return this.prisma.loyaltyAccount.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
      include: { ledger: { orderBy: { createdAt: 'desc' }, take: 100 } },
    })
  }

  async createCampaign(body: CreateCampaignDto, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    return this.prisma.campaign.create({
      data: {
        tenantId,
        storeId,
        name: body.name,
        channel: this.normalizeCode(body.channel),
        segmentId: this.optional(body.segmentId),
        template: this.toJson(body.template),
        status: this.normalizeCode(body.status || 'DRAFT'),
      },
    })
  }

  async dispatchCampaign(campaignId: string, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId }, include: { segment: { include: { members: true } } } })
    if (!campaign) throw new NotFoundException('Campanha nao encontrada.')
    const customerIds = campaign.segment?.members.map((member) => member.customerId)
      || (await this.prisma.customer.findMany({ where: { tenantId }, select: { id: true } })).map((item) => item.id)
    const channelConsent = this.channelToConsent(campaign.channel)
    const consents = await this.prisma.customerConsent.findMany({
      where: { tenantId, customerId: { in: customerIds }, type: channelConsent, status: 'OPT_IN' },
    })
    const byCustomer = new Map(consents.map((consent) => [consent.customerId, consent]))
    const allowedCustomerIds = customerIds.filter((customerId) => byCustomer.has(customerId))

    if (allowedCustomerIds.length > 0) {
      await this.prisma.campaignDelivery.createMany({
        data: allowedCustomerIds.map((customerId) => ({
          tenantId,
          storeId,
          campaignId,
          customerId,
          channel: campaign.channel,
          status: 'PENDING',
          payload: campaign.template,
          consentId: byCustomer.get(customerId)?.id || null,
        })),
      })
    }

    await this.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SCHEDULED' } })
    return { eligible: customerIds.length, consented: allowedCustomerIds.length, blockedByConsent: customerIds.length - allowedCustomerIds.length }
  }

  async createShoppingList(customerId: string, body: CreateShoppingListDto, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    await this.ensureCustomer(customerId, tenantId)
    const items = this.normalizeItems(body.items)
    return this.prisma.shoppingList.create({
      data: {
        tenantId,
        storeId,
        customerId,
        name: body.name,
        source: this.normalizeCode(body.source || 'MANUAL'),
        items: {
          create: items.map((item, index) => ({
            productId: item.productId,
            quantity: this.decimal3(item.quantity),
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    })
  }

  async createShoppingListFromOrder(customerId: string, body: ReorderFromOrderDto, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const order = await this.prisma.order.findFirst({
      where: { id: body.orderId, customerId, tenantId, storeId },
      include: { items: true },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado para recompra.')
    return this.createShoppingList(customerId, {
      name: body.name || `Recompra ${order.id.slice(-6)}`,
      source: 'REORDER',
      items: order.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
    }, { tenantId, storeId })
  }

  async getReorderPayload(customerId: string, orderId: string, context?: CrmContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId, tenantId, storeId }, include: { items: true } })
    if (!order) throw new NotFoundException('Pedido nao encontrado para recompra.')
    return {
      orderId,
      items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    }
  }

  private async ensureCustomer(customerId: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } })
    if (!customer) throw new NotFoundException('Cliente nao encontrado.')
  }

  private async matchSegmentMembers(key: string, params: { tenantId: string; storeId: string; inactiveDays: number; highTicketThreshold: number }) {
    const now = Date.now()
    const customers = await this.prisma.customer.findMany({ where: { tenantId: params.tenantId }, include: { profile: true, orders: { orderBy: { createdAt: 'desc' }, take: 1 } } })
    return customers.flatMap((customer) => {
      const profile = customer.profile
      const lastOrderAt = profile?.lastOrderAt || customer.orders[0]?.createdAt || null
      const days = lastOrderAt ? Math.floor((now - lastOrderAt.getTime()) / 86_400_000) : 999
      const avg = Number(profile?.averageTicket || 0)
      const createdDays = Math.floor((now - customer.createdAt.getTime()) / 86_400_000)
      const score = key === 'high_ticket' ? Math.round(avg) : days
      const match =
        (key === 'inactive' && days >= params.inactiveDays) ||
        (key === 'high_ticket' && avg >= params.highTicketThreshold) ||
        (key === 'new_customers' && createdDays <= 30) ||
        (key === 'churn_risk' && days >= 30 && Number(profile?.orderCount || 0) > 0)
      return match ? [{ customerId: customer.id, score, reason: { daysSinceLastOrder: days, averageTicket: avg, createdDays } }] : []
    })
  }

  private normalizeItems(items: Array<{ productId: string; quantity?: number }>) {
    const byProduct = new Map<string, number>()
    for (const item of items || []) {
      const productId = String(item.productId || '').trim()
      const quantity = Number(item.quantity || 1)
      if (!productId) throw new BadRequestException('Item sem produto.')
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantidade invalida.')
      byProduct.set(productId, (byProduct.get(productId) || 0) + quantity)
    }
    if (byProduct.size === 0) throw new BadRequestException('Lista deve conter itens.')
    return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }))
  }

  private normalizeArray(values?: string[]) {
    return Array.from(new Set((values || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)))
  }

  private normalizeCode(value: string) {
    return String(value || '').trim().toUpperCase()
  }

  private normalizeConsentStatus(value: string) {
    const status = this.normalizeCode(value)
    if (!['OPT_IN', 'OPT_OUT', 'REVOKED'].includes(status)) throw new BadRequestException('Status de consentimento invalido.')
    return status
  }

  private optional(value?: string) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private channelToConsent(channel: string) {
    const normalized = this.normalizeCode(channel)
    if (normalized === 'WHATSAPP') return 'WHATSAPP'
    if (normalized === 'SMS') return 'SMS'
    if (normalized === 'PUSH') return 'PUSH'
    return 'EMAIL'
  }

  private resolveTier(points: number, cashback: number) {
    if (points >= 5000 || cashback >= 500) return 'BLACK'
    if (points >= 1500 || cashback >= 150) return 'GOLD'
    if (points >= 500 || cashback >= 50) return 'SILVER'
    return 'BASIC'
  }

  private decimal2(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(Number(value || 0).toFixed(2))
  }

  private decimal3(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(Number(value || 0).toFixed(3))
  }

  private toJson(value: Record<string, unknown>) {
    return value as Prisma.InputJsonObject
  }
}
