import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { CreateCartDto, UpdateCartItemDto, UpsertCartItemDto } from './dto/cart.dto'

type CheckoutContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: true }
}>

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async createCart(context: CheckoutContext | undefined, dto: CreateCartDto) {
    const { tenantId, storeId } = this.resolveContext(context, dto.storeId)
    const cart = await this.prisma.cart.create({
      data: {
        tenantId,
        storeId,
        customerId: this.optionalString(dto.customerId),
        deviceId: this.optionalString(dto.deviceId),
        status: 'ACTIVE',
      },
      include: { items: true },
    })

    await this.recordCheckoutEvent({
      tenantId,
      storeId,
      cartId: cart.id,
      type: 'CART_CREATED',
      customerId: cart.customerId,
      deviceId: cart.deviceId,
      metadata: { source: 'cart_api' },
    })

    return this.toCartPayload(cart)
  }

  async findCart(id: string, context?: CheckoutContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    const cart = await this.prisma.cart.findFirst({
      where: { id, tenantId, storeId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    })
    if (!cart) throw new NotFoundException('Carrinho nao encontrado.')
    return this.toCartPayload(cart)
  }

  async addItem(cartId: string, context: CheckoutContext | undefined, dto: UpsertCartItemDto) {
    const cart = await this.getActiveCart(cartId, context)
    const product = await this.validateProductQuantity({ tenantId: cart.tenantId, storeId: cart.storeId }, dto.productId, dto.quantity)
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    })

    const nextQuantity = existing ? Number(existing.quantity) + Number(dto.quantity) : Number(dto.quantity)
    await this.validateProductQuantity({ tenantId: cart.tenantId, storeId: cart.storeId }, product.id, nextQuantity)

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: this.toDecimal(nextQuantity),
          notes: dto.notes ?? existing.notes,
          allowSubstitution: dto.allowSubstitution ?? existing.allowSubstitution,
        },
      })
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity: this.toDecimal(dto.quantity),
          notes: this.optionalString(dto.notes),
          allowSubstitution: dto.allowSubstitution ?? true,
        },
      })
    }

    await this.recordCheckoutEvent({
      tenantId: cart.tenantId,
      storeId: cart.storeId,
      cartId: cart.id,
      type: 'CART_ITEM_ADDED',
      customerId: cart.customerId,
      deviceId: cart.deviceId,
      metadata: { productId: product.id, quantity: dto.quantity, nextQuantity },
    })

    return this.findCart(cart.id, { tenantId: cart.tenantId, storeId: cart.storeId })
  }

  async updateItem(cartId: string, itemId: string, context: CheckoutContext | undefined, dto: UpdateCartItemDto) {
    const cart = await this.getActiveCart(cartId, context)
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } })
    if (!item) throw new NotFoundException('Item do carrinho nao encontrado.')

    await this.validateProductQuantity({ tenantId: cart.tenantId, storeId: cart.storeId }, item.productId, dto.quantity)

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: {
        quantity: this.toDecimal(dto.quantity),
        notes: dto.notes ?? item.notes,
        allowSubstitution: dto.allowSubstitution ?? item.allowSubstitution,
      },
    })

    await this.recordCheckoutEvent({
      tenantId: cart.tenantId,
      storeId: cart.storeId,
      cartId: cart.id,
      type: 'CART_ITEM_UPDATED',
      customerId: cart.customerId,
      deviceId: cart.deviceId,
      metadata: { productId: item.productId, quantity: dto.quantity },
    })

    return this.findCart(cart.id, { tenantId: cart.tenantId, storeId: cart.storeId })
  }

  async deleteItem(cartId: string, itemId: string, context?: CheckoutContext) {
    const cart = await this.getActiveCart(cartId, context)
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } })
    if (!item) throw new NotFoundException('Item do carrinho nao encontrado.')

    await this.prisma.cartItem.delete({ where: { id: item.id } })
    await this.recordCheckoutEvent({
      tenantId: cart.tenantId,
      storeId: cart.storeId,
      cartId: cart.id,
      type: 'CART_ITEM_REMOVED',
      customerId: cart.customerId,
      deviceId: cart.deviceId,
      metadata: { productId: item.productId, quantity: Number(item.quantity) },
    })

    return this.findCart(cart.id, { tenantId: cart.tenantId, storeId: cart.storeId })
  }

  async markConverted(cartId: string, context?: CheckoutContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    return this.prisma.cart.updateMany({
      where: { id: cartId, tenantId, storeId, status: 'ACTIVE' },
      data: { status: 'CONVERTED' },
    })
  }

  async markAbandonedCarts(context: CheckoutContext | undefined, olderThanMinutes = 60) {
    const { tenantId, storeId } = this.resolveContext(context)
    const cutoff = new Date(Date.now() - Math.max(1, Number(olderThanMinutes || 60)) * 60 * 1000)
    const carts = await this.prisma.cart.findMany({
      where: { tenantId, storeId, status: 'ACTIVE', updatedAt: { lte: cutoff } },
      include: { items: true },
      take: 200,
      orderBy: { updatedAt: 'asc' },
    })

    for (const cart of carts) {
      await this.prisma.cart.update({ where: { id: cart.id }, data: { status: 'ABANDONED' } })
      const metadata = {
        itemCount: cart.items.length,
        totalQuantity: cart.items.reduce((sum, item) => sum + Number(item.quantity), 0),
        abandonedAfterMinutes: olderThanMinutes,
      }
      await this.recordCheckoutEvent({
        tenantId: cart.tenantId,
        storeId: cart.storeId,
        cartId: cart.id,
        type: 'CART_ABANDONED',
        customerId: cart.customerId,
        deviceId: cart.deviceId,
        metadata,
      })
      await this.prisma.analyticsEvent.create({
        data: {
          tenantId: cart.tenantId,
          storeId: cart.storeId,
          type: 'CART_ABANDONED',
          entity: 'CART',
          entityId: cart.id,
          customerId: cart.customerId,
          deviceId: cart.deviceId,
          metadata: JSON.stringify(metadata),
        },
      })
    }

    return { abandoned: carts.length }
  }

  private async getActiveCart(id: string, context?: CheckoutContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    const cart = await this.prisma.cart.findFirst({
      where: { id, tenantId, storeId },
      include: { items: true },
    })
    if (!cart) throw new NotFoundException('Carrinho nao encontrado.')
    if (cart.status !== 'ACTIVE') throw new BadRequestException('Carrinho nao esta ativo.')
    return cart
  }

  private async validateProductQuantity(context: { tenantId: string; storeId: string }, productId: string, quantity: number) {
    const id = String(productId || '').trim()
    const normalizedQuantity = Number(quantity)
    if (!id) throw new BadRequestException('productId e obrigatorio.')
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new BadRequestException('Quantidade do item deve ser maior que zero.')
    }

    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: context.tenantId, storeId: context.storeId },
      select: {
        id: true,
        name: true,
        active: true,
        syncOption: true,
        isFractional: true,
        fractionStep: true,
      },
    })
    if (!product) throw new BadRequestException(`Produto nao encontrado: ${id}`)
    if (!product.active || String(product.syncOption || '').toUpperCase() === 'NUNCA') {
      throw new BadRequestException(`Produto indisponivel para venda: ${product.name}`)
    }

    if (!product.isFractional && !Number.isInteger(normalizedQuantity)) {
      throw new BadRequestException(`Produto ${product.name} nao aceita quantidade fracionada.`)
    }

    const step = Number(product.fractionStep || 0)
    if (product.isFractional && step <= 0) {
      throw new BadRequestException(`Produto ${product.name} esta sem fracionamento configurado.`)
    }

    if (product.isFractional) {
      const ratio = normalizedQuantity / step
      if (Math.abs(ratio - Math.round(ratio)) > 0.000001) {
        throw new BadRequestException(`Quantidade do produto ${product.name} deve respeitar o passo ${step}.`)
      }
    }

    return product
  }

  private async recordCheckoutEvent(data: {
    tenantId: string
    storeId: string
    cartId?: string
    type: string
    customerId?: string | null
    deviceId?: string | null
    metadata?: Prisma.InputJsonObject
  }) {
    await this.prisma.checkoutEvent.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        cartId: data.cartId,
        type: data.type,
        customerId: data.customerId || null,
        deviceId: data.deviceId || null,
        metadata: data.metadata || Prisma.JsonNull,
      },
    })
  }

  private resolveContext(context?: CheckoutContext, explicitStoreId?: string) {
    return {
      tenantId: context?.tenantId || DEFAULT_TENANT_ID,
      storeId: explicitStoreId || context?.storeId || DEFAULT_STORE_ID,
    }
  }

  private optionalString(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(Number(value).toFixed(3))
  }

  private toCartPayload(cart: CartWithItems) {
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    }
  }
}
