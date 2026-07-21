import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { AuditLogService } from '../audit-log/audit-log.service'
import { PrismaService } from '../../common/prisma.service'

type PrivacyContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>> & {
  actorId?: string
  ip?: string
  userAgent?: string
}

const LGPD_CONSENT_TYPES = ['TERMS', 'PRIVACY', 'WHATSAPP', 'EMAIL', 'SMS']
const FINAL_ORDER_STATUSES = ['CANCELLED', 'COMPLETED', 'DELIVERED', 'REFUNDED', 'FAILED_SYNC']

@Injectable()
export class DataPrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async upsertConsentBundle(customerId: string, body: any, context?: PrivacyContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    await this.ensureCustomer(customerId, tenantId)
    const requested = Array.isArray(body?.consents) ? body.consents : LGPD_CONSENT_TYPES.map((type) => ({ type, status: body?.status || 'OPT_IN' }))
    const normalized = requested.map((item: any) => ({
      type: this.normalizeConsentType(item.type),
      status: this.normalizeConsentStatus(item.status || 'OPT_IN'),
      source: this.normalizeCode(item.source || body?.source || 'LGPD_CENTER'),
    }))

    const consents = []
    for (const item of normalized) {
      consents.push(await this.prisma.customerConsent.upsert({
        where: { tenantId_customerId_type: { tenantId, customerId, type: item.type } },
        create: {
          tenantId,
          storeId,
          customerId,
          type: item.type,
          status: item.status,
          source: item.source,
          ip: context?.ip || null,
          userAgent: context?.userAgent || null,
        },
        update: {
          status: item.status,
          source: item.source,
          ip: context?.ip || null,
          userAgent: context?.userAgent || null,
        },
      }))
    }

    await this.auditLog.log({
      tenantId,
      storeId,
      action: 'LGPD_CONSENTS_UPSERTED',
      entity: 'Customer',
      entityId: customerId,
      adminId: context?.actorId,
      changes: { consents: normalized },
    })

    return { customerId, consents }
  }

  async exportCustomerData(customerId: string, context?: PrivacyContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        addresses: true,
        profile: true,
        consents: true,
        loyaltyAccount: { include: { ledger: true } },
        campaignDeliveries: true,
        shoppingLists: { include: { items: true } },
        orders: { include: { items: true } },
      },
    })
    if (!customer) throw new NotFoundException('Cliente nao encontrado.')

    const [analyticsEvents, recommendationEvents] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.recommendationEvent.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ])

    const data = {
      customer,
      analyticsEvents,
      recommendationEvents,
      exportedAt: new Date().toISOString(),
      retention: this.retentionPolicy(),
    }

    const request = await this.prisma.dataSubjectRequest.create({
      data: {
        tenantId,
        storeId,
        customerId,
        type: 'EXPORT',
        status: 'COMPLETED',
        requestedBy: context?.actorId || null,
        payload: { includeAnalytics: true, includeRecommendations: true },
        result: { orders: customer.orders.length, consents: customer.consents.length, analyticsEvents: analyticsEvents.length, recommendationEvents: recommendationEvents.length },
        executedAt: new Date(),
      },
    })

    await this.auditLog.log({
      tenantId,
      storeId,
      action: 'LGPD_DATA_EXPORTED',
      entity: 'Customer',
      entityId: customerId,
      adminId: context?.actorId,
      changes: { requestId: request.id },
    })

    return { request, data }
  }

  async anonymizeCustomer(customerId: string, body: any = {}, context?: PrivacyContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    await this.ensureCustomer(customerId, tenantId)
    const activeOrders = await this.prisma.order.count({
      where: { tenantId, customerId, status: { notIn: FINAL_ORDER_STATUSES } },
    })
    if (activeOrders > 0 && !body?.force) {
      throw new BadRequestException('Cliente possui pedidos ativos; anonimização exige force=true ou encerramento operacional.')
    }

    const suffix = customerId.slice(-8).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'customer'
    const anonymized = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: {
          name: `Cliente anonimizado ${suffix}`,
          cpf: `ANON${suffix}`,
          whatsapp: `ANON${suffix}`,
          email: `anon-${suffix}@lgpd.local`,
          password: null,
        },
      })
      await tx.address.updateMany({
        where: { tenantId, customerId },
        data: {
          street: 'Anonimizado',
          number: '0',
          complement: null,
          neighborhood: 'Anonimizado',
          city: 'Anonimizado',
          state: 'NA',
          zipCode: '00000000',
          isDefault: false,
        },
      })
      await tx.customerProfile.updateMany({
        where: { tenantId, customerId },
        data: {
          birthDate: null,
          gender: null,
          preferences: Prisma.JsonNull,
          tags: ['LGPD_ANONYMIZED'],
        },
      })
      await tx.customerConsent.updateMany({
        where: { tenantId, customerId },
        data: {
          status: 'REVOKED',
          source: 'LGPD_ANONYMIZATION',
          ip: context?.ip || null,
          userAgent: context?.userAgent || null,
        },
      })
      const request = await tx.dataSubjectRequest.create({
        data: {
          tenantId,
          storeId,
          customerId,
          type: 'ANONYMIZATION',
          status: 'COMPLETED',
          requestedBy: context?.actorId || null,
          reason: body?.reason || null,
          payload: { force: Boolean(body?.force), activeOrders },
          result: { customerId, anonymized: true },
          executedAt: new Date(),
        },
      })
      return { customer, request }
    })

    await this.auditLog.log({
      tenantId,
      storeId,
      action: 'LGPD_CUSTOMER_ANONYMIZED',
      entity: 'Customer',
      entityId: customerId,
      adminId: context?.actorId,
      changes: { requestId: anonymized.request.id, force: Boolean(body?.force), activeOrders },
    })

    return anonymized
  }

  async getRetentionPolicy() {
    return this.retentionPolicy()
  }

  async listRequests(filters: PrivacyContext & { customerId?: string; status?: string; type?: string } = {}) {
    const { tenantId, storeId } = this.resolveContext(filters)
    return this.prisma.dataSubjectRequest.findMany({
      where: {
        tenantId,
        storeId,
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.status ? { status: this.normalizeCode(filters.status) } : {}),
        ...(filters.type ? { type: this.normalizeCode(filters.type) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  private async ensureCustomer(customerId: string, tenantId: string) {
    const id = String(customerId || '').trim()
    if (!id) throw new BadRequestException('customerId e obrigatorio.')
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!customer) throw new NotFoundException('Cliente nao encontrado.')
  }

  private retentionPolicy() {
    return {
      customerProfile: 'ate revogacao ou anonimização LGPD',
      orders: 'retencao operacional/fiscal; PII em customer/address pode ser anonimizada quando permitido',
      consents: 'mantidos como prova de consentimento/revogacao',
      analytics: 'eventos podem ser retidos de forma pseudonimizada para BI operacional',
      auditLogs: 'mantidos para governanca e rastreabilidade de alteracoes sensiveis',
    }
  }

  private resolveContext(context?: PrivacyContext) {
    return {
      tenantId: context?.tenantId || DEFAULT_TENANT_ID,
      storeId: context?.storeId || DEFAULT_STORE_ID,
    }
  }

  private normalizeConsentType(value: string) {
    const type = this.normalizeCode(value)
    if (!LGPD_CONSENT_TYPES.includes(type)) {
      throw new BadRequestException(`Tipo de consentimento LGPD invalido: ${value}`)
    }
    return type
  }

  private normalizeConsentStatus(value: string) {
    const status = this.normalizeCode(value)
    if (!['OPT_IN', 'OPT_OUT', 'REVOKED'].includes(status)) {
      throw new BadRequestException('Status de consentimento invalido.')
    }
    return status
  }

  private normalizeCode(value: string) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_') || 'UNKNOWN'
  }
}
