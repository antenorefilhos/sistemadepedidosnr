import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'

type PricingContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

type QuoteItemInput = {
  productId: string
  quantity: number
}

type QuoteRequest = {
  tenantId?: string
  storeId?: string
  channel?: string
  customerId?: string
  customerSegment?: string
  businessAccountId?: string
  couponCode?: string
  deliveryAmount?: number
  items: QuoteItemInput[]
}

type QuoteProduct = {
  id: string
  ean: string
  name: string
  category: string
  tenantId: string
  storeId: string
  price: number
  promotionalPrice: number | null
  active: boolean
  syncOption: string
}

type QuoteItem = {
  productId: string
  ean: string
  name: string
  category: string
  quantity: number
  listPrice: number
  unitPrice: number
  cost: number | null
  margin: number | null
  subtotal: number
  priceListId: string | null
}

type PromotionLike = Prisma.PromotionGetPayload<{
  include: {
    rules: true
    coupons: true
  }
}>

type PromotionApplication = {
  promotionId: string
  couponId?: string
  name: string
  type: string
  priority: number
  stackable: boolean
  discountAmount: number
  freeShipping: boolean
}

@Injectable()
export class PromotionEngineService {
  apply(promotions: PromotionLike[], quote: { items: QuoteItem[]; subtotal: number; deliveryAmount: number }) {
    const candidates = promotions
      .map((promotion) => this.evaluatePromotion(promotion, quote))
      .filter((application): application is PromotionApplication => Boolean(application) && application.discountAmount > 0)
      .sort((a, b) => b.priority - a.priority || b.discountAmount - a.discountAmount)

    const applied: PromotionApplication[] = []
    let lockedByNonStackable = false

    for (const candidate of candidates) {
      if (lockedByNonStackable) break
      applied.push(candidate)
      if (!candidate.stackable) lockedByNonStackable = true
    }

    const discountAmount = Math.min(
      quote.subtotal + quote.deliveryAmount,
      applied.reduce((sum, item) => sum + item.discountAmount, 0),
    )
    const freeShipping = applied.some((item) => item.freeShipping)

    return {
      applied,
      discountAmount: this.round2(discountAmount),
      freeShipping,
    }
  }

  private evaluatePromotion(
    promotion: PromotionLike,
    quote: { items: QuoteItem[]; subtotal: number; deliveryAmount: number },
  ): PromotionApplication | null {
    const rule = promotion.rules[0]
    if (!rule) return null

    const condition = this.asObject(rule.condition)
    const effect = this.asObject(rule.effect)

    if (typeof condition.minSubtotal === 'number' && quote.subtotal < condition.minSubtotal) return null
    if (Array.isArray(condition.productIds) && !quote.items.some((item) => condition.productIds.includes(item.productId))) return null
    if (Array.isArray(condition.categories) && !quote.items.some((item) => condition.categories.includes(item.category))) return null

    let discountAmount = 0
    let freeShipping = false
    const effectType = String(effect.type || promotion.type || '').toUpperCase()

    if (effectType === 'PERCENT_OFF' || effectType === 'PERCENT' || promotion.type === 'COUPON') {
      const percent = Number(effect.percent ?? effect.value ?? 0)
      discountAmount = quote.subtotal * (percent / 100)
    }

    if (effectType === 'FIXED_OFF' || effectType === 'FIXED') {
      discountAmount = Number(effect.amount ?? effect.value ?? 0)
    }

    if (effectType === 'FREE_SHIPPING') {
      discountAmount = quote.deliveryAmount
      freeShipping = true
    }

    if (effectType === 'PROGRESSIVE') {
      const tiers = Array.isArray(effect.tiers) ? effect.tiers : []
      const matchingTier = tiers
        .filter((tier) => quote.subtotal >= Number(tier.minSubtotal || 0))
        .sort((a, b) => Number(b.minSubtotal || 0) - Number(a.minSubtotal || 0))[0]
      if (matchingTier) {
        discountAmount = quote.subtotal * (Number(matchingTier.percent || 0) / 100)
      }
    }

    if (typeof effect.maxDiscount === 'number') {
      discountAmount = Math.min(discountAmount, effect.maxDiscount)
    }

    discountAmount = this.round2(Math.max(0, discountAmount))
    if (discountAmount <= 0) return null

    return {
      promotionId: promotion.id,
      couponId: promotion.coupons[0]?.id,
      name: promotion.name,
      type: promotion.type,
      priority: promotion.priority,
      stackable: promotion.stackable,
      discountAmount,
      freeShipping,
    }
  }

  private asObject(value: Prisma.JsonValue) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}
  }

  private round2(value: number) {
    return Number(value.toFixed(2))
  }
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionEngine: PromotionEngineService,
  ) {}

  async quote(request: QuoteRequest) {
    const tenantId = request.tenantId || DEFAULT_TENANT_ID
    const storeId = request.storeId || DEFAULT_STORE_ID
    const channel = String(request.channel || 'STOREFRONT').toUpperCase()
    const items = this.aggregateItems(request.items || [])
    const deliveryAmount = this.round2(Number(request.deliveryAmount || 0))
    const businessAccount = await this.resolveBusinessAccount({
      tenantId,
      storeId,
      customerId: request.customerId,
      businessAccountId: request.businessAccountId,
    })
    if (request.businessAccountId && !businessAccount) {
      throw new BadRequestException('Conta comercial nao encontrada ou sem acesso para cotacao.')
    }

    if (items.length === 0) {
      throw new BadRequestException('Quote deve conter ao menos um item.')
    }
    if (!Number.isFinite(deliveryAmount) || deliveryAmount < 0) {
      throw new BadRequestException('Taxa de entrega invalida.')
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, storeId, id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        ean: true,
        name: true,
        category: true,
        tenantId: true,
        storeId: true,
        price: true,
        promotionalPrice: true,
        active: true,
        syncOption: true,
      },
    })
    const productsById = new Map(products.map((product) => [product.id, product as QuoteProduct]))

    const priceLists = await this.findPriceLists({
      tenantId,
      storeId,
      channel,
      customerId: request.customerId,
      customerSegment: request.customerSegment,
      businessAccountId: businessAccount?.id,
    })
    const priceListItems = await this.findPriceListItems(priceLists.map((list) => list.id), items.map((item) => item.productId))
    const priceByProduct = this.pickPriceListItems(priceLists, priceListItems)

    const quoteItems = items.map((item) => {
      const product = productsById.get(item.productId)
      if (!product) throw new BadRequestException(`Produto nao encontrado: ${item.productId}`)
      if (!product.active || String(product.syncOption || '').toUpperCase() === 'NUNCA') {
        throw new BadRequestException(`Produto indisponivel para venda: ${product.name}`)
      }

      const priceListItem = priceByProduct.get(item.productId)
      const unitPrice = Number(priceListItem?.price ?? product.promotionalPrice ?? product.price)
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException(`Produto sem preco valido: ${product.name}`)
      }

      const cost = priceListItem?.cost == null ? null : Number(priceListItem.cost)
      const margin = cost == null ? null : this.round2(((unitPrice - cost) / unitPrice) * 100)
      const subtotal = this.round2(unitPrice * item.quantity)

      return {
        productId: product.id,
        ean: product.ean,
        name: product.name,
        category: product.category,
        quantity: item.quantity,
        listPrice: this.round2(Number(product.price)),
        unitPrice: this.round2(unitPrice),
        cost,
        margin,
        subtotal,
        priceListId: priceListItem?.priceListId || null,
      }
    })

    const subtotal = this.round2(quoteItems.reduce((sum, item) => sum + item.subtotal, 0))
    const promotions = await this.findEligiblePromotions({
      tenantId,
      storeId,
      couponCode: request.couponCode,
      customerId: request.customerId,
    })
    const promotionResult = this.promotionEngine.apply(promotions, { items: quoteItems, subtotal, deliveryAmount })
    const adjustedDelivery = promotionResult.freeShipping ? 0 : deliveryAmount
    const total = this.round2(subtotal + adjustedDelivery - promotionResult.discountAmount)

    return {
      tenantId,
      storeId,
      channel,
      businessAccountId: businessAccount?.id || null,
      businessPaymentTerms: businessAccount?.paymentTerms || null,
      businessCreditLimit: businessAccount?.creditLimit == null ? null : Number(businessAccount.creditLimit),
      businessMinimumOrder: businessAccount?.minimumOrder == null ? null : Number(businessAccount.minimumOrder),
      businessMinimumOrderMet: businessAccount?.minimumOrder == null ? true : subtotal >= Number(businessAccount.minimumOrder),
      items: quoteItems,
      subtotal,
      deliveryAmount: adjustedDelivery,
      originalDeliveryAmount: deliveryAmount,
      discountAmount: promotionResult.discountAmount,
      total,
      appliedPromotions: promotionResult.applied,
      couponCode: request.couponCode ? String(request.couponCode).trim().toUpperCase() : null,
      estimatedMargin: this.estimateMargin(quoteItems),
    }
  }

  async validateCoupon(code: string, subtotal: number, context?: PricingContext & { customerId?: string }) {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      return { valid: false, code: '', message: 'Informe um cupom para validar.', discountAmount: 0 }
    }

    try {
      const result = await this.quote({
        tenantId: context?.tenantId,
        storeId: context?.storeId,
        customerId: context?.customerId,
        couponCode: normalizedCode,
        items: [{ productId: '__coupon_validation__', quantity: 1 }],
      })
      return {
        valid: result.discountAmount > 0,
        code: normalizedCode,
        message: result.discountAmount > 0 ? 'Cupom aplicado com sucesso.' : 'Cupom sem beneficio para este pedido.',
        discountAmount: result.discountAmount,
      }
    } catch {
      const coupon = await this.findCoupon(normalizedCode, context)
      if (!coupon) {
        return { valid: false, code: normalizedCode, message: 'Cupom invalido ou inativo.', discountAmount: 0 }
      }

      const amount = await this.previewCouponDiscount(coupon, Number(subtotal || 0), context?.customerId)
      return {
        valid: amount > 0,
        code: normalizedCode,
        message: amount > 0 ? 'Cupom aplicado com sucesso.' : 'Cupom sem beneficio para este pedido.',
        discountAmount: amount,
      }
    }
  }

  async recordPromotionUsage(quote: { tenantId: string; appliedPromotions: PromotionApplication[] }, orderId: string, customerId?: string) {
    if (!quote.appliedPromotions?.length) return { count: 0 }

    await this.prisma.promotionUsage.createMany({
      data: quote.appliedPromotions.map((promotion) => ({
        tenantId: quote.tenantId,
        promotionId: promotion.promotionId,
        couponId: promotion.couponId,
        customerId,
        orderId,
        discountAmount: this.toDecimal(promotion.discountAmount),
      })),
    })

    return { count: quote.appliedPromotions.length }
  }

  async listPriceLists(context?: PricingContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    return this.prisma.priceList.findMany({
      where: { tenantId, ...(context?.storeId ? { OR: [{ storeId: context.storeId }, { storeId: null }] } : {}) },
      include: { _count: { select: { items: true } } },
      orderBy: [{ status: 'asc' }, { channel: 'asc' }, { name: 'asc' }],
    })
  }

  async createPriceList(context: PricingContext | undefined, body: any, createdBy?: string) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const data = {
      tenantId,
      storeId: body.storeId ?? context?.storeId ?? null,
      channel: String(body.channel || 'STOREFRONT').toUpperCase(),
      customerSegment: body.customerSegment ?? null,
      customerId: body.customerId ?? null,
      businessAccountId: body.businessAccountId ?? null,
      name: String(body.name || '').trim(),
      status: body.status || 'ACTIVE',
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    }
    if (!data.name) throw new BadRequestException('Nome da lista de preco e obrigatorio.')

    const priceList = await this.prisma.priceList.create({ data })
    await this.prisma.priceAuditLog.create({
      data: { tenantId, storeId: data.storeId, priceListId: priceList.id, action: 'CREATE_PRICE_LIST', newValue: data, createdBy },
    })
    return priceList
  }

  async bulkUpsertPriceItems(priceListId: string, items: Array<{ productId: string; price: number; cost?: number; startsAt?: string; endsAt?: string }>, createdBy?: string) {
    const priceList = await this.prisma.priceList.findUnique({ where: { id: priceListId } })
    if (!priceList) throw new NotFoundException('Lista de preco nao encontrada.')

    const result = []
    for (const item of items || []) {
      const productId = String(item.productId || '').trim()
      const price = Number(item.price)
      if (!productId || !Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('Itens de preco exigem productId e price positivo.')
      }

      const cost = item.cost == null ? null : Number(item.cost)
      const margin = cost == null ? null : this.round2(((price - cost) / price) * 100)
      const upserted = await this.prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId, productId } },
        create: {
          priceListId,
          productId,
          price: this.toDecimal(price),
          cost: cost == null ? null : this.toDecimal(cost),
          margin: margin == null ? null : this.toDecimal(margin),
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          endsAt: item.endsAt ? new Date(item.endsAt) : null,
        },
        update: {
          price: this.toDecimal(price),
          cost: cost == null ? null : this.toDecimal(cost),
          margin: margin == null ? null : this.toDecimal(margin),
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          endsAt: item.endsAt ? new Date(item.endsAt) : null,
        },
      })
      await this.prisma.priceAuditLog.create({
        data: {
          tenantId: priceList.tenantId,
          storeId: priceList.storeId,
          priceListId,
          productId,
          action: 'UPSERT_PRICE_ITEM',
          newValue: { price, cost, margin },
          createdBy,
        },
      })
      result.push(upserted)
    }

    return { count: result.length, items: result }
  }

  async listPromotions(context?: PricingContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    return this.prisma.promotion.findMany({
      where: { tenantId, ...(context?.storeId ? { OR: [{ storeId: context.storeId }, { storeId: null }] } : {}) },
      include: { rules: true, coupons: true, _count: { select: { usages: true } } },
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    })
  }

  async createPromotion(context: PricingContext | undefined, body: any) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date()
    const endsAt = body.endsAt ? new Date(body.endsAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    if (endsAt <= startsAt) throw new BadRequestException('endsAt deve ser posterior a startsAt.')

    const promotion = await this.prisma.promotion.create({
      data: {
        tenantId,
        storeId: body.storeId ?? context?.storeId ?? null,
        name: String(body.name || '').trim(),
        type: String(body.type || 'AUTOMATIC').toUpperCase(),
        status: body.status || 'DRAFT',
        priority: Number(body.priority || 0),
        stackable: Boolean(body.stackable),
        startsAt,
        endsAt,
        budgetLimit: body.budgetLimit == null ? null : this.toDecimal(Number(body.budgetLimit)),
        rules: {
          create: {
            condition: body.condition || {},
            effect: body.effect || {},
          },
        },
        coupons: body.couponCode
          ? {
              create: {
                tenantId,
                code: String(body.couponCode).trim().toUpperCase(),
                maxUses: body.maxUses ?? null,
                maxUsesPerCustomer: body.maxUsesPerCustomer ?? null,
                status: 'ACTIVE',
              },
            }
          : undefined,
      },
      include: { rules: true, coupons: true },
    })

    return promotion
  }

  async simulatePromotion(id: string, body: any) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id }, include: { rules: true, coupons: true } })
    if (!promotion) throw new NotFoundException('Promocao nao encontrada.')

    const quote = await this.quote({
      tenantId: promotion.tenantId,
      storeId: promotion.storeId || body.storeId,
      channel: body.channel || 'STOREFRONT',
      items: body.items || [],
      deliveryAmount: body.deliveryAmount || 0,
    })
    const simulated = this.promotionEngine.apply([promotion], {
      items: quote.items,
      subtotal: quote.subtotal,
      deliveryAmount: quote.originalDeliveryAmount,
    })

    return {
      promotionId: id,
      subtotal: quote.subtotal,
      estimatedDiscount: simulated.discountAmount,
      estimatedTotal: this.round2(quote.subtotal + quote.originalDeliveryAmount - simulated.discountAmount),
      estimatedMarginBefore: quote.estimatedMargin,
      estimatedMarginAfter: this.estimateMarginAfterDiscount(quote.items, simulated.discountAmount),
    }
  }

  private async findPriceLists(params: {
    tenantId: string
    storeId: string
    channel: string
    customerId?: string
    customerSegment?: string
    businessAccountId?: string
  }) {
    const now = new Date()
    const lists = await this.prisma.priceList.findMany({
      where: {
        tenantId: params.tenantId,
        channel: params.channel,
        status: 'ACTIVE',
        OR: [{ storeId: params.storeId }, { storeId: null }],
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          { OR: [{ businessAccountId: null }, { businessAccountId: params.businessAccountId || '__none__' }] },
          { OR: [{ customerId: null }, { customerId: params.customerId || '__none__' }] },
          { OR: [{ customerSegment: null }, { customerSegment: params.customerSegment || '__none__' }] },
        ],
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    })
    return lists.sort((a, b) => {
      const score = (list: (typeof lists)[number]) => {
        let total = 0
        if (list.storeId === params.storeId) total += 32
        if (params.businessAccountId && list.businessAccountId === params.businessAccountId) total += 16
        if (params.customerId && list.customerId === params.customerId) total += 8
        if (params.customerSegment && list.customerSegment === params.customerSegment) total += 4
        total += list.startsAt ? Math.min(3, list.startsAt.getTime() / 1_000_000_000_000) : 0
        return total
      }
      return score(b) - score(a)
    })
  }

  private async resolveBusinessAccount(params: {
    tenantId: string
    storeId: string
    customerId?: string
    businessAccountId?: string
  }) {
    if (params.businessAccountId) {
      return this.prisma.businessAccount.findFirst({
        where: {
          id: params.businessAccountId,
          tenantId: params.tenantId,
          status: 'ACTIVE',
          OR: [{ storeId: params.storeId }, { storeId: DEFAULT_STORE_ID }],
          ...(params.customerId
            ? { users: { some: { customerId: params.customerId, status: 'ACTIVE' } } }
            : {}),
        },
      })
    }

    if (!params.customerId) return null
    const membership = await this.prisma.businessAccountUser.findFirst({
      where: {
        customerId: params.customerId,
        status: 'ACTIVE',
        account: {
          tenantId: params.tenantId,
          status: 'ACTIVE',
          OR: [{ storeId: params.storeId }, { storeId: DEFAULT_STORE_ID }],
        },
      },
      include: { account: true },
      orderBy: { createdAt: 'asc' },
    })
    return membership?.account || null
  }

  private async findPriceListItems(priceListIds: string[], productIds: string[]) {
    if (priceListIds.length === 0) return []
    const now = new Date()
    return this.prisma.priceListItem.findMany({
      where: {
        priceListId: { in: priceListIds },
        productId: { in: productIds },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    })
  }

  private pickPriceListItems(priceLists: Array<{ id: string }>, items: Array<{ productId: string; priceListId: string; price: Prisma.Decimal; cost: Prisma.Decimal | null }>) {
    const priority = new Map(priceLists.map((list, index) => [list.id, index]))
    const byProduct = new Map<string, (typeof items)[number]>()
    for (const item of items) {
      const current = byProduct.get(item.productId)
      if (!current || (priority.get(item.priceListId) ?? 9999) < (priority.get(current.priceListId) ?? 9999)) {
        byProduct.set(item.productId, item)
      }
    }
    return byProduct
  }

  private async findEligiblePromotions(params: { tenantId: string; storeId: string; couponCode?: string; customerId?: string }) {
    const now = new Date()
    const baseWhere = {
      tenantId: params.tenantId,
      status: 'ACTIVE',
      OR: [{ storeId: params.storeId }, { storeId: null }],
      startsAt: { lte: now },
      endsAt: { gte: now },
    }

    if (params.couponCode) {
      const coupon = await this.findCoupon(params.couponCode, { tenantId: params.tenantId, storeId: params.storeId, customerId: params.customerId })
      if (!coupon) throw new BadRequestException('Cupom invalido ou inativo.')
      await this.assertCouponUsageLimit(coupon, params.customerId)
      return [coupon.promotion]
    }

    return this.prisma.promotion.findMany({
      where: { ...baseWhere, type: { not: 'COUPON' } },
      include: { rules: true, coupons: true },
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    })
  }

  private async findCoupon(code: string, context?: PricingContext & { customerId?: string }) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const now = new Date()
    return this.prisma.coupon.findFirst({
      where: {
        tenantId,
        code: String(code || '').trim().toUpperCase(),
        status: 'ACTIVE',
        promotion: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gte: now },
          OR: [{ storeId: context?.storeId || DEFAULT_STORE_ID }, { storeId: null }],
        },
      },
      include: { promotion: { include: { rules: true, coupons: true } } },
    })
  }

  private async assertCouponUsageLimit(coupon: NonNullable<Awaited<ReturnType<PricingService['findCoupon']>>>, customerId?: string) {
    if (coupon.maxUses != null) {
      const globalUses = await this.prisma.promotionUsage.count({ where: { couponId: coupon.id } })
      if (globalUses >= coupon.maxUses) throw new BadRequestException('Cupom atingiu o limite global de usos.')
    }
    if (coupon.maxUsesPerCustomer != null && customerId) {
      const customerUses = await this.prisma.promotionUsage.count({ where: { couponId: coupon.id, customerId } })
      if (customerUses >= coupon.maxUsesPerCustomer) throw new BadRequestException('Cupom atingiu o limite por cliente.')
    }
  }

  private async previewCouponDiscount(coupon: NonNullable<Awaited<ReturnType<PricingService['findCoupon']>>>, subtotal: number, customerId?: string) {
    if (!Number.isFinite(subtotal) || subtotal <= 0) return 0
    await this.assertCouponUsageLimit(coupon, customerId)
    const rule = coupon.promotion.rules[0]
    if (!rule) return 0
    const condition = rule.condition as Record<string, any>
    const effect = rule.effect as Record<string, any>
    if (typeof condition.minSubtotal === 'number' && subtotal < condition.minSubtotal) return 0
    let amount = 0
    const effectType = String(effect.type || '').toUpperCase()
    if (effectType === 'PERCENT_OFF' || effectType === 'PERCENT') amount = subtotal * (Number(effect.percent || effect.value || 0) / 100)
    if (effectType === 'FIXED_OFF' || effectType === 'FIXED') amount = Number(effect.amount || effect.value || 0)
    if (typeof effect.maxDiscount === 'number') amount = Math.min(amount, effect.maxDiscount)
    return this.round2(Math.max(0, Math.min(amount, subtotal)))
  }

  private aggregateItems(items: QuoteItemInput[]) {
    const byProduct = new Map<string, number>()
    for (const item of items) {
      const productId = String(item.productId || '').trim()
      const quantity = Number(item.quantity)
      if (!productId) throw new BadRequestException('Item de quote sem produto.')
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantidade de quote invalida.')
      byProduct.set(productId, (byProduct.get(productId) || 0) + quantity)
    }
    return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }))
  }

  private estimateMargin(items: QuoteItem[]) {
    const itemsWithCost = items.filter((item) => item.cost != null)
    if (itemsWithCost.length === 0) return null
    const revenue = itemsWithCost.reduce((sum, item) => sum + item.subtotal, 0)
    const cost = itemsWithCost.reduce((sum, item) => sum + Number(item.cost || 0) * item.quantity, 0)
    return this.round2(((revenue - cost) / revenue) * 100)
  }

  private estimateMarginAfterDiscount(items: QuoteItem[], discount: number) {
    const itemsWithCost = items.filter((item) => item.cost != null)
    if (itemsWithCost.length === 0) return null
    const revenue = Math.max(0.01, itemsWithCost.reduce((sum, item) => sum + item.subtotal, 0) - discount)
    const cost = itemsWithCost.reduce((sum, item) => sum + Number(item.cost || 0) * item.quantity, 0)
    return this.round2(((revenue - cost) / revenue) * 100)
  }

  private round2(value: number) {
    return Number(value.toFixed(2))
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(Number(value).toFixed(2))
  }
}
