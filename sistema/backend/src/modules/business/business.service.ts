import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { OrdersService } from '../orders/orders.service'
import { IntegrationsService } from '../integrations/integrations.service'

type BusinessContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async listAccounts(context?: BusinessContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    return this.prisma.businessAccount.findMany({
      where: { tenantId, OR: [{ storeId }, { storeId: DEFAULT_STORE_ID }] },
      include: {
        _count: { select: { users: true, priceLists: true, orders: true, shoppingLists: true } },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
  }

  async createAccount(context: BusinessContext | undefined, body: any) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = body.storeId || context?.storeId || DEFAULT_STORE_ID
    const name = String(body.name || '').trim()
    const document = this.normalizeDocument(body.document)
    if (!name) throw new BadRequestException('Nome da conta comercial e obrigatorio.')
    if (!document) throw new BadRequestException('Documento da conta comercial e obrigatorio.')

    return this.prisma.businessAccount.create({
      data: {
        tenantId,
        storeId,
        name,
        document,
        status: String(body.status || 'ACTIVE').toUpperCase(),
        creditLimit: body.creditLimit == null ? null : this.decimal2(Number(body.creditLimit)),
        minimumOrder: body.minimumOrder == null ? null : this.decimal2(Number(body.minimumOrder)),
        paymentTerms: body.paymentTerms ? String(body.paymentTerms) : null,
        invoiceProfile: body.invoiceProfile || Prisma.JsonNull,
        recurringRules: body.recurringRules || Prisma.JsonNull,
      },
    })
  }

  async addUser(accountId: string, context: BusinessContext | undefined, body: any) {
    const account = await this.findAccountOrThrow(accountId, context)
    const customerId = String(body.customerId || '').trim()
    if (!customerId) throw new BadRequestException('customerId e obrigatorio.')

    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId: account.tenantId } })
    if (!customer) throw new BadRequestException('Cliente nao encontrado para vinculo B2B.')

    return this.prisma.businessAccountUser.upsert({
      where: { accountId_customerId: { accountId, customerId } },
      create: {
        accountId,
        customerId,
        role: String(body.role || 'BUYER').toUpperCase(),
        status: String(body.status || 'ACTIVE').toUpperCase(),
      },
      update: {
        role: String(body.role || 'BUYER').toUpperCase(),
        status: String(body.status || 'ACTIVE').toUpperCase(),
      },
      include: { account: true, customer: true },
    })
  }

  async getCustomerBusinessContext(customerId: string, context?: BusinessContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
        account: { tenantId, status: 'ACTIVE', OR: [{ storeId }, { storeId: DEFAULT_STORE_ID }] },
      },
      include: {
        account: {
          include: {
            priceLists: {
              where: { status: 'ACTIVE' },
              select: { id: true, name: true, channel: true, customerSegment: true, _count: { select: { items: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) return { business: false, account: null }

    const financial = await this.getFinancialSummary(membership.accountId, context)
    return {
      business: true,
      role: membership.role,
      account: membership.account,
      financial,
    }
  }

  async getFinancialSummary(accountId: string, context?: BusinessContext) {
    const account = await this.findAccountOrThrow(accountId, context)
    const [ordersAgg, pendingApprovals, activeUsers] = await Promise.all([
      this.prisma.order.aggregate({
        where: { tenantId: account.tenantId, storeId: account.storeId, businessAccountId: account.id, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: { tenantId: account.tenantId, storeId: account.storeId, businessAccountId: account.id, businessApprovalStatus: 'PENDING' },
      }),
      this.prisma.businessAccountUser.count({
        where: { accountId: account.id, status: 'ACTIVE' },
      }),
    ])
    const used = Number(ordersAgg._sum.total || 0)
    const limit = account.creditLimit == null ? null : Number(account.creditLimit)
    return {
      accountId: account.id,
      name: account.name,
      document: account.document,
      status: account.status,
      activeUsers,
      orderCount: ordersAgg._count._all,
      usedCredit: this.round2(used),
      creditLimit: limit,
      availableCredit: limit == null ? null : this.round2(Math.max(0, limit - used)),
      minimumOrder: account.minimumOrder == null ? null : Number(account.minimumOrder),
      paymentTerms: account.paymentTerms,
      pendingApprovals,
    }
  }

  async listCorporateShoppingLists(accountId: string, context?: BusinessContext) {
    const account = await this.findAccountOrThrow(accountId, context)
    return this.prisma.shoppingList.findMany({
      where: { tenantId: account.tenantId, storeId: account.storeId, businessAccountId: account.id, status: 'ACTIVE' },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createCorporateShoppingList(accountId: string, context: BusinessContext | undefined, body: any) {
    const account = await this.findAccountOrThrow(accountId, context)
    const name = String(body.name || '').trim()
    if (!name) throw new BadRequestException('Nome da lista corporativa e obrigatorio.')

    const customerId = await this.resolveCorporateListCustomer(account.id, body.customerId)
    const items = this.normalizeShoppingListItems(body.items || [])
    if (items.length === 0) throw new BadRequestException('Lista corporativa deve conter ao menos um item.')

    const products = await this.prisma.product.findMany({
      where: { tenantId: account.tenantId, storeId: account.storeId, id: { in: items.map((item) => item.productId) } },
      select: { id: true },
    })
    const validProductIds = new Set(products.map((product) => product.id))
    const invalid = items.find((item) => !validProductIds.has(item.productId))
    if (invalid) throw new BadRequestException(`Produto nao encontrado para lista corporativa: ${invalid.productId}`)

    return this.prisma.shoppingList.create({
      data: {
        tenantId: account.tenantId,
        storeId: account.storeId,
        customerId,
        businessAccountId: account.id,
        name,
        source: 'BUSINESS_ACCOUNT',
        items: {
          create: items.map((item, index) => ({
            productId: item.productId,
            quantity: this.decimal3(item.quantity),
            sortOrder: index,
          })),
        },
      },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  async createRecurringOrder(accountId: string, context: BusinessContext | undefined, body: any) {
    const account = await this.findAccountOrThrow(accountId, context)
    const rules = this.parseJsonObject(account.recurringRules)
    if (rules.enabled === false && !body.force) {
      throw new BadRequestException('Recorrencia B2B esta desativada para esta conta.')
    }

    const list = await this.findRecurringShoppingList(account.id, body.shoppingListId)
    const items = list.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
    if (items.length === 0) throw new BadRequestException('Lista corporativa nao possui itens para recorrencia.')

    const idempotencyKey = String(body.idempotencyKey || this.buildRecurringIdempotencyKey(account.id, list.id)).trim()
    const result = await this.ordersService.create({
      customerId: list.customerId,
      idempotencyKey,
      items,
      delivery: Number(body.delivery || 0),
      paymentMethod: String(body.paymentMethod || 'INVOICE').toUpperCase(),
      fulfillmentType: String(body.fulfillmentType || 'PICKUP').toUpperCase(),
      channel: 'B2B_RECURRING',
      tenantId: account.tenantId,
      storeId: account.storeId,
      businessAccountId: account.id,
      requiresApproval: body.requiresApproval == null ? Boolean(rules.requiresApproval ?? true) : Boolean(body.requiresApproval),
      notes: String(body.notes || `Pedido recorrente B2B - ${list.name}`).trim(),
    })

    await this.prisma.auditLog.create({
      data: {
        tenantId: account.tenantId,
        storeId: account.storeId,
        action: 'B2B_RECURRING_ORDER_CREATED',
        entity: 'BUSINESS_ACCOUNT',
        entityId: account.id,
        adminId: body.actorId || null,
        changes: JSON.stringify({
          orderId: result.order.id,
          shoppingListId: list.id,
          frequency: rules.frequency || null,
          status: result.order.status,
          businessApprovalStatus: result.order.businessApprovalStatus,
        }),
      },
    })

    return {
      accountId: account.id,
      shoppingListId: list.id,
      idempotencyKey,
      order: result.order,
      whatsapp: result.whatsapp,
    }
  }

  async runBillingForOrder(orderId: string, context: BusinessContext | undefined) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, storeId, businessAccountId: { not: null } },
      select: { id: true, businessAccountId: true, businessApprovalStatus: true },
    })
    if (!order) throw new NotFoundException('Pedido B2B nao encontrado para faturamento.')
    if (order.businessApprovalStatus === 'PENDING') {
      throw new BadRequestException('Pedido B2B precisa ser aprovado antes de faturar.')
    }

    const [fiscal, charge] = await Promise.all([
      this.integrationsService.syncFiscalDocument(order.id),
      this.integrationsService.syncChargePayment(order.id),
    ])

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        storeId,
        action: 'B2B_BILLING_RUN',
        entity: 'ORDER',
        entityId: order.id,
        changes: JSON.stringify({
          businessAccountId: order.businessAccountId,
          fiscalSuccess: fiscal.success,
          fiscalRef: fiscal.ref || null,
          fiscalError: fiscal.error || null,
          chargeSuccess: charge.success,
          chargeId: charge.chargeId || null,
          chargeError: charge.error || null,
        }),
      },
    })

    return { orderId: order.id, businessAccountId: order.businessAccountId, fiscal, charge }
  }

  async runBillingForAccount(accountId: string, context: BusinessContext | undefined, body: any) {
    const account = await this.findAccountOrThrow(accountId, context)
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: account.tenantId,
        storeId: account.storeId,
        businessAccountId: account.id,
        businessApprovalStatus: 'APPROVED',
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        paymentMethod: { in: ['INVOICE', 'BOLETO', 'PIX'] },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(25, Number(body.limit || 10))),
      select: { id: true },
    })

    const results = []
    for (const order of orders) {
      results.push(await this.runBillingForOrder(order.id, { tenantId: account.tenantId, storeId: account.storeId }))
    }

    return { accountId: account.id, processed: results.length, results }
  }

  async createAccountPriceList(accountId: string, context: BusinessContext | undefined, body: any) {
    const account = await this.findAccountOrThrow(accountId, context)
    const name = String(body.name || `Tabela ${account.name}`).trim()
    const priceList = await this.prisma.priceList.create({
      data: {
        tenantId: account.tenantId,
        storeId: account.storeId,
        channel: String(body.channel || 'STOREFRONT').toUpperCase(),
        businessAccountId: account.id,
        name,
        status: String(body.status || 'ACTIVE').toUpperCase(),
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    })

    if (Array.isArray(body.items) && body.items.length > 0) {
      await this.prisma.priceListItem.createMany({
        data: body.items.map((item: any) => ({
          priceListId: priceList.id,
          productId: String(item.productId || '').trim(),
          price: this.decimal2(Number(item.price)),
          cost: item.cost == null ? null : this.decimal2(Number(item.cost)),
        })).filter((item: any) => item.productId && Number(item.price) > 0),
      })
    }

    return this.prisma.priceList.findUnique({ where: { id: priceList.id }, include: { items: true } })
  }

  async listApprovalQueue(context?: BusinessContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    return this.prisma.order.findMany({
      where: { tenantId, storeId, businessApprovalStatus: 'PENDING' },
      include: { customer: true, businessAccount: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async approveOrder(orderId: string, context: BusinessContext | undefined, actorId?: string) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId, storeId, businessApprovalStatus: 'PENDING' } })
    if (!order) throw new NotFoundException('Pedido B2B pendente nao encontrado.')
    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PENDING',
        businessApprovalStatus: 'APPROVED',
        businessApprovedBy: actorId || null,
        businessApprovedAt: new Date(),
      },
    })
  }

  private async findAccountOrThrow(accountId: string, context?: BusinessContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const account = await this.prisma.businessAccount.findFirst({
      where: { id: accountId, tenantId, OR: [{ storeId }, { storeId: DEFAULT_STORE_ID }] },
    })
    if (!account) throw new NotFoundException('Conta comercial nao encontrada.')
    return account
  }

  private normalizeDocument(value: unknown) {
    return String(value || '').replace(/\D/g, '')
  }

  private decimal2(value: number) {
    if (!Number.isFinite(value) || value < 0) throw new BadRequestException('Valor comercial invalido.')
    return new Prisma.Decimal(value.toFixed(2))
  }

  private decimal3(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException('Quantidade invalida.')
    return new Prisma.Decimal(value.toFixed(3))
  }

  private normalizeShoppingListItems(items: any[]) {
    if (!Array.isArray(items)) return []
    const byProduct = new Map<string, { productId: string; quantity: number }>()
    for (const item of items) {
      const productId = String(item.productId || '').trim()
      const quantity = Number(item.quantity || 1)
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue
      const current = byProduct.get(productId)
      byProduct.set(productId, { productId, quantity: this.round3((current?.quantity || 0) + quantity) })
    }
    return [...byProduct.values()]
  }

  private async resolveCorporateListCustomer(accountId: string, customerId?: string) {
    if (customerId) {
      const membership = await this.prisma.businessAccountUser.findFirst({
        where: { accountId, customerId, status: 'ACTIVE' },
        select: { customerId: true },
      })
      if (!membership) throw new BadRequestException('Cliente nao pertence a conta comercial.')
      return membership.customerId
    }

    const firstMembership = await this.prisma.businessAccountUser.findFirst({
      where: { accountId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { customerId: true },
    })
    if (!firstMembership) throw new BadRequestException('Conta comercial precisa ter ao menos um usuario ativo.')
    return firstMembership.customerId
  }

  private async findRecurringShoppingList(accountId: string, shoppingListId?: string) {
    const where = shoppingListId
      ? { id: shoppingListId, businessAccountId: accountId, status: 'ACTIVE' }
      : { businessAccountId: accountId, status: 'ACTIVE' }
    const list = await this.prisma.shoppingList.findFirst({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    })
    if (!list) throw new BadRequestException('Lista corporativa ativa nao encontrada para recorrencia.')
    return list
  }

  private parseJsonObject(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, any>
    return value as Record<string, any>
  }

  private buildRecurringIdempotencyKey(accountId: string, listId: string) {
    const today = new Date().toISOString().slice(0, 10)
    return `b2b-recurring:${accountId}:${listId}:${today}`
  }

  private round2(value: number) {
    return Number(value.toFixed(2))
  }

  private round3(value: number) {
    return Number(value.toFixed(3))
  }
}
