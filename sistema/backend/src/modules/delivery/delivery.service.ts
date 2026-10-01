import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { resolveDateRange } from '../../common/date-range.util'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'
import {
  AddDeliveryStopDto,
  CreateDeliveryRouteDto,
  CreateDriverDto,
  UpdateDeliveryStopStatusDto,
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
  /** Valor a partir do qual o frete sai gratis: o da area/localidade e, sem
   * ele, o global de Marca (01/10/2026). null/undefined = sem regra por valor. */
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

/** Linha da tabela de frete por localidade (DeliveryPoint). */
type PointRow = {
  code: string
  locality: string
  fee: Prisma.Decimal | number
  freeAbove: Prisma.Decimal | number | null
  minutes: number | null
  km: Prisma.Decimal | number | null
  reference: string | null
}

type FulfillmentContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type PointInput = {
  locality?: string
  cep?: string | null
  fee?: number
  freeAbove?: number | null
  minutes?: number | null
  reference?: string | null
  active?: boolean
}

@Injectable()
export class DeliveryService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Zonas com o que cada uma vendeu em 90 dias (pedido grava o id da zona em deliveryAreaId). */
  async listZones() {
    const zones = await this.prisma.deliveryZone.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    })
    const sales = zones.length
      ? await this.prisma.order.groupBy({
          by: ['deliveryAreaId'],
          where: {
            deliveryAreaId: { in: zones.map((z) => z.id) },
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
          _count: { _all: true },
          _sum: { total: true },
        })
      : []
    const byZone = new Map(sales.map((s) => [s.deliveryAreaId, s]))
    return zones.map((zone) => ({
      ...zone,
      orders90d: byZone.get(zone.id)?._count._all ?? 0,
      revenue90d: Number(byZone.get(zone.id)?._sum.total ?? 0),
    }))
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

  /** Resolve o fee pela tabela de frete por localidade (ponto exato por CEP,
   * com selecao de localidade quando o CEP tem mais de um ponto).
   * Retorna null quando o CEP nao tem nenhum ponto -- nesse caso quem chama
   * cai pro fallback de DeliveryZone (zona base regional). */
  private async resolveBalcaoLocality(
    cep: string,
    locality: string | undefined,
    deliveryPointCode: string | undefined,
    subtotal: number | undefined,
    scoped: FulfillmentContext,
  ): Promise<DeliveryCalculation | null> {
    const cepDigits = this.cleanCep(cep)
    if (cepDigits.length !== 8) return null
    const rawPoints: PointRow[] = await this.prisma.deliveryPoint.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, cep: cepDigits, active: true },
      orderBy: { fee: 'asc' },
    })
    if (!rawPoints.length) return null

    // Mesma localidade repetida (ex.: um ponto por sentido): fica a menor taxa.
    const byLocality = new Map<string, PointRow>()
    for (const entry of rawPoints) {
      const key = entry.locality.trim().toUpperCase()
      const existing = byLocality.get(key)
      if (!existing || Number(entry.fee) < Number(existing.fee)) byLocality.set(key, entry)
    }
    const points = [...byLocality.values()]

    const toOption = (p: PointRow): DeliveryLocalityOption => ({
      code: p.code,
      name: p.locality,
      fee: Number(p.fee),
      minutes: p.minutes,
      km: p.km == null ? null : Number(p.km),
      reference: p.reference,
    })

    if (points.length === 1) {
      return this.toBalcaoCalculation(points[0], { availableLocalities: [], subtotal })
    }

    const availableLocalities = points.map(toOption)
    const selected = points.find(
      (p) =>
        (deliveryPointCode && p.code === deliveryPointCode) ||
        (locality && p.locality.toUpperCase() === locality.toUpperCase()),
    )

    if (selected) {
      return this.toBalcaoCalculation(selected, { availableLocalities, subtotal })
    }

    // Nenhuma localidade escolhida ainda -- devolve a lista pro cliente
    // selecionar no modal de endereco/checkout. fee fica com a menor taxa
    // do grupo so como estimativa visual, nunca e o valor cobrado de fato
    // (confirmSession/create bloqueiam sem locality/deliveryPointCode).
    const lowestFee = Math.min(...points.map((p) => Number(p.fee)))
    return this.toBalcaoCalculation(null, { availableLocalities, fallbackFee: lowestFee, subtotal })
  }

  /** Monta o DeliveryCalculation comum aos 3 desfechos de resolveBalcaoLocality
   * (ponto unico, localidade escolhida, ou pendente de escolha). */
  private toBalcaoCalculation(
    point: PointRow | null,
    options: { availableLocalities: DeliveryLocalityOption[]; fallbackFee?: number; subtotal?: number },
  ): DeliveryCalculation {
    const rawFee = point ? Number(point.fee) : (options.fallbackFee ?? 0)
    // Sem regra propria: undefined (o global de Marca decide), como antes.
    const freeAbove = point?.freeAbove == null ? undefined : Number(point.freeAbove)
    const isFree = freeAbove != null && options.subtotal != null && options.subtotal >= freeAbove
    return {
      fee: isFree ? 0 : rawFee,
      rawFee,
      freeAbove,
      minimumOrder: null,
      minimumOrderMet: true,
      zoneName: point?.locality ?? 'Selecione sua localidade',
      zoneId: point ? `balcao:${point.code}` : null,
      isFree,
      outOfArea: false,
      requiresLocalitySelection: !point,
      availableLocalities: options.availableLocalities,
      selectedLocality: point?.locality ?? null,
      selectedLocalityCode: point?.code ?? null,
    }
  }

  // ── Tabela de frete por localidade (admin) ──────────────────────────
  async listPoints(context?: Partial<FulfillmentContext>) {
    const scoped = this.resolveContext(context)
    const rows = await this.prisma.deliveryPoint.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId },
      orderBy: [{ cep: 'asc' }, { fee: 'asc' }, { locality: 'asc' }],
    })
    return rows.map((r) => ({
      ...r,
      fee: Number(r.fee),
      freeAbove: r.freeAbove == null ? null : Number(r.freeAbove),
      suggestedFee: r.suggestedFee == null ? null : Number(r.suggestedFee),
      km: r.km == null ? null : Number(r.km),
    }))
  }

  async createPoint(context: Partial<FulfillmentContext> | undefined, body: PointInput) {
    const scoped = this.resolveContext(context)
    const data = this.validatePoint(body, true)
    const codes = await this.prisma.deliveryPoint.findMany({ where: { tenantId: scoped.tenantId }, select: { code: true } })
    const next = Math.max(5000, ...codes.map((c) => Number.parseInt(c.code, 10)).filter(Number.isFinite)) + 1
    return this.prisma.deliveryPoint.create({ data: { ...data, code: String(next), tenantId: scoped.tenantId, storeId: scoped.storeId } as Prisma.DeliveryPointUncheckedCreateInput })
  }

  async updatePoint(id: string, body: PointInput & { applySuggestion?: boolean; dismissSuggestion?: boolean }) {
    const point = await this.prisma.deliveryPoint.findUnique({ where: { id } })
    if (!point) throw new NotFoundException('Localidade nao encontrada.')
    if (body.applySuggestion) {
      if (point.suggestedFee == null) throw new BadRequestException('Essa localidade nao tem valor sugerido.')
      return this.prisma.deliveryPoint.update({ where: { id }, data: { fee: point.suggestedFee, suggestedFee: null } })
    }
    if (body.dismissSuggestion) return this.prisma.deliveryPoint.update({ where: { id }, data: { suggestedFee: null } })
    return this.prisma.deliveryPoint.update({ where: { id }, data: this.validatePoint(body, false) })
  }

  /** Aplica de uma vez todas as taxas digitadas em 24/09 que ainda estao pendentes. */
  async applyAllSuggestions(context?: Partial<FulfillmentContext>) {
    const scoped = this.resolveContext(context)
    const pending = await this.prisma.deliveryPoint.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, suggestedFee: { not: null } },
    })
    await this.prisma.$transaction(
      pending.map((p) => this.prisma.deliveryPoint.update({ where: { id: p.id }, data: { fee: p.suggestedFee as Prisma.Decimal, suggestedFee: null } })),
    )
    return { applied: pending.length }
  }

  async deletePoint(id: string) {
    await this.prisma.deliveryPoint.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Localidade nao encontrada.')
    })
  }

  private validatePoint(body: PointInput, isCreate: boolean) {
    const data: Record<string, unknown> = {}
    if (isCreate || body.locality !== undefined) {
      const locality = String(body.locality || '').trim()
      if (!locality) throw new BadRequestException('Informe o nome da localidade.')
      data.locality = locality
    }
    if (isCreate || body.cep !== undefined) {
      const cep = body.cep ? this.cleanCep(body.cep) : ''
      if (cep && cep.length !== 8) throw new BadRequestException('CEP precisa ter 8 digitos.')
      data.cep = cep || null
    }
    if (isCreate || body.fee !== undefined) {
      const fee = Number(body.fee)
      if (!Number.isFinite(fee) || fee < 0 || fee > 500) throw new BadRequestException('Taxa invalida.')
      data.fee = fee
    }
    if (body.freeAbove !== undefined) {
      const v = body.freeAbove == null || body.freeAbove === ('' as unknown) ? null : Number(body.freeAbove)
      if (v != null && (!Number.isFinite(v) || v <= 0)) throw new BadRequestException('Valor de frete gratis invalido.')
      data.freeAbove = v
    }
    if (body.minutes !== undefined) data.minutes = body.minutes == null ? null : Math.max(0, Math.round(Number(body.minutes)))
    if (body.reference !== undefined) data.reference = String(body.reference || '').trim() || null
    if (body.active !== undefined) data.active = Boolean(body.active)
    return data
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
        // JON-31: achado na varredura de 09/09/2026 -- admin mostrava so o
        // orderId truncado na lista de paradas, id interno que ninguem digita
        // em lugar nenhum. Mesmo padrao do DAV ja resolvido pro entregador
        // (JON-12).
        stops: { orderBy: [{ sequence: 'asc' }], include: { order: { select: { erpDav: true } } } },
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

  /**
   * Fila compartilhada de entregas: pedidos que sairam da separacao e ainda nao
   * foram pegos por ninguem. Todo entregador ve a mesma lista.
   *
   * Desenho pedido pelo Jonathan: a operacao evita computador de proposito --
   * o unico passo em PC e puxar o pedido no PDV. Exigir que alguem monte rota
   * no admin criava um gargalo bem no meio do fluxo. Aqui o proprio entregador
   * se serve pelo celular e a rota se monta sozinha atras disso.
   */
  async listAvailableDeliveries(context: Partial<FulfillmentContext> | undefined) {
    const scoped = this.resolveContext(context)
    return this.prisma.order.findMany({
      where: {
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        fulfillmentType: { not: 'PICKUP' },
        // SO READY_FOR_DELIVERY. Regra do Jonathan (29/08/2026): o pedido so
        // libera pro entregador depois de finalizado no PDV Solidcom -- antes
        // disso ele nem foi faturado, e entregar mercadoria sem venda fechada
        // e problema fiscal, nao so de processo.
        //
        // READY_FOR_CHECKOUT (o separador mandou pro caixa) NAO entra: e
        // exatamente o estado "esperando o PDV".
        status: 'READY_FOR_DELIVERY',
        // `stops` vazio = ninguem pegou ainda. E o que torna a fila
        // "compartilhada": some da lista de todos assim que um pega.
        // Parada que falhou (entrega nao realizada) nao conta: depois do
        // "tentar de novo" do admin o pedido volta a aparecer na fila.
        deliveryStops: { none: { status: { not: 'FAILED' } } },
      },
      select: {
        id: true,
        erpDav: true,
        total: true,
        createdAt: true,
        deliveryInstructions: true,
        addressSnapshot: true,
        customer: { select: { name: true, whatsapp: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * O entregador pega um pedido da fila pra si.
   *
   * Atomico de proposito: dois entregadores tocando no mesmo pedido ao mesmo
   * tempo e o caso normal numa fila compartilhada, nao a excecao. A unicidade
   * do schema e `[routeId, orderId]`, que impede o mesmo pedido duas vezes na
   * MESMA rota mas nao em rotas diferentes -- entao sem trava os dois levariam
   * o pedido. `FOR UPDATE` na linha do pedido serializa: o segundo espera o
   * primeiro e recebe "ja foi pego" em vez de uma parada duplicada.
   */
  async takeDelivery(
    context: Partial<FulfillmentContext> | undefined,
    orderId: string,
    driverId: string,
    actor?: { actorType?: string; actorId?: string },
  ) {
    const scoped = this.resolveContext(context)

    const routeId = await this.prisma.$transaction(async (tx) => {
      const travadas = await tx.$queryRaw<Array<{ id: string; status: string; fulfillmentType: string | null }>>`
        SELECT id, status, "fulfillmentType" FROM orders
        WHERE id = ${orderId} AND "tenantId" = ${scoped.tenantId} AND "storeId" = ${scoped.storeId}
        FOR UPDATE
      `
      const pedido = travadas[0]
      if (!pedido) throw new NotFoundException('Pedido nao encontrado.')
      if (pedido.fulfillmentType === 'PICKUP') {
        throw new BadRequestException('Pedido de retirada nao entra em rota de entrega.')
      }
      if (pedido.status !== 'READY_FOR_DELIVERY') {
        throw new BadRequestException('Pedido ainda nao foi finalizado no PDV.')
      }

      const jaPego = await tx.deliveryStop.findFirst({ where: { orderId, status: { not: 'FAILED' } } })
      if (jaPego) throw new BadRequestException('Outro entregador ja pegou este pedido.')

      // Reaproveita a rota aberta do entregador; so cria uma quando nao ha.
      // Sem isso, cada pedido viraria uma rota de uma parada so e o app
      // mostraria uma lista de rotas em vez de uma entrega com varias paradas.
      let rota = await tx.deliveryRoute.findFirst({
        where: { driverId, tenantId: scoped.tenantId, storeId: scoped.storeId, status: { in: ['PLANNED', 'READY'] } },
        orderBy: { createdAt: 'desc' },
      })
      if (!rota) {
        rota = await tx.deliveryRoute.create({
          data: { tenantId: scoped.tenantId, storeId: scoped.storeId, driverId },
        })
      }

      const paradas = await tx.deliveryStop.count({ where: { routeId: rota.id } })
      await tx.deliveryStop.create({
        data: {
          tenantId: scoped.tenantId,
          storeId: scoped.storeId,
          routeId: rota.id,
          orderId,
          sequence: paradas + 1,
        },
      })
      return rota.id
    })

    await this.recordOrderEvent(scoped, orderId, 'order.taken_by_driver', { routeId }, actor)
    return this.findRouteOrThrow(routeId, scoped)
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

  async startRoute(
    routeId: string,
    context: Partial<FulfillmentContext> | undefined,
    actor?: { actorType?: string; actorId?: string },
    ownerDriverId?: string,
  ) {
    const scoped = this.resolveContext(context)
    const route = await this.findRouteOrThrow(routeId, scoped, ownerDriverId)
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

    return this.findRouteOrThrow(routeId, scoped, ownerDriverId)
  }

  /**
   * Entrega que nao deu certo volta para a fila (29/09/2026). Antes o pedido
   * ficava "Saiu para entrega" para sempre. Nao e automatico de proposito:
   * quase sempre alguem precisa falar com o cliente antes (endereco errado,
   * ausente, desistiu) -- reenviar direto repetia a viagem perdida.
   */
  async retryFailedDelivery(context: Partial<FulfillmentContext> | undefined, orderId: string, actor?: { actorType?: string; actorId?: string }) {
    const scoped = this.resolveContext(context)
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: scoped.tenantId, storeId: scoped.storeId },
      select: { id: true, status: true },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado.')
    if (!['OUT_FOR_DELIVERY', 'READY_FOR_DELIVERY'].includes(order.status)) {
      throw new BadRequestException('So da para reenviar entrega de pedido que estava em rota.')
    }
    const failed = await this.prisma.deliveryStop.findFirst({ where: { orderId, status: 'FAILED' } })
    const active = await this.prisma.deliveryStop.findFirst({ where: { orderId, status: { notIn: ['FAILED', 'DELIVERED'] } } })
    if (!failed || active) throw new BadRequestException('Este pedido nao tem entrega pendente de decisao.')
    return this.updateOrderFulfillmentStatus(scoped, orderId, 'READY_FOR_DELIVERY', 'order.delivery_retry', { failedStopId: failed.id }, actor)
  }

  /** Acompanhamento de entregas e retiradas para o admin (29/09/2026). */
  async getSupervision(context: Partial<FulfillmentContext> | undefined, period: 'day' | 'week' = 'day') {
    const scoped = this.resolveContext(context)
    const now = new Date()
    const local = new Date(now.getTime() - 3 * 3600_000)
    const today = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 3 * 3600_000)
    const from = period === 'week' ? new Date(today.getTime() - 6 * 86400_000) : today
    const since = (d?: Date | null) => (d ? Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000)) : 0)
    const code = (id: string) => id.slice(-8).toUpperCase()
    const hood = (snap: unknown) => String((snap as { neighborhood?: string } | null)?.neighborhood || '')
    const orderSelect = { id: true, erpDav: true, status: true, updatedAt: true, addressSnapshot: true, customer: { select: { name: true } } } as const

    const available = await this.listAvailableDeliveries(scoped)
    // "Pronto ha quanto tempo" = ultima mudanca do pedido (faturado no caixa).
    const readyTimes = new Map(
      (await this.prisma.order.findMany({ where: { id: { in: available.map((o) => o.id) } }, select: { id: true, updatedAt: true } })).map((o) => [o.id, since(o.updatedAt)]),
    )
    const ready = available.map((o) => ({
      orderId: o.id,
      code: code(o.id),
      dav: o.erpDav,
      customer: o.customer?.name || '',
      neighborhood: hood(o.addressSnapshot),
      items: o._count.items,
      minutes: readyTimes.get(o.id) ?? 0,
    }))

    const openStops = await this.prisma.deliveryStop.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, status: { in: ['PENDING', 'OUT_FOR_DELIVERY', 'ARRIVED'] }, route: { status: { not: 'COMPLETED' } } },
      select: { id: true, status: true, updatedAt: true, route: { select: { id: true, driver: { select: { name: true } } } }, order: { select: orderSelect } },
    })
    const onRoute = openStops
      .filter((st) => !['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(st.order.status))
      .map((st) => ({
        orderId: st.order.id,
        code: code(st.order.id),
        dav: st.order.erpDav,
        customer: st.order.customer?.name || '',
        neighborhood: hood(st.order.addressSnapshot),
        driver: st.route.driver?.name || 'sem entregador',
        stopStatus: st.status,
        minutes: since(st.updatedAt),
      }))

    const failedStops = await this.prisma.deliveryStop.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, status: 'FAILED', order: { status: 'OUT_FOR_DELIVERY' } },
      select: { updatedAt: true, route: { select: { driver: { select: { name: true } } } }, order: { select: orderSelect } },
      orderBy: { updatedAt: 'desc' },
    })
    const failedIds = [...new Set(failedStops.map((f) => f.order.id))]
    const reasons = new Map(
      (
        await this.prisma.orderEvent.findMany({
          where: { orderId: { in: failedIds }, type: 'order.delivery_failed' },
          orderBy: { createdAt: 'asc' },
          select: { orderId: true, payload: true },
        })
      ).map((e) => [e.orderId, String((e.payload as { notes?: string } | null)?.notes || '')]),
    )
    const seenFailed = new Set<string>()
    const failed = failedStops
      .filter((f) => {
        if (seenFailed.has(f.order.id)) return false
        seenFailed.add(f.order.id)
        return true
      })
      .map((f) => ({
        orderId: f.order.id,
        code: code(f.order.id),
        dav: f.order.erpDav,
        customer: f.order.customer?.name || '',
        neighborhood: hood(f.order.addressSnapshot),
        driver: f.route.driver?.name || '',
        reason: reasons.get(f.order.id) || '',
        minutes: since(f.updatedAt),
      }))

    const pickups = (
      await this.prisma.order.findMany({
        where: { tenantId: scoped.tenantId, storeId: scoped.storeId, fulfillmentType: 'PICKUP', status: 'READY_FOR_PICKUP' },
        select: orderSelect,
        orderBy: { updatedAt: 'asc' },
      })
    ).map((o) => ({ orderId: o.id, code: code(o.id), dav: o.erpDav, customer: o.customer?.name || '', minutes: since(o.updatedAt) }))

    const deliveredToday = await this.prisma.deliveryStop.count({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, status: 'DELIVERED', deliveredAt: { gte: today } },
    })

    // Desempenho: saida (evento stop.out_for_delivery) ate a entrega.
    const doneStops = await this.prisma.deliveryStop.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, status: { in: ['DELIVERED', 'FAILED'] }, updatedAt: { gte: from } },
      select: { id: true, status: true, deliveredAt: true, route: { select: { driverId: true, driver: { select: { name: true } } } } },
    })
    const departures = new Map(
      (
        await this.prisma.fulfillmentEvent.findMany({
          where: { stopId: { in: doneStops.map((d) => d.id) }, type: 'stop.out_for_delivery' },
          select: { stopId: true, createdAt: true },
        })
      ).map((e) => [e.stopId, e.createdAt]),
    )
    const perf = new Map<string, { driver: string; delivered: number; failed: number; minutes: number; timed: number }>()
    for (const d of doneStops) {
      const key = d.route.driverId || 'sem'
      const e = perf.get(key) || { driver: d.route.driver?.name || 'sem entregador', delivered: 0, failed: 0, minutes: 0, timed: 0 }
      if (d.status === 'DELIVERED') {
        e.delivered += 1
        const left = departures.get(d.id)
        if (left && d.deliveredAt) {
          e.minutes += (d.deliveredAt.getTime() - left.getTime()) / 60000
          e.timed += 1
        }
      } else {
        e.failed += 1
      }
      perf.set(key, e)
    }
    const team = [...perf.values()]
      .map((e) => ({ driver: e.driver, delivered: e.delivered, failed: e.failed, avgMinutes: e.timed ? Math.round(e.minutes / e.timed) : null }))
      .sort((a, b) => b.delivered - a.delivered)

    const drivers = await this.prisma.driver.findMany({
      where: { tenantId: scoped.tenantId, storeId: scoped.storeId, status: 'ACTIVE' },
      select: { id: true, name: true },
    })

    return { generatedAt: now.toISOString(), period, ready, onRoute, failed, pickups, deliveredToday, team, drivers }
  }

  async updateStopStatus(
    routeId: string,
    stopId: string,
    context: Partial<FulfillmentContext> | undefined,
    dto: UpdateDeliveryStopStatusDto,
    actor?: { actorType?: string; actorId?: string },
    ownerDriverId?: string,
  ) {
    const scoped = this.resolveContext(context)
    await this.findRouteOrThrow(routeId, scoped, ownerDriverId)
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
    // Pedido cancelado com a parada ainda aberta (30/09/2026, DAV 102120: o
    // cupom foi cancelado no PDV com o pedido ja na rota, e o app o levou de
    // volta a "saiu para entrega"). A unica saida e "Nao entregue", que fecha
    // a parada e manda a mercadoria de volta para a loja.
    const order = await this.prisma.order.findFirst({ where: { id: stop.orderId }, select: { status: true } })
    const cancelled = ['CANCELLED', 'REFUNDED'].includes(order?.status || '')
    if (cancelled && status !== 'FAILED') {
      throw new BadRequestException('Pedido cancelado: não entregue. Marque "Não entregue" e devolva a mercadoria à loja.')
    }
    const allowed = cancelled ? (['DELIVERED', 'FAILED'].includes(stop.status) ? [] : ['FAILED']) : allowedNext[stop.status] || []
    if (stop.status !== status && !allowed.includes(status)) {
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
      if (!cancelled) this.notificationsService.notifyOrderStatusChange(stop.orderId, 'FAILED_DELIVERY').catch(() => {})
    }

    await this.syncRouteStatusFromStops(routeId, scoped, actor)

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

  async completeRoute(
    routeId: string,
    context: Partial<FulfillmentContext> | undefined,
    actor?: { actorType?: string; actorId?: string },
    ownerDriverId?: string,
  ) {
    const scoped = this.resolveContext(context)
    const route = await this.findRouteOrThrow(routeId, scoped, ownerDriverId)
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
  /**
   * Frete do endereco. Regra de negocio (19/08/2026): o "gratis acima de" da
   * area/localidade vence; sem ele, vale o global (Marca). Ate 01/10/2026 so o
   * aceite do pedido (OrdersService.isFreeShippingEarnedByZone) sabia do
   * global -- o checkout cobrava o frete mesmo com o site anunciando gratis.
   */
  async calculate(lookup: DeliveryLookup): Promise<DeliveryCalculation> {
    const calc = await this.matchDelivery(lookup)
    if (calc.outOfArea || calc.freeAbove != null) return calc
    const brand = await this.prisma.brandConfig.findUnique({ where: { id: 'singleton' }, select: { freeShippingThreshold: true } })
    if (brand?.freeShippingThreshold == null) return calc
    const freeAbove = Number(brand.freeShippingThreshold)
    const isFree = lookup.subtotal != null && lookup.subtotal >= freeAbove
    return { ...calc, freeAbove, isFree, fee: isFree ? 0 : calc.fee }
  }

  private async matchDelivery({
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
    const balcaoResult = await this.resolveBalcaoLocality(cep, locality, deliveryPointCode, subtotal, scoped)
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

  private async findZoneOrThrow(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } })
    if (!zone) throw new NotFoundException('Zona de entrega nao encontrada')
    return zone
  }

  private async findDriverOrThrow(id: string, context: FulfillmentContext) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, tenantId: context.tenantId, storeId: context.storeId },
    })
    if (!driver) throw new NotFoundException('Motorista nao encontrado.')
    return driver
  }

  // JON-72 (Auditoria 360, High): ownerDriverId e opcional de proposito --
  // gestao administrativa (DeliveryController, guardado por @Roles('admin'))
  // continua vendo/mexendo em qualquer rota da loja sem passar isso. So o
  // DriverController (motorista autenticado) passa o proprio driver.id, e
  // so entao a rota de OUTRO motorista vira 404 em vez de ficar acessivel
  // por quem souber o routeId.
  private async findRouteOrThrow(routeId: string, context: FulfillmentContext, ownerDriverId?: string) {
    const route = await this.prisma.deliveryRoute.findFirst({
      where: {
        id: routeId,
        tenantId: context.tenantId,
        storeId: context.storeId,
        ...(ownerDriverId ? { driverId: ownerDriverId } : {}),
      },
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

  /**
   * Mantem o status da rota coerente com o das paradas dela.
   *
   * Sem isso a rota ficava PLANNED pra sempre: o entregador avanca as paradas
   * pelo app (updateStopStatus), que mexia na parada, no pedido e na
   * notificacao -- e nunca na rota. Resultado observado em producao em
   * 29/08/2026: rota "Montando" com as duas paradas ja em transito, e a tela do
   * admin ainda oferecendo "Liberar", que re-dispararia order.out_for_delivery
   * em todos os pedidos.
   *
   * Vale mais ainda no fluxo de fila compartilhada, onde ninguem passa pelo
   * admin: `startRoute` simplesmente nunca e chamado, entao a rota SO tem como
   * mudar de status por aqui.
   */
  private async syncRouteStatusFromStops(
    routeId: string,
    scoped: FulfillmentContext,
    actor?: { actorType?: string; actorId?: string },
  ) {
    const route = await this.prisma.deliveryRoute.findFirst({
      where: { id: routeId, tenantId: scoped.tenantId, storeId: scoped.storeId },
      include: { stops: true },
    })
    if (!route || route.status === 'CANCELLED') return

    const terminais = ['DELIVERED', 'FAILED']
    const todasFinalizadas = route.stops.length > 0 && route.stops.every((s) => terminais.includes(s.status))
    const algumaSaiu = route.stops.some((s) => s.status !== 'PENDING')

    if (todasFinalizadas && route.status !== 'COMPLETED') {
      await this.prisma.deliveryRoute.update({
        where: { id: routeId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      await this.recordFulfillmentEvent({
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        routeId,
        type: 'route.completed',
        payload: { stopCount: route.stops.length, auto: true },
        actor,
      })
      return
    }

    if (algumaSaiu && ['PLANNED', 'READY'].includes(route.status)) {
      await this.prisma.deliveryRoute.update({
        where: { id: routeId },
        data: { status: 'OUT_FOR_DELIVERY', startsAt: route.startsAt || new Date() },
      })
      await this.recordFulfillmentEvent({
        tenantId: scoped.tenantId,
        storeId: scoped.storeId,
        routeId,
        type: 'route.out_for_delivery',
        payload: { stopCount: route.stops.length, auto: true },
        actor,
      })
    }
  }

  private async updateOrderFulfillmentStatus(
    context: FulfillmentContext,
    orderId: string,
    status: string,
    eventType: string,
    payload: Record<string, unknown>,
    actor?: { actorType?: string; actorId?: string },
  ) {
    // Pedido cancelado nao volta a andar pela rota (iniciar rota com ele
    // dentro, ou parada avancando): sem isto o status regredia de CANCELLED.
    const order = await this.prisma.order
      .update({
        where: { id: orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        data: { status },
        select: { id: true, tenantId: true, storeId: true, status: true, paymentStatus: true },
      })
      .catch((error) => {
        if (error?.code === 'P2025') return null
        throw error
      })
    if (!order) return null
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
