import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { AuditLogService } from '../audit-log/audit-log.service'
import { PrismaService } from '../../common/prisma.service'
import { CUSTOMER_SAFE_SELECT } from '../../common/customer-safe-select'

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
    // JON-129 (Auditoria 360, Medium): body sem `consents` (ou nao-array)
    // gravava opt-in em TODOS os canais, inclusive os que o cliente nao
    // pediu -- convertia revogacao/opt-out existente em opt-in geral.
    if (!Array.isArray(body?.consents) || body.consents.length === 0) {
      throw new BadRequestException('Informe consents (array) com os canais explicitamente solicitados.')
    }
    const requested = body.consents
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
      select: {
        ...CUSTOMER_SAFE_SELECT,
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

    // JON-121 (Auditoria 360, Medium): take:1000 sem cursor truncava em
    // silencio quem tem mais eventos que isso -- a request ainda fechava
    // como COMPLETED, e repetir a exportacao devolvia os MESMOS 1000 mais
    // recentes (nunca avancava). Pagina por (createdAt asc, id asc) ate
    // esgotar; cap defensivo so contra loop infinito, nao contra volume real.
    const [analyticsEvents, recommendationEvents] = await Promise.all([
      this.exportAllRows((cursor) => this.prisma.analyticsEvent.findMany({
        where: { tenantId, customerId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1000,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })),
      this.exportAllRows((cursor) => this.prisma.recommendationEvent.findMany({
        where: { tenantId, customerId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1000,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })),
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
    // JON-122 (Auditoria 360, Medium): !body.force trata QUALQUER valor
    // truthy-string como autorizacao -- 'false' (string) e truthy em JS, e
    // um serializador de cliente que manda force como string (nao boolean)
    // furava a trava de pedidos ativos sem ninguem pedir isso de verdade.
    // Exige o boolean true explicito, nada de coercao.
    if (activeOrders > 0 && body?.force !== true) {
      throw new BadRequestException('Cliente possui pedidos ativos; anonimização exige force=true ou encerramento operacional.')
    }

    const suffix = customerId.slice(-8).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'customer'
    const anonymized = await this.prisma.$transaction(async (tx) => {
      // JON-119 (Auditoria 360, High): so zerar password nao bastava -- JWT
      // ja emitido continua valido (nao muda tokenVersion), link de reset
      // pendente continua aceito (resetTokenHash intocado) e a conta
      // permanecia blocked=false, entao setPassword reabria acesso sem senha
      // atual. tokenVersion.increment revoga o JWT em uso (mesmo mecanismo
      // do JON-138); blocked=true e checado no JwtStrategy e bloqueia login.
      const customer = await tx.customer.update({
        where: { id: customerId },
        data: {
          name: `Cliente anonimizado ${suffix}`,
          cpf: `ANON${suffix}`,
          whatsapp: `ANON${suffix}`,
          email: `anon-${suffix}@lgpd.local`,
          password: null,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          tokenVersion: { increment: 1 },
          blocked: true,
          blockedReason: 'LGPD_ANONYMIZED',
        },
        select: CUSTOMER_SAFE_SELECT,
      })
      await tx.pushSubscription.deleteMany({ where: { customerId } })
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
          // JON-120 (Auditoria 360, Medium): updateMany zerava os campos
          // postais mas deixava locality/deliveryPointCode intocados --
          // referencia a condominio/localidade especifica (ex.: "Chafariz")
          // sobrevivia a um endereco declarado anonimizado.
          locality: null,
          deliveryPointCode: null,
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

  // JON-121: pagina uma consulta ate esgotar (fetch devolve menos do que
  // pediu). Cap de 200 paginas (200k linhas com take:1000) e so guarda-corpo
  // contra bug de paginacao virar loop infinito -- nao um limite de negocio.
  private async exportAllRows<T>(fetchPage: (cursor: string | null) => Promise<Array<T & { id: string }>>) {
    const rows: Array<T & { id: string }> = []
    let cursor: string | null = null
    for (let page = 0; page < 200; page++) {
      const batch = await fetchPage(cursor)
      rows.push(...batch)
      if (batch.length < 1000) break
      cursor = batch[batch.length - 1].id
    }
    return rows
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
