import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { PublicApiService } from '../public-api/public-api.service'
import { TenantContext } from '../../common/tenant/tenant-context'

type InventoryContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type ReservationItem = {
  productId: string
  quantity: number
}

type ReservationRequest = {
  tenantId?: string
  storeId?: string
  orderId?: string
  cartId?: string
  items: ReservationItem[]
  expiresAt?: Date
  ttlMinutes?: number
}

type InventoryDbClient = Prisma.TransactionClient | PrismaService

const DEFAULT_RESERVATION_TTL_MIN = 15

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicApiService: PublicApiService,
  ) {}

  async getAvailability(context: Partial<InventoryContext> | undefined, productIds: string[]) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const ids = Array.from(new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean)))

    if (ids.length === 0) {
      return { tenantId, storeId, items: [] }
    }

    await this.ensurePositionsForProducts(this.prisma, tenantId, storeId, ids)

    const positions = await this.prisma.stockPosition.findMany({
      where: { tenantId, storeId, productId: { in: ids } },
      orderBy: { productId: 'asc' },
    })

    return {
      tenantId,
      storeId,
      items: positions.map((position) => this.toAvailabilityPayload(position)),
    }
  }

  async reserveForCheckout(request: ReservationRequest) {
    const tenantId = request.tenantId || DEFAULT_TENANT_ID
    const storeId = request.storeId || DEFAULT_STORE_ID
    const items = this.aggregateItems(request.items)

    if (items.length === 0) {
      throw new BadRequestException('Reserva deve conter ao menos um item.')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensurePositionsForProducts(
        tx,
        tenantId,
        storeId,
        items.map((item) => item.productId),
      )

      const reservations = []

      for (const item of items) {
        const policy = await this.findPolicy(tx, tenantId, storeId, item.productId)
        const ttlMinutes = request.ttlMinutes || Number(policy?.reservationTtlMin || DEFAULT_RESERVATION_TTL_MIN)
        const expiresAt = request.expiresAt || new Date(Date.now() + ttlMinutes * 60 * 1000)
        const quantity = this.toDecimal(item.quantity)

        const updateResult = await tx.stockPosition.updateMany({
          where: {
            tenantId,
            storeId,
            productId: item.productId,
            ...(policy?.allowBackorder ? {} : { available: { gte: quantity } }),
          },
          data: {
            reserved: { increment: quantity },
            available: { decrement: quantity },
            source: policy?.allowBackorder ? 'BACKORDER_POLICY' : 'RESERVATION',
          },
        })

        if (updateResult.count !== 1) {
          throw new BadRequestException(`Estoque indisponivel para o produto: ${item.productId}`)
        }

        const position = await tx.stockPosition.findUniqueOrThrow({
          where: { tenantId_storeId_productId: { tenantId, storeId, productId: item.productId } },
        })

        const reservation = await tx.stockReservation.create({
          data: {
            tenantId,
            storeId,
            orderId: request.orderId,
            cartId: request.cartId,
            productId: item.productId,
            quantity,
            status: 'ACTIVE',
            expiresAt,
          },
        })

        await tx.stockLedger.create({
          data: {
            tenantId,
            storeId,
            productId: item.productId,
            type: 'RESERVE',
            quantity,
            balance: position.available,
            referenceId: reservation.id,
            reason: policy?.allowBackorder ? 'Reserva com politica explicita de backorder' : 'Reserva de checkout',
          },
        })

        reservations.push(reservation)
      }

      return reservations
    })

    return result
  }

  async attachReservationsToOrder(reservationIds: string[], orderId: string) {
    if (reservationIds.length === 0) return { count: 0 }
    return this.prisma.stockReservation.updateMany({
      where: { id: { in: reservationIds }, status: 'ACTIVE' },
      data: { orderId },
    })
  }

  async releaseReservation(id: string, reason = 'Reserva liberada', createdBy?: string) {
    return this.releaseReservations({ reservationIds: [id], status: 'RELEASED', reason, createdBy })
  }

  async releaseOrderReservations(orderId: string, reason = 'Pedido cancelado', createdBy?: string) {
    return this.releaseReservations({ orderId, status: 'RELEASED', reason, createdBy })
  }

  async releaseReservationsByCart(cartId: string, reason = 'Checkout falhou', createdBy?: string) {
    return this.releaseReservations({ cartId, status: 'RELEASED', reason, createdBy })
  }

  async expireReservations(now = new Date()) {
    const expired = await this.prisma.stockReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true },
    })

    if (expired.length === 0) {
      return { expired: 0 }
    }

    const result = await this.releaseReservations({
      reservationIds: expired.map((item) => item.id),
      status: 'EXPIRED',
      reason: 'Reserva expirada automaticamente',
    })

    return { expired: result.count }
  }

  async consumeOrderReservations(orderId: string, createdBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
      })

      for (const reservation of reservations) {
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: 'CONSUMED' },
        })

        await tx.stockPosition.update({
          where: {
            tenantId_storeId_productId: {
              tenantId: reservation.tenantId,
              storeId: reservation.storeId,
              productId: reservation.productId,
            },
          },
          data: {
            onHand: { decrement: reservation.quantity },
            reserved: { decrement: reservation.quantity },
            source: 'SALE',
          },
        })

        const position = await tx.stockPosition.findUniqueOrThrow({
          where: {
            tenantId_storeId_productId: {
              tenantId: reservation.tenantId,
              storeId: reservation.storeId,
              productId: reservation.productId,
            },
          },
        })

        await tx.stockLedger.create({
          data: {
            tenantId: reservation.tenantId,
            storeId: reservation.storeId,
            productId: reservation.productId,
            type: 'SALE',
            quantity: reservation.quantity,
            balance: position.available,
            referenceId: orderId,
            reason: 'Consumo de reserva por confirmacao de pedido',
            createdBy,
          },
        })
      }

      return { consumed: reservations.length }
    })
  }

  async createManualAdjustment(
    context: Partial<InventoryContext> | undefined,
    body: { productId: string; quantity: number; reason: string },
    createdBy?: string,
  ) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const productId = String(body.productId || '').trim()
    const reason = String(body.reason || '').trim()
    const quantity = Number(body.quantity)

    if (!productId) throw new BadRequestException('productId e obrigatorio.')
    if (!Number.isFinite(quantity) || quantity === 0) throw new BadRequestException('quantity deve ser diferente de zero.')
    if (!reason) throw new BadRequestException('Motivo do ajuste e obrigatorio.')

    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensurePositionsForProducts(tx, tenantId, storeId, [productId])

      const position = await tx.stockPosition.findUniqueOrThrow({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId } },
      })

      const onHand = Number(position.onHand) + quantity
      const reserved = Number(position.reserved)
      const safetyStock = Number(position.safetyStock)
      const available = onHand - reserved - safetyStock

      const updated = await tx.stockPosition.update({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId } },
        data: {
          onHand: this.toDecimal(onHand),
          available: this.toDecimal(available),
          source: 'ADJUSTMENT',
        },
      })

      await tx.stockLedger.create({
        data: {
          tenantId,
          storeId,
          productId,
          type: 'MANUAL_ADJUST',
          quantity: this.toDecimal(quantity),
          balance: updated.available,
          referenceId: updated.id,
          reason,
          createdBy,
        },
      })

      return this.toAvailabilityPayload(updated)
    })

    this.publicApiService.emitWebhookEvent('stock.changed', {
      productId,
      reason,
      quantity,
      stock: result,
    }, tenantId, storeId).catch(() => null)
    return result
  }

  async recordPickingRupture(
    context: Partial<InventoryContext> | undefined,
    body: { orderId: string; productId: string; missingQuantity: number; reason: string },
    createdBy?: string,
  ) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const orderId = String(body.orderId || '').trim()
    const productId = String(body.productId || '').trim()
    const reason = String(body.reason || '').trim()
    const missingQuantity = Number(body.missingQuantity)

    if (!orderId) throw new BadRequestException('orderId e obrigatorio.')
    if (!productId) throw new BadRequestException('productId e obrigatorio.')
    if (!Number.isFinite(missingQuantity) || missingQuantity <= 0) {
      throw new BadRequestException('missingQuantity deve ser maior que zero.')
    }
    if (!reason) throw new BadRequestException('Motivo da ruptura e obrigatorio.')

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({
        where: { tenantId, storeId, orderId, productId },
        include: { order: true },
      })

      if (!item) {
        throw new NotFoundException('Item do pedido nao encontrado para ruptura.')
      }

      const adjustedQuantity = Math.min(Number(item.quantity), missingQuantity)
      const newQuantity = Math.max(0, Number(item.quantity) - adjustedQuantity)
      const unitPrice = Number(item.unitPrice)
      const newItemSubtotal = unitPrice * newQuantity
      const subtotalDelta = Number(item.subtotal) - newItemSubtotal
      const orderSubtotal = Math.max(0, Number(item.order.subtotal) - subtotalDelta)
      const orderTotal = Math.max(0, Number(item.order.total) - subtotalDelta)

      const updatedItem = await tx.orderItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          subtotal: newItemSubtotal,
        },
      })

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: orderSubtotal,
          total: orderTotal,
          notes: item.order.notes
            ? `${item.order.notes} | Ruptura ${productId}: -${adjustedQuantity} (${reason})`
            : `Ruptura ${productId}: -${adjustedQuantity} (${reason})`,
        },
      })

      await this.ensurePositionsForProducts(tx, tenantId, storeId, [productId])

      const currentPosition = await tx.stockPosition.findUniqueOrThrow({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId } },
      })
      const newOnHand = Number(currentPosition.onHand) - adjustedQuantity
      const newReserved = Math.max(0, Number(currentPosition.reserved) - adjustedQuantity)
      const newAvailable = newOnHand - newReserved - Number(currentPosition.safetyStock)

      await tx.stockPosition.update({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId } },
        data: {
          onHand: this.toDecimal(newOnHand),
          reserved: this.toDecimal(newReserved),
          available: this.toDecimal(newAvailable),
          source: 'PICK_ADJUST',
        },
      })

      const reservations = await tx.stockReservation.findMany({
        where: { tenantId, storeId, orderId, productId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      })
      let remainingAdjustment = adjustedQuantity
      for (const reservation of reservations) {
        if (remainingAdjustment <= 0) break
        const currentQuantity = Number(reservation.quantity)
        const decrement = Math.min(currentQuantity, remainingAdjustment)
        const nextQuantity = currentQuantity - decrement
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            quantity: this.toDecimal(nextQuantity),
            status: nextQuantity <= 0 ? 'ADJUSTED' : 'ACTIVE',
          },
        })
        remainingAdjustment -= decrement
      }

      const position = await tx.stockPosition.findUniqueOrThrow({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId } },
      })

      await tx.stockLedger.create({
        data: {
          tenantId,
          storeId,
          productId,
          type: 'PICK_ADJUST',
          quantity: this.toDecimal(adjustedQuantity),
          balance: position.available,
          referenceId: orderId,
          reason,
          createdBy,
        },
      })

      await tx.analyticsEvent.create({
        data: {
          tenantId,
          storeId,
          type: 'RUPTURE',
          entity: 'PRODUCT',
          entityId: productId,
          metadata: JSON.stringify({ orderId, adjustedQuantity, reason }),
        },
      })

      return {
        order: updatedOrder,
        item: updatedItem,
        adjustedQuantity,
        stock: this.toAvailabilityPayload(position),
      }
    })
  }

  async listNegativeStock(context?: Partial<InventoryContext>) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const positions = await this.prisma.stockPosition.findMany({
      where: {
        tenantId,
        storeId,
        OR: [{ onHand: { lt: 0 } }, { available: { lt: 0 } }],
      },
      orderBy: [{ available: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    })

    return {
      tenantId,
      storeId,
      items: positions.map((position) => this.toAvailabilityPayload(position)),
    }
  }

  async createReconciliationReport(context?: Partial<InventoryContext>, createdBy?: string) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID

    const [products, positions] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId, storeId },
        select: { id: true, stock: true },
      }),
      this.prisma.stockPosition.findMany({
        where: { tenantId, storeId },
        select: { productId: true, onHand: true, reserved: true, available: true, safetyStock: true },
      }),
    ])

    const byProduct = new Map(positions.map((position) => [position.productId, position]))
    const divergences = products
      .map((product) => {
        const position = byProduct.get(product.id)
        const erpStock = Number(product.stock || 0)
        const platformStock = Number(position?.onHand || 0)
        return {
          productId: product.id,
          erpStock,
          platformStock,
          difference: platformStock - erpStock,
        }
      })
      .filter((item) => item.difference !== 0)

    const run = await this.prisma.stockReconciliationRun.create({
      data: {
        tenantId,
        storeId,
        source: 'ERP',
        status: 'COMPLETED',
        finishedAt: new Date(),
        checkedCount: products.length,
        divergenceCount: divergences.length,
        summary: { divergences: divergences.slice(0, 100) },
        createdBy,
      },
    })

    return {
      id: run.id,
      tenantId,
      storeId,
      checkedCount: products.length,
      divergenceCount: divergences.length,
      divergences: divergences.slice(0, 100),
    }
  }

  async syncFromErp(context?: Partial<InventoryContext>) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const products = await this.prisma.product.findMany({
      where: { tenantId, storeId },
      select: { id: true, stock: true },
    })

    for (const product of products) {
      const onHand = this.toDecimal(Number(product.stock || 0))
      await this.prisma.stockPosition.upsert({
        where: { tenantId_storeId_productId: { tenantId, storeId, productId: product.id } },
        create: {
          tenantId,
          storeId,
          productId: product.id,
          onHand,
          available: onHand,
          reserved: 0,
          safetyStock: 0,
          source: 'ERP_SYNC',
        },
        update: {
          onHand,
          available: onHand,
          source: 'ERP_SYNC',
        },
      })
    }

    await this.recalculateAvailable({ tenantId, storeId })

    return { synced: products.length }
  }

  async recalculateAvailable(context?: Partial<InventoryContext>) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID
    const result = await this.prisma.$executeRaw`
      UPDATE "stock_positions"
      SET "available" = "onHand" - "reserved" - "safetyStock", "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId} AND "storeId" = ${storeId}
    `

    return { recalculated: Number(result) }
  }

  private async releaseReservations(params: {
    reservationIds?: string[]
    orderId?: string
    cartId?: string
    status: 'RELEASED' | 'EXPIRED'
    reason: string
    createdBy?: string
  }) {
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: {
          status: 'ACTIVE',
          ...(params.reservationIds ? { id: { in: params.reservationIds } } : {}),
          ...(params.orderId ? { orderId: params.orderId } : {}),
          ...(params.cartId ? { cartId: params.cartId } : {}),
        },
      })

      for (const reservation of reservations) {
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: params.status },
        })

        await tx.stockPosition.update({
          where: {
            tenantId_storeId_productId: {
              tenantId: reservation.tenantId,
              storeId: reservation.storeId,
              productId: reservation.productId,
            },
          },
          data: {
            reserved: { decrement: reservation.quantity },
            available: { increment: reservation.quantity },
            source: params.status,
          },
        })

        const position = await tx.stockPosition.findUniqueOrThrow({
          where: {
            tenantId_storeId_productId: {
              tenantId: reservation.tenantId,
              storeId: reservation.storeId,
              productId: reservation.productId,
            },
          },
        })

        await tx.stockLedger.create({
          data: {
            tenantId: reservation.tenantId,
            storeId: reservation.storeId,
            productId: reservation.productId,
            type: params.status === 'EXPIRED' ? 'EXPIRE' : 'RELEASE',
            quantity: reservation.quantity,
            balance: position.available,
            referenceId: reservation.id,
            reason: params.reason,
            createdBy: params.createdBy,
          },
        })
      }

      if (params.reservationIds?.length && reservations.length === 0) {
        const existing = await tx.stockReservation.findFirst({ where: { id: { in: params.reservationIds } } })
        if (!existing) throw new NotFoundException('Reserva de estoque nao encontrada.')
      }

      return { count: reservations.length }
    })
  }

  private async ensurePositionsForProducts(tx: InventoryDbClient, tenantId: string, storeId: string, productIds: string[]) {
    const existing = await tx.stockPosition.findMany({
      where: { tenantId, storeId, productId: { in: productIds } },
      select: { productId: true },
    })
    const existingIds = new Set(existing.map((item) => item.productId))
    const missingIds = productIds.filter((id) => !existingIds.has(id))
    if (missingIds.length === 0) return

    const products = await tx.product.findMany({
      where: { tenantId, storeId, id: { in: missingIds } },
      select: { id: true, stock: true },
    })

    for (const product of products) {
      const onHand = Number(product.stock || 0)
      await tx.stockPosition.create({
        data: {
          tenantId,
          storeId,
          productId: product.id,
          onHand: this.toDecimal(onHand),
          reserved: 0,
          available: this.toDecimal(onHand),
          safetyStock: 0,
          source: 'LEGACY_ON_DEMAND',
        },
      })
    }
  }

  private async findPolicy(tx: InventoryDbClient, tenantId: string, storeId: string, productId: string) {
    return tx.stockPolicy.findFirst({
      where: {
        tenantId,
        storeId,
        productId,
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  private aggregateItems(items: ReservationItem[]) {
    const byProduct = new Map<string, number>()

    for (const item of items || []) {
      const productId = String(item.productId || '').trim()
      const quantity = Number(item.quantity)
      if (!productId) throw new BadRequestException('Item de reserva sem produto.')
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantidade de reserva invalida.')
      byProduct.set(productId, (byProduct.get(productId) || 0) + quantity)
    }

    return Array.from(byProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }))
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(Number(value).toFixed(3))
  }

  private toAvailabilityPayload(position: {
    productId: string
    onHand: Prisma.Decimal | number | string
    reserved: Prisma.Decimal | number | string
    available: Prisma.Decimal | number | string
    safetyStock: Prisma.Decimal | number | string
    source: string
    updatedAt: Date
  }) {
    return {
      productId: position.productId,
      onHand: Number(position.onHand),
      reserved: Number(position.reserved),
      available: Number(position.available),
      safetyStock: Number(position.safetyStock),
      source: position.source,
      updatedAt: position.updatedAt,
    }
  }
}
