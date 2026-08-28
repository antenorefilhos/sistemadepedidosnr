import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import { resolveDateRange } from '../../common/date-range.util'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'
import {
  AddDeliveryStopDto,
  CreateDeliveryRouteDto,
  CreateDriverDto,
  CreateFulfillmentSlotDto,
  UpdateDeliveryStopStatusDto,
  UpdateFulfillmentSlotDto,
} from './dto/fulfillment.dto'

export interface DeliveryLocalityOption {
  code: string
  name: string
  fee: number
  minutes: number | null
  km: number | null
  reference: string | null
}

export interface DeliveryCalculation {
  fee: number | null
  rawFee?: number | null
  /** null = zona conhecida SEM regra por valor (decisao deliberada, ver
   * DeliveryZone.freeAbove). undefined = fonte de dado nao tem esse conceito
   * (ex.: planilha de balcao) -- useFreeShipping cai pro global nesse caso. */
  freeAbove: number | null | undefined
  minimumOrder?: number | null
  minimumOrderMet?: boolean
  zoneName: string | null
  zoneId: string | null
  isFree: boolean
  outOfArea: boolean
  /** Mais de um ponto de entrega da planilha de balcao compartilha o CEP
   * informado -- o fee acima ainda nao e definitivo, o cliente precisa
   * escolher em `availableLocalities` (ver selectedLocality/-Code). */
  requiresLocalitySelection?: boolean
  availableLocalities?: DeliveryLocalityOption[]
  selectedLocality?: string | null
  selectedLocalityCode?: string | null
}

type DeliveryLookup = {
  tenantId?: string
  storeId?: string
  cep?: string
  lat?: number
  lng?: number
  subtotal?: number
  /** Nome da localidade escolhida pelo cliente quando o CEP tem mais de um
   * ponto na planilha de balcao (ver DeliveryLocalityOption.name). */
  locality?: string
  /** Codigo do ponto (DeliveryLocalityOption.code) -- alternativa mais
   * precisa a `locality` pra identificar a escolha do cliente. */
  deliveryPointCode?: string
}

interface BalcaoRateEntry {
  sentido: string
  codigo: string
  localidade: string
  taxa: number
  minutos: number | null
  km: number | null
  cep: string | null
  cepFormatado: string | null
  referencia: string | null
}

type FulfillmentContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type SlotValidationOptions = {
  reservedOrdersOffset?: number
  reservedItemsOffset?: number
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name)
  private balcaoRatesCache: BalcaoRateEntry[] | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Le e cacheia a planilha de taxas de balcao (mesma fonte do
   * scripts/seed-delivery-zones.ts) -- process.cwd() em vez de __dirname
   * porque o build compilado (dist/) nao preserva a estrutura de src/. */
  private getBalcaoRates(): BalcaoRateEntry[] {
    if (this.balcaoRatesCache) return this.balcaoRatesCache
    try {
      const dataPath = path.join(process.cwd(), 'src/modules/delivery/data/delivery-rates-balcao.json')
      const raw = fs.readFileSync(dataPath, 'utf-8')
      this.balcaoRatesCache = JSON.parse(raw) as BalcaoRateEntry[]
    } catch (err) {
      this.logger.warn(`Nao foi possivel carregar delivery-rates-balcao.json: ${err instanceof Error ? err.message : err}`)
      this.balcaoRatesCache = []
    }
    return this.balcaoRatesCache
  }

  async listZones() {
    return this.prisma.deliveryZone.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async createZone(dto: CreateDeliveryZoneDto) {
    this.validateZonePayload(dto)
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
    this.validateZonePayload(dto)
    return this.prisma.deliveryZone.update({
      where: { id },
      data: { ...dto },
    })
  }

  async testZone(params: { cep?: string; lat?: number; lng?: number; subtotal?: number }) {
    const { cep, lat, lng, subtotal } = params
    const zones = await this.prisma.deliveryZone.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    const matches: Array<{ zone: typeof zones[number]; matchedBy: 'CEP' | 'POLYGON' }> = []
    if (typeof lat === 'number' && typeof lng === 'number') {
      for (const zone of zones) {
        if (!zone.active) continue
        if (zone.type !== 'GEO_POLYGON' || !zone.polygonGeoJSON) continue
        const feature = this.parsePolygonFeature(zone.polygonGeoJSON)
        if (feature && booleanPointInPolygon(point([lng, lat]), feature)) {
          matches.push({ zone, matchedBy: 'POLYGON' })
        }
      }
    }
    if (cep) {
      const cepNum = this.cepToNumber(cep)
      if (cepNum !== null) {
        for (const zone of zones) {
          if (!zone.active) continue
          if (zone.type !== 'CEP_RANGE' || !zone.cepStart || !zone.cepEnd) continue
          const start = this.cepToNumber(zone.cepStart)
          const end = this.cepToNumber(zone.cepEnd)
          if (start !== null && end !== null && cepNum >= start && cepNum <= end) {
            matches.push({ zone, matchedBy: 'CEP' })
          }
        }
      }
    }
    const calculation = await this.calculate({ cep, lat, lng, subtotal })
    return { calculation, matches: matches.map((m) => ({ id: m.zone.id, name: m.zone.name, fee: Number(m.zone.fee), priority: m.zone.priority, matchedBy: m.matchedBy })) }
  }

  async checkZoneOverlap(payload: { id?: string; type: string; cepStart?: string | null; cepEnd?: string | null; polygonGeoJSON?: string | null }) {
    const zones = await this.prisma.deliveryZone.findMany({ where: { active: true } })
    const overlaps: Array<{ id: string; name: string; reason: string }> = []
    if (payload.type === 'CEP_RANGE') {
      const s = this.cepToNumber(payload.cepStart)
      const e = this.cepToNumber(payload.cepEnd)
      if (s !== null && e !== null) {
        for (const zone of zones) {
          if (payload.id && zone.id === payload.id) continue
          if (zone.type !== 'CEP_RANGE') continue
          const zs = this.cepToNumber(zone.cepStart)
          const ze = this.cepToNumber(zone.cepEnd)
          if (zs === null || ze === null) continue
          if (s <= ze && zs <= e) {
            overlaps.push({ id: zone.id, name: zone.name, reason: `CEP ${zone.cepStart}-${zone.cepEnd} intersecta com faixa nova` })
          }
        }
      }
    } else if (payload.type === 'GEO_POLYGON' && payload.polygonGeoJSON) {
      const newFeature = this.parsePolygonFeature(payload.polygonGeoJSON)
      if (newFeature) {
        for (const zone of zones) {
          if (payload.id && zone.id === payload.id) continue
          if (zone.type !== 'GEO_POLYGON' || !zone.polygonGeoJSON) continue
          const existingFeature = this.parsePolygonFeature(zone.polygonGeoJSON)
          if (!existingFeature) continue
          const newRing: [number, number][] = newFeature.geometry.coordinates[0].map((c: number[]) => [c[0], c[1]])
          const anyInside = newRing.some((c) => booleanPointInPolygon(point(c), existingFeature))
          if (anyInside) {
            overlaps.push({ id: zone.id, name: zone.name, reason: 'Poligono se sobrepoe com area existente' })
          }
        }
      }
    }
    return { overlaps }
  }

  async bulkImportZones(zones: Array<CreateDeliveryZoneDto>) {
    if (!Array.isArray(zones) || zones.length === 0) {
      throw new BadRequestException('Lista de zonas vazia.')
    }
    if (zones.length > 500) {
      throw new BadRequestException('Limite de 500 zonas por importacao.')
    }
    const created: unknown[] = []
    const errors: Array<{ index: number; error: string; name?: string }> = []
    for (let i = 0; i < zones.length; i++) {
      try {
        this.validateZonePayload(zones[i])
        const zone = await this.prisma.deliveryZone.create({
          data: {
            name: zones[i].name,
            type: zones[i].type ?? 'CEP_RANGE',
            cepStart: zones[i].cepStart ?? null,
            cepEnd: zones[i].cepEnd ?? null,
            polygonGeoJSON: zones[i].polygonGeoJSON ?? null,
            fee: zones[i].fee,
            freeAbove: zones[i].freeAbove ?? null,
            active: zones[i].active ?? true,
            priority: zones[i].priority ?? 0,
          },
        })
        created.push(zone)
      } catch (e) {
        errors.push({ index: i, name: zones[i]?.name, error: e instanceof Error ? e.message : 'Erro desconhecido' })
      }
    }
    return { created: created.length, errors }
  }

  private validateZonePayload(dto: { type?: string; cepStart?: string | null; cepEnd?: string | null; polygonGeoJSON?: string | null; fee?: number; freeAbove?: number | null }) {
    if (dto.fee !== undefined && (typeof dto.fee !== 'number' || dto.fee < 0 || !Number.isFinite(dto.fee))) {
      throw new BadRequestException('Taxa deve ser numero maior ou igual a zero.')
    }
    if (dto.freeAbove != null && (typeof dto.freeAbove !== 'number' || dto.freeAbove < 0 || !Number.isFinite(dto.freeAbove))) {
      throw new BadRequestException('Frete gratis acima de deve ser numero maior ou igual a zero.')
    }
    if (dto.type === 'CEP_RANGE') {
      const start = this.cepToNumber(dto.cepStart)
      const end = this.cepToNumber(dto.cepEnd)
      if (start === null || end === null) {
        throw new BadRequestException('CEP inicial e final devem ter 8 digitos.')
      }
      if (start > end) {
        throw new BadRequestException('CEP inicial deve ser menor ou igual ao CEP final.')
      }
    }
    if (dto.type === 'GEO_POLYGON') {
      if (!dto.polygonGeoJSON) throw new BadRequestException('Poligono geografico obrigatorio.')
      if (!this.parsePolygonFeature(dto.polygonGeoJSON)) {
        throw new BadRequestException('Poligono invalido: forneca um GeoJSON valido.')
      }
    }
  }

  private cepToNumber(value?: string | null): number | null {
    const digits = this.cleanCep(value)
    if (digits.length !== 8) return null
    const num = Number(digits)
    return Number.isFinite(num) ? num : null
  }

  async deleteZone(id: string) {
    await this.findZoneOrThrow(id)
    await this.prisma.deliveryZone.delete({ where: { id } })
  }

  /** Resolve o fee pela planilha de taxas de balcao (ponto exato por CEP,
   * com selecao de localidade quando o CEP tem mais de um ponto mapeado).
   * Retorna null quando o CEP nao tem nenhum ponto na planilha -- nesse
   * caso quem chama cai pro fallback de DeliveryZone (zona base regional). */
  private resolveBalcaoLocality(
    cep: string,
    locality: string | undefined,
    deliveryPointCode: string | undefined,
    subtotal?: number,
  ): DeliveryCalculation | null {
    const cepDigits = this.cleanCep(cep)
    const rawPoints = this.getBalcaoRates().filter((entry) => this.cleanCep(entry.cep) === cepDigits && cepDigits.length === 8)
    if (!rawPoints.length) return null

    // A planilha repete a mesma localidade (ex.: CHAFARIZ) uma vez por
    // sentido (Itaipava/Posse) -- dedup por nome, ficando com a menor taxa
    // quando o mesmo nome aparecer com valores diferentes.
    const byLocality = new Map<string, BalcaoRateEntry>()
    for (const entry of rawPoints) {
      const key = entry.localidade.trim().toUpperCase()
      const existing = byLocality.get(key)
      if (!existing || Number(entry.taxa) < Number(existing.taxa)) byLocality.set(key, entry)
    }
    const points = [...byLocality.values()]

    const toOption = (p: BalcaoRateEntry): DeliveryLocalityOption => ({
      code: p.codigo,
      name: p.localidade,
      fee: Number(p.taxa),
      minutes: p.minutos,
      km: p.km,
      reference: p.referencia,
    })

    if (points.length === 1) {
      return this.toBalcaoCalculation(points[0], { availableLocalities: [] })
    }

    const availableLocalities = points.map(toOption)
    const selected = points.find(
      (p) =>
        (deliveryPointCode && p.codigo === deliveryPointCode) ||
        (locality && p.localidade.toUpperCase() === locality.toUpperCase()),
    )

    if (selected) {
      return this.toBalcaoCalculation(selected, { availableLocalities })
    }

    // Nenhuma localidade escolhida ainda -- devolve a lista pro cliente
    // selecionar no modal de endereco/checkout. fee fica com a menor taxa
    // do grupo so como estimativa visual, nunca e o valor cobrado de fato
    // (confirmSession/create bloqueiam sem locality/deliveryPointCode).
    const lowestFee = Math.min(...points.map((p) => Number(p.taxa)))
    return this.toBalcaoCalculation(null, { availableLocalities, fallbackFee: lowestFee })
  }

  /** Monta o DeliveryCalculation comum aos 3 desfechos de resolveBalcaoLocality
   * (ponto unico, localidade escolhida, ou pendente de escolha) -- so muda o
   * ponto resolvido (ou null, se ainda pendente) e a lista de opcoes. */
  private toBalcaoCalculation(
    point: BalcaoRateEntry | null,
    options: { availableLocalities: DeliveryLocalityOption[]; fallbackFee?: number },
  ): DeliveryCalculation {
    const fee = point ? Number(point.taxa) : (options.fallbackFee ?? 0)
    return {
      fee,
      rawFee: fee,
      freeAbove: undefined,
      minimumOrder: null,
      minimumOrderMet: true,
      zoneName: point?.localidade ?? 'Selecione sua localidade',
      zoneId: point ? `balcao:${point.codigo}` : null,
      isFree: false,
      outOfArea: false,
      requiresLocalitySelection: !point,
      availableLocalities: options.availableLocalities,
      selectedLocality: point?.localidade ?? null,
      selectedLocalityCode: point?.codigo ?? null,
    }
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
    if (!slot) {
      // 'ASAP' e o marcador que o storefront manda quando NENHUMA janela
      // utilizavel existe -- ele escolhe sozinho quando ha uma (nao existe
      // seletor manual), entao ASAP significa "nao havia o que escolher".
      // Ver createFallbackDeliverySlot e o useMemo de Checkout.tsx.
      //
      // A checagem era `anyConfigured === 0`, e isso era um penhasco: bastava a
      // loja cadastrar janelas uma vez e deixar vencer (corte passado, lotadas,
      // ou simplesmente esquecer de criar as de amanha) que o storefront
      // voltava a mandar ASAP, o backend recusava com SLOT_NOT_FOUND, e a loja
      // parava de vender exibindo "janela de entrega/retirada invalida" -- sem
      // ninguem ter errado nada e sem o cliente ter como agir.
      //
      // Agora o que vale e haver janela UTILIZAVEL, nao janela cadastrada.
      // Perder a venda porque o calendario de janelas caducou e pior do que
      // aceitar um pedido sem janela definida.
      if (slotId === 'ASAP') {
        const normalizedType = type.toUpperCase() === 'RETIRADA' ? 'PICKUP' : type.toUpperCase()
        const candidatas = await this.prisma.fulfillmentSlot.findMany({
          where: {
            tenantId: scoped.tenantId,
            storeId: scoped.storeId,
            type: normalizedType,
            status: 'ACTIVE',
            startsAt: { gt: new Date() },
          },
        })
        const utilizaveis = candidatas.filter((candidata) => {
          const ocupacao = this.slotOccupancy(candidata)
          return !ocupacao.cutoffExpired && ocupacao.availableOrders >= 1
        })
        if (utilizaveis.length === 0) {
          return { valid: true, reason: null, slot: null, occupancy: null }
        }
        // Ha janela boa e o cliente nao veio com nenhuma: a resposta honesta e
        // "escolha uma", nao "a janela nao existe".
        return { valid: false, reason: 'SLOT_REQUIRED', slot: null, occupancy: null }
      }
      return { valid: false, reason: 'SLOT_NOT_FOUND', slot: null, occupancy: null }
    }

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

    // Validou como valido mas nao ha registro real (caso 'ASAP' sem nenhum
    // FulfillmentSlot cadastrado, ver validateSlotCapacity) -- nao ha o que
    // reservar/decrementar, so confirmar sem tocar no banco.
    if (!validation.slot) {
      return null
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
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.fulfillmentSlot.findUnique({ where: { id: slot.id } })
      if (!current) return null
      const nextOrders = Math.max(0, current.reservedOrders - 1)
      const nextItems = Math.max(0, current.reservedItems - releasedItems)
      return tx.fulfillmentSlot.update({
        where: { id: slot.id },
        data: { reservedOrders: nextOrders, reservedItems: nextItems },
      })
    })
    if (!updated) return null

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

  async getDriverPerformance(context: Partial<FulfillmentContext> | undefined, filters: { from?: string; to?: string } = {}) {
    const scoped = this.resolveContext(context)
    const { from, to } = resolveDateRange(filters, 7)

    const routes = await this.prisma.deliveryRoute.findMany({
      where: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        createdAt: { gte: from, lte: to },
      },
      include: { driver: true, stops: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDriver = new Map<string, {
      driverId: string
      driverName: string
      routesCompleted: number
      stopsDelivered: number
      stopsFailed: number
      deliverySeconds: number
      completedRoutes: number
    }>()

    for (const route of routes) {
      const driverId = route.driverId || 'unassigned'
      if (!byDriver.has(driverId)) {
        byDriver.set(driverId, {
          driverId,
          driverName: route.driver?.name || 'Sem motorista',
          routesCompleted: 0,
          stopsDelivered: 0,
          stopsFailed: 0,
          deliverySeconds: 0,
          completedRoutes: 0,
        })
      }
      const bucket = byDriver.get(driverId)!
      bucket.stopsDelivered += route.stops.filter((s) => s.status === 'DELIVERED').length
      bucket.stopsFailed += route.stops.filter((s) => s.status === 'FAILED').length
      if (route.status === 'COMPLETED' && route.startsAt && route.completedAt) {
        bucket.completedRoutes += 1
        bucket.routesCompleted += 1
        bucket.deliverySeconds += Math.max(0, Math.round((route.completedAt.getTime() - route.startsAt.getTime()) / 1000))
      }
    }

    const drivers = Array.from(byDriver.values()).map((bucket) => ({
      ...bucket,
      avgDeliveryMinutes: bucket.completedRoutes > 0
        ? Number((bucket.deliverySeconds / bucket.completedRoutes / 60).toFixed(1))
        : 0,
    }))

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        routes: routes.length,
        completed: routes.filter((r) => r.status === 'COMPLETED').length,
      },
      drivers,
    }
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
    // Mesma tabela de transicao permitida do frontend (RouteDetail.tsx,
    // NEXT_STATUSES) -- so existia la, backend aceitava qualquer valor do
    // enum em qualquer ordem (retry de fila reenviando acao antiga, ou
    // chamada direta na API, podia voltar DELIVERED pra PENDING).
    const allowedNext: Record<string, string[]> = {
      PENDING: ['OUT_FOR_DELIVERY'],
      OUT_FOR_DELIVERY: ['ARRIVED'],
      ARRIVED: ['DELIVERED', 'FAILED'],
    }
    if (stop.status !== status && !(allowedNext[stop.status] || []).includes(status)) {
      throw new BadRequestException(`Transicao de status invalida: ${stop.status} -> ${status}`)
    }
    // Sem foto/assinatura no app hoje (feature maior, fora deste lote) --
    // pelo menos exige que o motorista escreva algo como evidencia da
    // entrega, em vez de aceitar "Entregue" sem nenhum registro.
    if (status === 'DELIVERED' && !dto.notes?.trim()) {
      throw new BadRequestException('Descreva a entrega (quem recebeu, onde deixou) antes de confirmar.')
    }

    const updated = await this.prisma.deliveryStop.update({
      where: { id: stop.id },
      data: {
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : stop.deliveredAt,
      },
    })

    if (status === 'DELIVERED') {
      await this.updateOrderFulfillmentStatus(scoped, stop.orderId, 'DELIVERED', 'order.delivered', { routeId, stopId, notes: dto.notes || null }, actor)
      this.notificationsService.notifyOrderStatusChange(stop.orderId, 'DELIVERED').catch(() => {})
    } else if (status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED') {
      await this.updateOrderFulfillmentStatus(scoped, stop.orderId, 'OUT_FOR_DELIVERY', 'order.out_for_delivery', { routeId, stopId, stopStatus: status }, actor)
      if (status === 'OUT_FOR_DELIVERY') {
        this.notificationsService.notifyOrderStatusChange(stop.orderId, 'OUT_FOR_DELIVERY').catch(() => {})
      }
    } else if (status === 'FAILED') {
      await this.recordOrderEvent(scoped, stop.orderId, 'order.delivery_failed', { routeId, stopId, notes: dto.notes || null }, actor)
      this.notificationsService.notifyOrderStatusChange(stop.orderId, 'FAILED_DELIVERY').catch(() => {})
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

  /**
   * Resolve a taxa de entrega pelo endereco. Unico caminho de calculo desde
   * 28/08/2026 -- antes rodava atras de `findMatchingArea`, que consultava o
   * model `DeliveryArea`. Esse segundo sistema foi removido: nunca ganhou tela
   * no admin, ficou com zero linhas em producao a vida toda e a checagem morta
   * na frente ja tinha causado um bug (query no model errado, sempre vazia,
   * sem erro nenhum). Ver CLAUDE.md.
   */
  async calculate({
    tenantId,
    storeId,
    cep,
    lat,
    lng,
    subtotal,
    locality,
    deliveryPointCode,
  }: DeliveryLookup): Promise<DeliveryCalculation> {
    const scoped = this.resolveContext({ tenantId, storeId })
    const zones = await this.prisma.deliveryZone.findMany({
      where: {
        active: true,
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })

    // GPS/mapa dentro de um poligono ativo tem prioridade maxima, sempre --
    // e a localizacao real do aparelho, mais precisa que qualquer CEP.
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

    if (!cep) return this.outOfAreaCalculation()

    const cepNum = this.cepToNumber(cep)
    if (cepNum === null) return this.outOfAreaCalculation()

    // CEP digitado a mao: a planilha de balcao tem o ponto exato (e as
    // varias localidades que dividem o mesmo CEP em bairros como Pedro do
    // Rio) -- so cai pra zona generica do banco se o CEP nao estiver nela.
    const balcaoResult = this.resolveBalcaoLocality(cep, locality, deliveryPointCode, subtotal)
    if (balcaoResult) return balcaoResult

    const matched = zones.find((zone) => {
      if (zone.type !== 'CEP_RANGE' || !zone.cepStart || !zone.cepEnd) return false
      const start = this.cepToNumber(zone.cepStart)
      const end = this.cepToNumber(zone.cepEnd)
      return start !== null && end !== null && cepNum >= start && cepNum <= end
    })

    return matched ? this.zoneToCalculation(matched, subtotal) : this.outOfAreaCalculation()
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
