import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'
import {
  AddDeliveryStopDto,
  CreateDeliveryAreaDto,
  CreateDeliveryRouteDto,
  CreateDriverDto,
  CreateFulfillmentSlotDto,
  UpdateDeliveryAreaDto,
  UpdateDeliveryStopStatusDto,
  UpdateFulfillmentSlotDto,
} from './dto/fulfillment.dto'

export interface DeliveryCalculation {
  fee: number | null
  rawFee?: number | null
  freeAbove: number | null
  minimumOrder?: number | null
  minimumOrderMet?: boolean
  zoneName: string | null
  zoneId: string | null
  isFree: boolean
  outOfArea: boolean
}

type DeliveryLookup = {
  tenantId?: string
  storeId?: string
  cep?: string
  lat?: number
  lng?: number
  subtotal?: number
}

type FulfillmentContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type SlotValidationOptions = {
  reservedOrdersOffset?: number
  reservedItemsOffset?: number
}

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async listZones() {
    return this.prisma.deliveryZone.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async createZone(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({
      data: {
        name: dto.name,
        type: dto.type ?? 'CEP_RANGE',
        cepStart: dto.cepStart ?? null,
        cepEnd: dto.cepEnd ?? null,
        polygonGeoJSON: dto.polygonGeoJSON ?? null,
        fee: dto.fee,
        freeAbove: dto.freeAbove ?? null,
        active: dto.active ?? true,
        priority: dto.priority ?? 0,
      },
    })
  }

  async updateZone(id: string, dto: UpdateDeliveryZoneDto) {
    await this.findZoneOrThrow(id)
    return this.prisma.deliveryZone.update({
      where: { id },
      data: { ...dto },
    })
  }

  async deleteZone(id: string) {
    await this.findZoneOrThrow(id)
    await this.prisma.deliveryZone.delete({ where: { id } })
  }

  async listAreas(context?: Partial<FulfillmentContext>) {
    return this.prisma.deliveryArea.findMany({
      where: {
        ...tenantStoreWhere(context),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async createArea(context: Partial<FulfillmentContext> | undefined, dto: CreateDeliveryAreaDto) {
    const scoped = this.resolveContext(context)
    return this.prisma.deliveryArea.create({
      data: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        name: dto.name,
        type: this.normalizeAreaType(dto.type),
        rule: this.toJsonPayload(dto.rule),
        fee: this.decimal2(dto.fee),
        minimumOrder: dto.minimumOrder == null ? null : this.decimal2(dto.minimumOrder),
        freeAbove: dto.freeAbove == null ? null : this.decimal2(dto.freeAbove),
        priority: dto.priority ?? 0,
        status: dto.status || 'ACTIVE',
      },
    })
  }

  async updateArea(id: string, context: Partial<FulfillmentContext> | undefined, dto: UpdateDeliveryAreaDto) {
    await this.findAreaOrThrow(id, context)
    return this.prisma.deliveryArea.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: this.normalizeAreaType(dto.type) } : {}),
        ...(dto.rule !== undefined ? { rule: this.toJsonPayload(dto.rule) } : {}),
        ...(dto.fee !== undefined ? { fee: this.decimal2(dto.fee) } : {}),
        ...(dto.minimumOrder !== undefined ? { minimumOrder: dto.minimumOrder == null ? null : this.decimal2(dto.minimumOrder) } : {}),
        ...(dto.freeAbove !== undefined ? { freeAbove: dto.freeAbove == null ? null : this.decimal2(dto.freeAbove) } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    })
  }

  async deleteArea(id: string, context?: Partial<FulfillmentContext>) {
    await this.findAreaOrThrow(id, context)
    await this.prisma.deliveryArea.delete({ where: { id } })
  }

  async calculate({ tenantId, storeId, cep, lat, lng, subtotal }: DeliveryLookup): Promise<DeliveryCalculation> {
    const area = await this.findMatchingArea({ tenantId, storeId, cep, lat, lng })
    if (area) return this.areaToCalculation(area, subtotal)
    return this.calculateLegacyZone({ tenantId, storeId, cep, lat, lng, subtotal })
  }

  async listSlots(
    context: Partial<FulfillmentContext> | undefined,
    filters: { type?: string; from?: string; to?: string; status?: string } = {},
  ) {
    const scoped = this.resolveContext(context)
    const from = filters.from ? new Date(filters.from) : undefined
    const to = filters.to ? new Date(filters.to) : undefined

    return this.prisma.fulfillmentSlot.findMany({
      where: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        ...(filters.type ? { type: filters.type.toUpperCase() } : {}),
        ...(filters.status ? { status: filters.status.toUpperCase() } : { status: 'ACTIVE' }),
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ startsAt: 'asc' }],
    })
  }

  async listSlotOccupancy(
    context: Partial<FulfillmentContext> | undefined,
    filters: { type?: string; from?: string; to?: string; status?: string } = {},
  ) {
    const slots = await this.listSlots(context, filters)
    return slots.map((slot) => this.slotOccupancy(slot))
  }

  async createSlot(context: Partial<FulfillmentContext> | undefined, dto: CreateFulfillmentSlotDto) {
    const scoped = this.resolveContext(context)
    const startsAt = new Date(dto.startsAt)
    const endsAt = new Date(dto.endsAt)
    this.assertValidWindow(startsAt, endsAt)

    return this.prisma.fulfillmentSlot.create({
      data: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        type: dto.type.toUpperCase(),
        startsAt,
        endsAt,
        capacityOrders: dto.capacityOrders,
        capacityItems: dto.capacityItems ?? null,
        cutoffMinutes: dto.cutoffMinutes ?? 0,
        status: dto.status || 'ACTIVE',
      },
    })
  }

  async updateSlot(id: string, context: Partial<FulfillmentContext> | undefined, dto: UpdateFulfillmentSlotDto) {
    const current = await this.findSlotOrThrow(id, context)
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt
    this.assertValidWindow(startsAt, endsAt)

    return this.prisma.fulfillmentSlot.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type.toUpperCase() } : {}),
        ...(dto.startsAt !== undefined ? { startsAt } : {}),
        ...(dto.endsAt !== undefined ? { endsAt } : {}),
        ...(dto.capacityOrders !== undefined ? { capacityOrders: dto.capacityOrders } : {}),
        ...(dto.capacityItems !== undefined ? { capacityItems: dto.capacityItems ?? null } : {}),
        ...(dto.cutoffMinutes !== undefined ? { cutoffMinutes: dto.cutoffMinutes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    })
  }

  async deleteSlot(id: string, context?: Partial<FulfillmentContext>) {
    const slot = await this.findSlotOrThrow(id, context)
    if (slot.reservedOrders > 0) {
      throw new BadRequestException('Janela possui reservas e nao pode ser removida.')
    }
    await this.prisma.fulfillmentSlot.delete({ where: { id } })
  }

  async validateSlotCapacity(
    context: Partial<FulfillmentContext> | undefined,
    slotId: string | null | undefined,
    type: string,
    itemCount = 0,
    options: SlotValidationOptions = {},
  ) {
    if (!slotId) {
      return { valid: false, reason: 'SLOT_REQUIRED', slot: null, occupancy: null }
    }

    const scoped = this.resolveContext(context)
    const slot = await this.prisma.fulfillmentSlot.findFirst({
      where: { id: slotId, tenantId: scoped.tenantId, storeId: scoped.storeId },
    })
    if (!slot) return { valid: false, reason: 'SLOT_NOT_FOUND', slot: null, occupancy: null }

    const normalizedType = type.toUpperCase() === 'RETIRADA' ? 'PICKUP' : type.toUpperCase()
    const occupancy = this.slotOccupancy(slot, options)
    if (slot.status !== 'ACTIVE') return { valid: false, reason: 'SLOT_INACTIVE', slot, occupancy }
    if (slot.type !== normalizedType) return { valid: false, reason: 'SLOT_TYPE_MISMATCH', slot, occupancy }
    if (occupancy.cutoffExpired) return { valid: false, reason: 'SLOT_CUTOFF_EXPIRED', slot, occupancy }
    if (occupancy.availableOrders < 1) return { valid: false, reason: 'SLOT_FULL_ORDERS', slot, occupancy }
    if (slot.capacityItems != null && occupancy.availableItems != null && occupancy.availableItems < itemCount) {
      return { valid: false, reason: 'SLOT_FULL_ITEMS', slot, occupancy }
    }

    return { valid: true, reason: null, slot, occupancy }
  }

  async reserveSlotForCheckout(
    context: Partial<FulfillmentContext> | undefined,
    slotId: string,
    type: string,
    itemCount: number,
    actor?: { actorType?: string; actorId?: string },
  ) {
    const scoped = this.resolveContext(context)
    const validation = await this.validateSlotCapacity(scoped, slotId, type, itemCount)
    if (!validation.valid) {
      throw new BadRequestException(`Janela indisponivel: ${validation.reason}`)
    }

    const slot = await this.prisma.fulfillmentSlot.update({
      where: { id: slotId },
      data: {
        reservedOrders: { increment: 1 },
        reservedItems: { increment: Math.max(0, Math.ceil(itemCount || 0)) },
      },
    })

    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      type: 'slot.reserved',
      payload: { slotId, itemCount, fulfillmentType: type },
      actor,
    })

    return slot
  }

  async releaseSlotReservation(
    context: Partial<FulfillmentContext> | undefined,
    slotId: string | null | undefined,
    itemCount: number,
    reason = 'Reserva liberada',
    actor?: { actorType?: string; actorId?: string },
  ) {
    if (!slotId) return null
    const scoped = this.resolveContext(context)
    const slot = await this.prisma.fulfillmentSlot.findFirst({
      where: { id: slotId, tenantId: scoped.tenantId, storeId: scoped.storeId },
    })
    if (!slot) return null

    const releasedItems = Math.max(0, Math.ceil(itemCount || 0))
    const updated = await this.prisma.fulfillmentSlot.update({
      where: { id: slot.id },
      data: {
        reservedOrders: Math.max(0, slot.reservedOrders - 1),
        reservedItems: Math.max(0, slot.reservedItems - releasedItems),
      },
    })

    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      type: 'slot.released',
      payload: { slotId: slot.id, itemCount: releasedItems, reason },
      actor,
    })

    return updated
  }

  async listDrivers(context?: Partial<FulfillmentContext>) {
    const scoped = this.resolveContext(context)
    return this.prisma.driver.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
  }

  async createDriver(context: Partial<FulfillmentContext> | undefined, dto: CreateDriverDto) {
    const scoped = this.resolveContext(context)
    return this.prisma.driver.create({
      data: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        name: dto.name,
        phone: dto.phone || null,
        status: dto.status || 'ACTIVE',
      },
    })
  }

  async listRoutes(context: Partial<FulfillmentContext> | undefined, filters: { status?: string } = {}) {
    const scoped = this.resolveContext(context)
    return this.prisma.deliveryRoute.findMany({
      where: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        ...(filters.status ? { status: filters.status.toUpperCase() } : {}),
      },
      include: {
        driver: true,
        stops: { orderBy: [{ sequence: 'asc' }] },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  async createRoute(context: Partial<FulfillmentContext> | undefined, dto: CreateDeliveryRouteDto, actor?: { actorType?: string; actorId?: string }) {
    const scoped = this.resolveContext(context)
    if (dto.driverId) await this.findDriverOrThrow(dto.driverId, scoped)
    const route = await this.prisma.deliveryRoute.create({
      data: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        driverId: dto.driverId || null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      },
      include: { driver: true, stops: true },
    })
    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      routeId: route.id,
      type: 'route.created',
      payload: { driverId: route.driverId },
      actor,
    })
    return route
  }

  async addStop(routeId: string, context: Partial<FulfillmentContext> | undefined, dto: AddDeliveryStopDto, actor?: { actorType?: string; actorId?: string }) {
    const scoped = this.resolveContext(context)
    const route = await this.findRouteOrThrow(routeId, scoped)
    if (!['PLANNED', 'READY'].includes(route.status)) {
      throw new BadRequestException('Rota nao aceita novas paradas neste status.')
    }

    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId: scoped.tenantId, storeId: scoped.storeId },
    })
    if (!order) throw new NotFoundException('Pedido da parada nao encontrado.')
    if (order.fulfillmentType === 'PICKUP') {
      throw new BadRequestException('Pedido de retirada nao pode entrar em rota de entrega.')
    }

    const count = await this.prisma.deliveryStop.count({ where: { routeId } })
    const stop = await this.prisma.deliveryStop.create({
      data: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        routeId,
        orderId: dto.orderId,
        sequence: dto.sequence || count + 1,
        eta: dto.eta ? new Date(dto.eta) : null,
      },
    })

    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      routeId,
      stopId: stop.id,
      orderId: stop.orderId,
      type: 'route.stop_added',
      payload: { sequence: stop.sequence },
      actor,
    })

    return this.findRouteOrThrow(routeId, scoped)
  }

  async startRoute(routeId: string, context: Partial<FulfillmentContext> | undefined, actor?: { actorType?: string; actorId?: string }) {
    const scoped = this.resolveContext(context)
    const route = await this.findRouteOrThrow(routeId, scoped)
    if (route.status === 'OUT_FOR_DELIVERY') return route
    if (route.status !== 'PLANNED' && route.status !== 'READY') {
      throw new BadRequestException('Rota nao pode sair para entrega neste status.')
    }
    if (route.stops.length === 0) throw new BadRequestException('Rota precisa de ao menos uma parada.')

    const startedAt = new Date()
    await this.prisma.deliveryRoute.update({
      where: { id: route.id },
      data: { status: 'OUT_FOR_DELIVERY', startsAt: route.startsAt || startedAt },
    })
    await this.prisma.deliveryStop.updateMany({
      where: { routeId: route.id, status: 'PENDING' },
      data: { status: 'OUT_FOR_DELIVERY' },
    })

    for (const stop of route.stops) {
      await this.updateOrderFulfillmentStatus(scoped, stop.orderId, 'OUT_FOR_DELIVERY', 'order.out_for_delivery', { routeId, stopId: stop.id }, actor)
    }

    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      routeId,
      type: 'route.out_for_delivery',
      payload: { stopCount: route.stops.length },
      actor,
    })

    return this.findRouteOrThrow(routeId, scoped)
  }

  async updateStopStatus(
    routeId: string,
    stopId: string,
    context: Partial<FulfillmentContext> | undefined,
    dto: UpdateDeliveryStopStatusDto,
    actor?: { actorType?: string; actorId?: string },
  ) {
    const scoped = this.resolveContext(context)
    await this.findRouteOrThrow(routeId, scoped)
    const stop = await this.prisma.deliveryStop.findFirst({
      where: { id: stopId, routeId, tenantId: scoped.tenantId, storeId: scoped.storeId },
    })
    if (!stop) throw new NotFoundException('Parada da rota nao encontrada.')

    const status = dto.status.toUpperCase()
    const updated = await this.prisma.deliveryStop.update({
      where: { id: stop.id },
      data: {
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : stop.deliveredAt,
      },
    })

    if (status === 'DELIVERED') {
      await this.updateOrderFulfillmentStatus(scoped, stop.orderId, 'DELIVERED', 'order.delivered', { routeId, stopId, notes: dto.notes || null }, actor)
    } else if (status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED') {
      await this.updateOrderFulfillmentStatus(scoped, stop.orderId, 'OUT_FOR_DELIVERY', 'order.out_for_delivery', { routeId, stopId, stopStatus: status }, actor)
    } else if (status === 'FAILED') {
      await this.recordOrderEvent(scoped, stop.orderId, 'order.delivery_failed', { routeId, stopId, notes: dto.notes || null }, actor)
    }

    await this.recordFulfillmentEvent({
      tenantId: scoped.tenantId,
      storeId: scoped.storeId,
      routeId,
      stopId,
      orderId: stop.orderId,
      type: `stop.${status.toLowerCase()}`,
      payload: { previousStatus: stop.status, status, notes: dto.notes || null },
      actor,
    })

    await this.completeRouteIfDone(routeId, scoped, actor)
    return updated
  }

  async completeRoute(routeId: string, context: Partial<FulfillmentContext> | undefined, actor?: { actorType?: string; actorId?: string }) {
    const scoped = this.resolveContext(context)
    const route = await this.findRouteOrThrow(routeId, scoped)
    const incomplete = route.stops.filter((stop) => !['DELIVERED', 'FAILED'].includes(stop.status))
    if (incomplete.length > 0) {
      throw new BadRequestException('Rota ainda possui paradas pendentes.')
    }
    return this.markRouteCompleted(routeId, scoped, actor)
  }

  private async findMatchingArea({ tenantId, storeId, cep, lat, lng }: DeliveryLookup) {
    const scoped = this.resolveContext({ tenantId, storeId })
    const areas = await this.prisma.deliveryArea.findMany({
      where: {
        status: 'ACTIVE',
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    return areas.find((area) => this.areaMatches(area, { cep, lat, lng })) || null
  }

  private async calculateLegacyZone({ tenantId, storeId, cep, lat, lng, subtotal }: DeliveryLookup): Promise<DeliveryCalculation> {
    const scoped = this.resolveContext({ tenantId, storeId })
    const zones = await this.prisma.deliveryZone.findMany({
      where: {
        active: true,
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })

    if (!zones.length) {
      return this.outOfAreaCalculation()
    }

    if (typeof lat === 'number' && typeof lng === 'number') {
      const polygonMatched = zones.find((zone) => {
        if (zone.type !== 'GEO_POLYGON' || !zone.polygonGeoJSON) return false
        const polygonFeature = this.parsePolygonFeature(zone.polygonGeoJSON)
        if (!polygonFeature) return false
        return booleanPointInPolygon(point([lng, lat]), polygonFeature)
      })

      if (polygonMatched) {
        return this.zoneToCalculation(polygonMatched, subtotal)
      }

      if (!cep) return this.outOfAreaCalculation()
    }

    if (cep) {
      const cleanCep = this.cleanCep(cep)
      const matched = zones.find((zone) => {
        if (zone.type !== 'CEP_RANGE' || !zone.cepStart || !zone.cepEnd) return false
        const start = this.cleanCep(zone.cepStart)
        const end = this.cleanCep(zone.cepEnd)
        return cleanCep >= start && cleanCep <= end
      })

      return matched ? this.zoneToCalculation(matched, subtotal) : this.outOfAreaCalculation()
    }

    return this.outOfAreaCalculation()
  }

  private areaMatches(area: { type: string; rule: Prisma.JsonValue }, lookup: { cep?: string; lat?: number; lng?: number }) {
    const rule = this.asObject(area.rule)
    const type = this.normalizeAreaType(area.type)

    if (type === 'CEP_RANGE' && lookup.cep) {
      const start = this.cleanCep(this.ruleString(rule, ['cepStart', 'start', 'from']))
      const end = this.cleanCep(this.ruleString(rule, ['cepEnd', 'end', 'to']))
      const cleanCep = this.cleanCep(lookup.cep)
      return Boolean(start && end && cleanCep >= start && cleanCep <= end)
    }

    if ((type === 'POLYGON' || type === 'GEO_POLYGON') && typeof lookup.lat === 'number' && typeof lookup.lng === 'number') {
      const raw = rule.polygonGeoJSON ?? rule.geoJSON ?? rule.geojson ?? rule.polygon
      const polygonFeature = this.parsePolygonFeature(raw)
      if (!polygonFeature) return false
      return booleanPointInPolygon(point([lookup.lng, lookup.lat]), polygonFeature)
    }

    return false
  }

  private areaToCalculation(
    area: { id: string; name: string; fee: Prisma.Decimal; freeAbove: Prisma.Decimal | null; minimumOrder: Prisma.Decimal | null },
    subtotal?: number,
  ): DeliveryCalculation {
    const rawFee = Number(area.fee)
    const freeAbove = area.freeAbove == null ? null : Number(area.freeAbove)
    const minimumOrder = area.minimumOrder == null ? null : Number(area.minimumOrder)
    const isFree = freeAbove != null && subtotal != null && subtotal >= freeAbove
    const minimumOrderMet = minimumOrder == null || subtotal == null || subtotal >= minimumOrder

    return {
      fee: isFree ? 0 : rawFee,
      rawFee,
      freeAbove,
      minimumOrder,
      minimumOrderMet,
      zoneName: area.name,
      zoneId: area.id,
      isFree,
      outOfArea: false,
    }
  }

  private zoneToCalculation(
    zone: { id: string; name: string; fee: Prisma.Decimal; freeAbove: Prisma.Decimal | null },
    subtotal?: number,
  ): DeliveryCalculation {
    const rawFee = Number(zone.fee)
    const freeAbove = zone.freeAbove == null ? null : Number(zone.freeAbove)
    const isFree = freeAbove != null && subtotal != null && subtotal >= freeAbove
    return {
      fee: isFree ? 0 : rawFee,
      rawFee,
      freeAbove,
      minimumOrder: null,
      minimumOrderMet: true,
      zoneName: zone.name,
      zoneId: zone.id,
      isFree,
      outOfArea: false,
    }
  }

  private outOfAreaCalculation(): DeliveryCalculation {
    return {
      fee: null,
      rawFee: null,
      freeAbove: null,
      minimumOrder: null,
      minimumOrderMet: false,
      zoneName: null,
      zoneId: null,
      isFree: false,
      outOfArea: true,
    }
  }

  private slotOccupancy(
    slot: {
      id: string
      type: string
      startsAt: Date
      endsAt: Date
      capacityOrders: number
      capacityItems: number | null
      reservedOrders: number
      reservedItems: number
      cutoffMinutes: number
      status: string
    },
    options: SlotValidationOptions = {},
  ) {
    const reservedOrders = Math.max(0, slot.reservedOrders - (options.reservedOrdersOffset || 0))
    const reservedItems = Math.max(0, slot.reservedItems - (options.reservedItemsOffset || 0))
    const availableOrders = Math.max(0, slot.capacityOrders - reservedOrders)
    const availableItems = slot.capacityItems == null ? null : Math.max(0, slot.capacityItems - reservedItems)
    const cutoffAt = new Date(slot.startsAt.getTime() - Math.max(0, slot.cutoffMinutes || 0) * 60 * 1000)

    return {
      ...slot,
      reservedOrders,
      reservedItems,
      availableOrders,
      availableItems,
      isFull: availableOrders <= 0 || (availableItems != null && availableItems <= 0),
      cutoffAt: cutoffAt.toISOString(),
      cutoffExpired: Date.now() > cutoffAt.getTime(),
      occupancyPercent: slot.capacityOrders > 0 ? Math.round((reservedOrders / slot.capacityOrders) * 100) : 0,
    }
  }

  private async findZoneOrThrow(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } })
    if (!zone) throw new NotFoundException('Zona de entrega nao encontrada')
    return zone
  }

  private async findAreaOrThrow(id: string, context?: Partial<FulfillmentContext>) {
    const area = await this.prisma.deliveryArea.findFirst({
      where: { id, ...tenantStoreWhere(context) },
    })
    if (!area) throw new NotFoundException('Area de entrega nao encontrada')
    return area
  }

  private async findSlotOrThrow(id: string, context?: Partial<FulfillmentContext>) {
    const scoped = this.resolveContext(context)
    const slot = await this.prisma.fulfillmentSlot.findFirst({
      where: { id, tenantId: scoped.tenantId, storeId: scoped.storeId },
    })
    if (!slot) throw new NotFoundException('Janela de entrega/retirada nao encontrada.')
    return slot
  }

  private async findDriverOrThrow(id: string, context: FulfillmentContext) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, tenantId: context.tenantId, storeId: context.storeId },
    })
    if (!driver) throw new NotFoundException('Motorista nao encontrado.')
    return driver
  }

  private async findRouteOrThrow(routeId: string, context: FulfillmentContext) {
    const route = await this.prisma.deliveryRoute.findFirst({
      where: { id: routeId, tenantId: context.tenantId, storeId: context.storeId },
      include: {
        driver: true,
        stops: { orderBy: [{ sequence: 'asc' }] },
      },
    })
    if (!route) throw new NotFoundException('Rota de entrega nao encontrada.')
    return route
  }

  private async completeRouteIfDone(routeId: string, context: FulfillmentContext, actor?: { actorType?: string; actorId?: string }) {
    const route = await this.findRouteOrThrow(routeId, context)
    if (route.status === 'COMPLETED') return route
    if (route.stops.length > 0 && route.stops.every((stop) => ['DELIVERED', 'FAILED'].includes(stop.status))) {
      return this.markRouteCompleted(routeId, context, actor)
    }
    return route
  }

  private async markRouteCompleted(routeId: string, context: FulfillmentContext, actor?: { actorType?: string; actorId?: string }) {
    const route = await this.prisma.deliveryRoute.update({
      where: { id: routeId },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { driver: true, stops: { orderBy: [{ sequence: 'asc' }] } },
    })
    await this.recordFulfillmentEvent({
      tenantId: context.tenantId,
      storeId: context.storeId,
      routeId,
      type: 'route.completed',
      payload: { stopCount: route.stops.length },
      actor,
    })
    return route
  }

  private async updateOrderFulfillmentStatus(
    context: FulfillmentContext,
    orderId: string,
    status: string,
    eventType: string,
    payload: Record<string, unknown>,
    actor?: { actorType?: string; actorId?: string },
  ) {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      select: { id: true, tenantId: true, storeId: true, status: true, paymentStatus: true },
    })
    await this.recordOrderEvent(context, order.id, eventType, { ...payload, status }, actor)
    return order
  }

  private async recordOrderEvent(
    context: FulfillmentContext,
    orderId: string,
    type: string,
    payload: Record<string, unknown>,
    actor?: { actorType?: string; actorId?: string },
  ) {
    return this.prisma.orderEvent.create({
      data: {
        tenantId: context.tenantId,
        storeId: context.storeId,
        orderId,
        type,
        payload: this.toJsonPayload(payload),
        actorType: actor?.actorType || 'SYSTEM',
        actorId: actor?.actorId || null,
      },
    })
  }

  private async recordFulfillmentEvent(data: {
    tenantId: string
    storeId: string
    orderId?: string | null
    routeId?: string | null
    stopId?: string | null
    type: string
    payload: Record<string, unknown>
    actor?: { actorType?: string; actorId?: string }
  }) {
    return this.prisma.fulfillmentEvent.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        orderId: data.orderId || null,
        routeId: data.routeId || null,
        stopId: data.stopId || null,
        type: data.type,
        payload: this.toJsonPayload(data.payload),
        actorType: data.actor?.actorType || 'SYSTEM',
        actorId: data.actor?.actorId || null,
      },
    })
  }

  private assertValidWindow(startsAt: Date, endsAt: Date) {
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw new BadRequestException('Datas da janela sao invalidas.')
    }
    if (endsAt <= startsAt) {
      throw new BadRequestException('Fim da janela deve ser posterior ao inicio.')
    }
  }

  private normalizeAreaType(type?: string) {
    const normalized = String(type || 'CEP_RANGE').trim().toUpperCase()
    return normalized === 'GEO_POLYGON' ? 'POLYGON' : normalized
  }

  private parsePolygonFeature(raw: unknown) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      const geometry = (parsed as { type?: string; geometry?: unknown })?.type === 'Feature'
        ? (parsed as { geometry?: unknown })?.geometry
        : parsed
      const typedGeometry = geometry as { type?: string; coordinates?: unknown }
      if (!typedGeometry?.type || !typedGeometry?.coordinates) return null

      if (typedGeometry.type === 'Polygon' && Array.isArray(typedGeometry.coordinates)) {
        return polygon(typedGeometry.coordinates as number[][][])
      }

      return null
    } catch {
      return null
    }
  }

  private asObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
  }

  private ruleString(rule: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = rule[key]
      if (typeof value === 'string' && value.trim()) return value
      if (typeof value === 'number') return String(value)
    }
    return ''
  }

  private cleanCep(value?: string | null) {
    return String(value || '').replace(/\D/g, '')
  }

  private decimal2(value: number) {
    return new Prisma.Decimal(Number(value || 0).toFixed(2))
  }

  private toJsonPayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(payload || {})) as Prisma.InputJsonObject
  }

  private resolveContext(context?: Partial<FulfillmentContext>): FulfillmentContext {
    return {
      tenantId: context?.tenantId || DEFAULT_TENANT_ID,
      storeId: context?.storeId || DEFAULT_STORE_ID,
    }
  }
}
