import { isWithinDeliveryHours } from '../../common/delivery-hours'
import { loadHoursConfig } from '../../common/promo-day'
import { isProductSellable } from '../../common/product-availability'
import { randomUUID } from 'crypto'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { productPath } from '../seo/seo.service'
import { Prisma } from '@prisma/client'
import { resolveBannerLink } from '../cms/store-banners/banner-link'
import { PrismaService } from '../../common/prisma.service'
import { assertPublicHttpsEndpoint } from '../../common/security/assert-public-endpoint'
import { PushNotificationService } from './push-notification.service'
import { WhatsAppService } from './whatsapp.service'

export interface CreateNotificationDto {
  type: 'ORDER_UPDATE' | 'PROMO' | 'CAMPAIGN'
  title: string
  body: string
  customerId?: string
  imageUrl?: string
  productId?: string
  /**
   * Aponta a notificacao pra um banner: o clique abre exatamente onde o botao
   * daquele banner abriria (categoria, produto, busca ou URL), porque o destino
   * e resolvido do proprio linkType/linkValue dele. Vence o productId quando os
   * dois vierem.
   */
  bannerId?: string
  /**
   * URL do push, vence banner/produto/fallback quando informada. Nao e
   * persistida (Notification nao tem coluna de url) -- so afeta o push.
   */
  url?: string
  /** De onde veio o aviso, para medir resultado por origem (29/09/2026). */
  source?: 'MANUAL' | 'AUTO' | 'SCHEDULED' | 'ORDER' | 'CART' | 'ENCARTE'
}

/** Destino do clique com ?n=<id>: o site registra a abertura (ver POST :id/opened). */
function withNotificationId(url: string, id: string) {
  return `${url}${url.includes('?') ? '&' : '?'}n=${encodeURIComponent(id)}`
}

/**
 * Fonte UNICA de titulo/emoji/corpo por status de pedido.
 *
 * Ate 12/09/2026 existiam DUAS copias manuais disso -- uma aqui (so label,
 * sem emoji, usada no sino) e outra em push-notification.service.ts (com
 * emoji + frase completa, usada so no push). As duas precisavam ser mantidas
 * em sincronia a mao e nunca eram: READY_FOR_CHECKOUT chegou a faltar dos
 * dois lados em momentos diferentes. Pior, os DOIS caminhos eram chamados pra
 * cada mudanca de status (ver notifyOrderStatusChange), entao o cliente
 * recebia dois pushes diferentes pro mesmo evento.
 *
 * Agora e um mapa so, e notifyOrderStatusChange chama create() uma unica vez
 * -- o sino e o push usam exatamente o mesmo titulo/corpo.
 */
const ORDER_STATUS_META: Record<string, { emoji: string; label: string; body: (shortId: string) => string }> = {
  PENDING: { emoji: '⏳', label: 'Pedido Recebido', body: (id) => `Pedido #${id} recebido` },
  CONFIRMED: { emoji: '✅', label: 'Pedido Confirmado', body: (id) => `Pedido #${id} confirmado e em preparo` },
  PICKING_PENDING: { emoji: '📋', label: 'Na Fila de Separação', body: (id) => `Pedido #${id} na fila de separação` },
  PICKING: { emoji: '🛒', label: 'Em Separação', body: (id) => `Pedido #${id} sendo separado` },
  CONFERENCE_PENDING: { emoji: '🔍', label: 'Em Conferência', body: (id) => `Pedido #${id} separado, em conferência` },
  READY_FOR_CHECKOUT: { emoji: '💳', label: 'No Caixa', body: (id) => `Pedido #${id} no caixa` },
  READY_FOR_DELIVERY: { emoji: '📦', label: 'Pronto para Entrega', body: (id) => `Pedido #${id} pronto para entrega` },
  READY_FOR_PICKUP: { emoji: '📦', label: 'Pronto para Retirada', body: (id) => `Pedido #${id} pronto para retirada na loja` },
  OUT_FOR_DELIVERY: { emoji: '🚚', label: 'Saiu para Entrega', body: (id) => `Pedido #${id} saiu para entrega` },
  DELIVERED: { emoji: '✅', label: 'Entregue', body: (id) => `Pedido #${id} entregue com sucesso!` },
  COMPLETED: { emoji: '🎉', label: 'Concluído', body: (id) => `Pedido #${id} concluído!` },
  CANCELLED: { emoji: '⚠️', label: 'Cancelado', body: (id) => `Pedido #${id} cancelado` },
  FAILED_DELIVERY: { emoji: '⚠️', label: 'Entrega Falhou', body: (id) => `Não conseguimos entregar o pedido #${id}` },
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async create(dto: CreateNotificationDto) {
    // Destino do banner resolvido AQUI, no envio, e nao no clique: o push
    // carrega uma URL pronta, e a regra de resolucao e a mesma do storefront
    // (ver banner-link.ts e o teste de paridade que guarda as duas copias).
    let urlDoBanner: string | undefined
    if (dto.bannerId) {
      const banner = await this.prisma.storeBanner.findUnique({
        where: { id: dto.bannerId },
        select: { linkType: true, linkValue: true, desktopImageUrl: true },
      })
      if (!banner) throw new NotFoundException('Banner nao encontrado')
      urlDoBanner = resolveBannerLink(banner.linkValue, banner.linkType)
      // Sem imagem escolhida, usa a arte do proprio banner -- e o que o cliente
      // ja viu na loja, entao a notificacao fica coerente com a campanha. Usa a
      // versao desktop: e a unica obrigatoria no schema (mobileImageUrl e
      // opcional) e o balao da notificacao e largo, nao estreito.
      if (!dto.imageUrl) dto.imageUrl = banner.desktopImageUrl || undefined
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        customerId: dto.customerId,
        imageUrl: dto.imageUrl,
        productId: dto.productId,
        source: dto.source || (dto.type === 'ORDER_UPDATE' ? 'ORDER' : 'MANUAL'),
      },
    })

    if (notification.customerId) {
      const base = dto.url || urlDoBanner || (await this.productUrl(notification.productId))
      await this.pushNotificationService.sendNotification(notification.customerId, {
        title: notification.title,
        body: notification.body,
        image: notification.imageUrl || undefined,
        url: withNotificationId(base, notification.id),
      })
    }

    return notification
  }

  /**
   * Broadcast pra varios clientes de uma vez (admin/broadcast, ciclo de IA).
   *
   * Ate 12/09/2026 o controller fazia um loop `for` chamando create() uma vez
   * por cliente: cada iteracao refazia a MESMA consulta do banner (se houver)
   * e mandava os pushes um de cada vez, em serie. Pra loja pequena nao doia,
   * mas escala mal -- resolve o banner UMA vez aqui e manda os pushes em
   * paralelo.
   */
  async broadcastToCustomers(customerIds: string[], dto: Omit<CreateNotificationDto, 'customerId'>) {
    if (customerIds.length === 0) return { count: 0 }

    let urlDoBanner: string | undefined
    let imageUrl = dto.imageUrl
    if (dto.bannerId) {
      const banner = await this.prisma.storeBanner.findUnique({
        where: { id: dto.bannerId },
        select: { linkType: true, linkValue: true, desktopImageUrl: true },
      })
      if (!banner) throw new NotFoundException('Banner nao encontrado')
      urlDoBanner = resolveBannerLink(banner.linkValue, banner.linkType)
      if (!imageUrl) imageUrl = banner.desktopImageUrl || undefined
    }

    // Id por cliente gerado aqui: vai na URL do push (?n=) para medir o clique.
    const batchId = randomUUID()
    const rows = customerIds.map((customerId) => ({ id: randomUUID(), customerId }))
    await this.prisma.notification.createMany({
      data: rows.map((row) => ({
        id: row.id,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        customerId: row.customerId,
        imageUrl,
        productId: dto.productId,
        batchId,
        source: dto.source || 'MANUAL',
      })),
    })

    const url = dto.url || urlDoBanner || (await this.productUrl(dto.productId))
    await Promise.all(
      rows.map((row) =>
        this.pushNotificationService.sendNotification(row.customerId, {
          title: dto.title,
          body: dto.body,
          image: imageUrl,
          url: withNotificationId(url, row.id),
        }),
      ),
    )

    return { count: customerIds.length, batchId }
  }

  /** URL limpa do produto (/p/<nome>-<codigo>); a antiga /produto/<id> redirecionava e perdia o ?n=. */
  private async productUrl(productId?: string | null) {
    if (!productId) return '/'
    // Mesmo nome que a pagina do produto usa no endereco canonico (sem redirecionar).
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, erpProductId: true } })
    return product ? productPath(product) : '/'
  }

  /** Clique no push: grava a abertura uma vez (e marca como lida). */
  async markOpened(id: string) {
    await this.prisma.notification.updateMany({ where: { id, clickedAt: null }, data: { clickedAt: new Date(), read: true } })
    return { ok: true }
  }

  /**
   * Historico de disparos, pra auditoria: o que foi enviado, quando, pra
   * quantos e quantos abriram.
   *
   * Nao existe entidade "disparo" no schema -- cada envio grava uma linha por
   * cliente, soltas. O agrupamento e reconstruido por (titulo, corpo, minuto),
   * que funciona porque as linhas de um mesmo envio nascem no mesmo segundo.
   * Nao e vinculo real: dois envios identicos dentro do mesmo minuto contariam
   * como um. Na pratica isso nao acontece (o ciclo da IA tem cooldown de 20h
   * por produto), e a alternativa exigiria migration com batchId. Se um dia
   * precisar de precisao -- relatorio por campanha pra anunciante, por
   * exemplo -- e ai que vale criar a coluna.
   */
  /**
   * `types` filtra quais tipos entram (PROMO/CAMPAIGN/ORDER_UPDATE). Quem
   * decide o default e o CONTROLLER, nao aqui -- ver notifications.controller.ts:
   * sem filtro explicito no request, ele manda ['PROMO','CAMPAIGN'], que e o
   * que essa tela audita de verdade. `offset` pagina; `hasMore` vem de pedir
   * um registro a mais do que o limite e checar se sobrou.
   */
  async listDispatches(limit = 50, types?: string[], offset = 0) {
    const filtro = types && types.length > 0 ? Prisma.sql`WHERE type = ANY(${types})` : Prisma.empty
    const limitSeguro = Math.min(Math.max(limit, 1), 200)
    // Um disparo = mesmo lote (batchId, desde 29/09/2026) ou, nos antigos, mesmo
    // titulo+corpo+minuto. "orders": pedido nao cancelado do mesmo cliente em
    // ate 48 h depois do aviso (efeito provavel, nao prova de causa).
    const rows = await this.prisma.$queryRaw<Array<{
      title: string
      body: string
      type: string
      productId: string | null
      imageUrl: string | null
      sentAt: Date
      source: string | null
      recipients: bigint
      reads: bigint
      opened: bigint
      orders: bigint
      revenue: number | null
    }>>`
      WITH n AS (
        SELECT *, COALESCE("batchId", title || '|' || body || '|' || to_char(date_trunc('minute', "createdAt"), 'YYYY-MM-DD HH24:MI')) AS k
        FROM notifications
        ${filtro}
      ),
      d AS (
        SELECT k, MIN(title) AS title, MIN(body) AS body, MIN(type) AS type, MIN("productId") AS "productId",
          MIN("imageUrl") AS "imageUrl", MIN("createdAt") AS "sentAt", MIN(source) AS source,
          COUNT(*) AS recipients, COUNT(*) FILTER (WHERE read) AS reads, COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL OR read) AS opened
        FROM n GROUP BY k
        ORDER BY MIN("createdAt") DESC
        LIMIT ${limitSeguro + 1} OFFSET ${Math.max(offset, 0)}
      ),
      o AS (
        SELECT DISTINCT n.k, ord.id, ord.total
        FROM n JOIN d ON d.k = n.k
        JOIN orders ord ON ord."customerId" = n."customerId"
          AND n.type <> 'ORDER_UPDATE'
          AND ord."createdAt" > n."createdAt" AND ord."createdAt" <= n."createdAt" + interval '48 hours'
          AND ord.status NOT IN ('CANCELLED', 'REFUNDED')
      )
      SELECT d.*, (SELECT COUNT(*) FROM o WHERE o.k = d.k) AS orders, (SELECT COALESCE(SUM(o.total), 0) FROM o WHERE o.k = d.k)::float AS revenue
      FROM d ORDER BY d."sentAt" DESC
    `

    const hasMore = rows.length > limitSeguro
    const pagina = rows.slice(0, limitSeguro)

    return {
      hasMore,
      items: pagina.map((r) => ({
        title: r.title,
        body: r.body,
        type: r.type,
        productId: r.productId,
        imageUrl: r.imageUrl,
        sentAt: r.sentAt,
        recipients: Number(r.recipients),
        reads: Number(r.reads),
        opened: Number(r.opened),
        orders: Number(r.orders),
        revenue: Number(r.revenue || 0),
        source: r.source,
        // Taxa de leitura da notificacao in-app. NAO e taxa de entrega do push:
        // o retorno do envio (sent/failed) nao e persistido hoje, entao ninguem
        // sabe se o aviso chegou no aparelho -- so se foi gravado e lido aqui.
        readRate: Number(r.recipients) > 0 ? Number(r.reads) / Number(r.recipients) : 0,
      })),
    }
  }

  /** Contagem por tipo, pra tabs com numero ("Promoções (182)") sem precisar
   * carregar a lista inteira so pra saber quantas tem. */
  async countDispatchesByType() {
    const rows = await this.prisma.notification.groupBy({ by: ['type'], _count: { _all: true } })
    return Object.fromEntries(rows.map((r) => [r.type, r._count._all]))
  }

  async findByCustomer(customerId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { customerId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  }

  async markAsReadForCustomer(notificationId: string, customerId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, customerId },
      data: { read: true },
    })

    if (result.count === 0) {
      throw new NotFoundException('Notificacao nao encontrada')
    }

    return this.prisma.notification.findUnique({ where: { id: notificationId } })
  }

  async countUnread(customerId: string) {
    return this.prisma.notification.count({
      where: { customerId, read: false, hiddenAt: null },
    })
  }

  // 01/10/2026: o sininho lista as 50 mais recentes e o numero contava TODAS as
  // nao lidas -- quem tinha mais de 50 nunca conseguia zerar.
  async markAllAsReadForCustomer(customerId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { customerId, read: false }, data: { read: true } })
    return { updated: count }
  }

  async clearForCustomer(customerId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { customerId, hiddenAt: null },
      data: { hiddenAt: new Date(), read: true },
    })
    return { cleared: count }
  }

  async savePushSubscription(
    customerId: string,
    subscription: {
      endpoint: string
      auth?: string
      p256dh?: string
      keys?: {
        auth?: string
        p256dh?: string
      }
    },
  ) {
    // JON-140: SSRF -- ver assert-public-endpoint.ts.
    await assertPublicHttpsEndpoint(subscription.endpoint)
    const auth = subscription.auth || subscription.keys?.auth || ''
    const p256dh = subscription.p256dh || subscription.keys?.p256dh || ''

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      // adminId: null zera dono anterior -- o mesmo aparelho pode ter sido
      // inscrito como funcionario, e a constraint do banco exige UM dono.
      update: { customerId, adminId: null, auth, p256dh },
      create: {
        customerId,
        endpoint: subscription.endpoint,
        auth,
        p256dh,
      },
    })
  }

  /** Inscricao de aparelho de funcionario (apps de separacao e entrega). */
  async saveStaffPushSubscription(
    adminId: string,
    subscription: { endpoint: string; auth?: string; p256dh?: string; keys?: { auth?: string; p256dh?: string } },
  ) {
    // JON-140: SSRF -- ver assert-public-endpoint.ts.
    await assertPublicHttpsEndpoint(subscription.endpoint)
    const auth = subscription.auth || subscription.keys?.auth || ''
    const p256dh = subscription.p256dh || subscription.keys?.p256dh || ''

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      // customerId: null zera dono anterior -- o celular do dono da loja pode
      // ter sido inscrito como cliente antes, e o banco exige UM dono.
      update: { adminId, customerId: null, auth, p256dh },
      create: { adminId, endpoint: subscription.endpoint, auth, p256dh },
    })
  }

  /**
   * JON-148 (Auditoria 360): logout so limpava JWT/dados locais -- a
   * subscription de push continuava viva no navegador/servidor. Em aparelho
   * compartilhado, quem entrasse depois continuava recebendo push da conta
   * anterior. Remove so a inscricao DESTE endpoint, e so se pertencer a
   * quem esta chamando (customerId OU adminId, dependendo de quem logou).
   */
  async deletePushSubscriptionByEndpoint(endpoint: string, owner: { customerId?: string; adminId?: string }) {
    if (!endpoint) return { ok: false }
    const where = owner.customerId
      ? { endpoint, customerId: owner.customerId }
      : { endpoint, adminId: owner.adminId }
    const result = await this.prisma.pushSubscription.deleteMany({ where })
    return { ok: result.count > 0 }
  }

  async getPushSubscriptionsForCustomer(customerId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { customerId },
    })
  }

  async getAllCustomerIds(): Promise<string[]> {
    // Cliente bloqueado (antifraude) nao recebe aviso de marketing.
    const customers = await this.prisma.customer.findMany({
      where: { blocked: false },
      select: { id: true },
    })
    return customers.map((c) => c.id)
  }

  /**
   * Agenda um broadcast pra rodar depois -- ScheduledNotificationScheduler
   * dispara quando sendAt chegar.
   *
   * JON-142 (Auditoria 360, High): tenantId nao vinha em `dto` (o controller
   * so repassava campos do body) e o Prisma gravava o default do schema --
   * admin de um tenant listava/cancelava agendamento de outro so por
   * conhecer o id, porque listScheduledBroadcasts/cancelScheduledBroadcast
   * tambem nao filtravam por tenant. O dispatch em si (mais abaixo,
   * `dispatchDueScheduledBroadcasts`, chamado pelo cron) continua olhando
   * todos os tenants de proposito -- e o worker do sistema, nao uma rota
   * autenticada por tenant.
   */
  async scheduleBroadcast(dto: {
    type: 'PROMO' | 'CAMPAIGN'
    title: string
    body: string
    customerId?: string
    imageUrl?: string
    productId?: string
    bannerId?: string
    inactiveDays?: number
    purchasedCategory?: string
    sendAt: Date
  }, tenantId: string) {
    const audienceLabel = dto.customerId
      ? 'Um cliente'
      : [dto.inactiveDays ? `sem comprar há ${dto.inactiveDays} dias` : null, dto.purchasedCategory ? `compraram em ${dto.purchasedCategory}` : null].filter(Boolean).join(' e ') || 'Todos os clientes com conta'
    return this.prisma.scheduledNotification.create({
      data: { ...dto, tenantId, origin: 'MANUAL', status: 'SCHEDULED', audienceLabel: audienceLabel.charAt(0).toUpperCase() + audienceLabel.slice(1) },
    })
  }

  /**
   * Despacha a FILA DE ENVIOS (02/10/2026) -- unico lugar que envia aviso com
   * hora marcada (encarte, oferta personalizada, agendado manual). Roda a cada
   * minuto. Aviso automatico (respectHours) espera a loja abrir; passou do
   * horario-limite (expiresAt) sem sair, vira "nao saiu" com o motivo.
   */
  async dispatchDueQueue(now = new Date()) {
    await this.prisma.scheduledNotification.updateMany({
      where: { status: 'PENDING_APPROVAL', expiresAt: { lt: now } },
      data: { status: 'SKIPPED', note: 'Não foi aprovado até o horário-limite.' },
    })
    const due = await this.prisma.scheduledNotification.findMany({
      where: { status: 'SCHEDULED', sendAt: { lte: now } },
      orderBy: { sendAt: 'asc' },
      take: 50,
    })
    if (!due.length) return { count: 0 }
    const hours = due.some((d) => d.respectHours) ? await loadHoursConfig(this.prisma) : null
    const open = !hours || isWithinDeliveryHours(hours, now)

    let sent = 0
    for (const item of due) {
      if (item.expiresAt && item.expiresAt.getTime() < now.getTime()) {
        await this.prisma.scheduledNotification.updateMany({
          where: { id: item.id, status: 'SCHEDULED' },
          data: { status: 'SKIPPED', note: 'Passou do horário-limite sem sair (a loja estava fechada).' },
        })
        continue
      }
      if (item.respectHours && !open) continue
      if (await this.dispatchQueueItem(item.id, now)) sent += 1
    }
    return { count: sent }
  }

  /**
   * Envia UM item da fila. Claim atomico (SCHEDULED -> SENDING) antes de tudo:
   * cron e "Enviar agora" ao mesmo tempo nao mandam duas vezes (mesma regra do
   * JON-158). Oferta personalizada e reconferida na hora: a oferta ainda vale e
   * o cliente nao recebeu outro aviso de marketing nas ultimas 20h.
   */
  async dispatchQueueItem(id: string, now = new Date()): Promise<boolean> {
    const claim = await this.prisma.scheduledNotification.updateMany({ where: { id, status: 'SCHEDULED' }, data: { status: 'SENDING' } })
    if (claim.count !== 1) return false
    const item = await this.prisma.scheduledNotification.findUnique({ where: { id } })
    if (!item) return false
    const skip = async (note: string) => {
      await this.prisma.scheduledNotification.update({ where: { id }, data: { status: 'SKIPPED', note } })
      return false
    }

    try {
      let customers = item.customerIds.length
        ? item.customerIds
        : item.customerId
          ? [item.customerId]
          : await this.findCustomerIdsBySegment({ inactiveDays: item.inactiveDays ?? undefined, purchasedCategory: item.purchasedCategory ?? undefined })

      if (item.origin === 'OFERTA') {
        const reason = await this.offerNoLongerValid(item.productId)
        if (reason) return skip(reason)
        const recent = await this.prisma.notification.findMany({
          where: {
            customerId: { in: customers },
            source: { in: ['AUTO', 'MANUAL', 'SCHEDULED', 'ENCARTE'] },
            type: { not: 'ORDER_UPDATE' },
            createdAt: { gte: new Date(now.getTime() - 20 * 3_600_000) },
          },
          select: { customerId: true },
        })
        const busy = new Set(recent.map((n) => n.customerId))
        customers = customers.filter((c) => !busy.has(c))
      }

      const allowed = await this.prisma.customer.findMany({ where: { id: { in: customers }, blocked: false }, select: { id: true } })
      customers = allowed.map((c) => c.id)
      if (!customers.length) return skip('Nenhum cliente elegível na hora do envio.')

      const source = item.origin === 'OFERTA' ? 'AUTO' : item.origin.startsWith('ENCARTE') ? 'ENCARTE' : 'SCHEDULED'
      const result = await this.broadcastToCustomers(customers, {
        type: item.type as 'PROMO' | 'CAMPAIGN',
        title: item.title,
        body: item.body,
        url: item.url ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        productId: item.productId ?? undefined,
        bannerId: item.bannerId ?? undefined,
        source,
      })
      await this.prisma.scheduledNotification.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), sentCount: result.count, batchId: result.batchId ?? null, note: null },
      })
      const campaignId = (item.meta as { campaignId?: string } | null)?.campaignId
      if (campaignId && item.origin === 'ENCARTE_INICIO') await this.prisma.promotionCampaign.updateMany({ where: { id: campaignId }, data: { startNotifiedAt: new Date() } })
      if (campaignId && item.origin === 'ENCARTE_FIM') await this.prisma.promotionCampaign.updateMany({ where: { id: campaignId }, data: { endingNotifiedAt: new Date() } })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Falha ao enviar o item ${id} da fila: ${message}`)
      await this.prisma.scheduledNotification.update({ where: { id }, data: { status: 'FAILED', note: message.slice(0, 300) } })
      return false
    }
  }

  /** A oferta do aviso ainda existe? Motivo em portugues, ou null se ainda vale. */
  private async offerNoLongerValid(productId: string | null): Promise<string | null> {
    if (!productId) return null
    const [product, settings] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { active: true, syncOption: true, stock: true, price: true, promotionalPrice: true } }),
      this.prisma.autoOfferSettings.findUnique({ where: { id: 'singleton' }, select: { minDiscount: true } }),
    ])
    if (!product || !isProductSellable(product)) return 'O produto saiu do site antes do envio.'
    if (!product.promotionalPrice || product.promotionalPrice >= product.price) return 'A oferta acabou antes do envio.'
    if (1 - product.promotionalPrice / product.price < (settings?.minDiscount ?? 0) / 100) return 'O desconto ficou abaixo do mínimo antes do envio.'
    return null
  }

  /**
   * Segmentacao pro broadcast manual (admin). Sem filtro nenhum, cai no
   * comportamento antigo (todos). Os dois filtros, quando vem juntos, sao
   * intersecao (E, nao OU) -- e o que "inativos ha 30 dias que compraram
   * vinho" espera.
   */
  async findCustomerIdsBySegment(filtro: { inactiveDays?: number; purchasedCategory?: string }): Promise<string[]> {
    if (!filtro.inactiveDays && !filtro.purchasedCategory) {
      return this.getAllCustomerIds()
    }

    let ids: string[] | undefined

    if (filtro.purchasedCategory) {
      const rows = await this.prisma.order.findMany({
        where: { items: { some: { product: { category: filtro.purchasedCategory } } } },
        select: { customerId: true },
        distinct: ['customerId'],
      })
      ids = rows.map((r) => r.customerId)
    }

    if (filtro.inactiveDays) {
      const cutoff = new Date(Date.now() - filtro.inactiveDays * 24 * 60 * 60 * 1000)
      const lastOrderByCustomer = await this.prisma.order.groupBy({
        by: ['customerId'],
        _max: { createdAt: true },
      })
      const recentIds = new Set(
        lastOrderByCustomer.filter((o) => o._max.createdAt && o._max.createdAt >= cutoff).map((o) => o.customerId),
      )
      const allCustomers = await this.prisma.customer.findMany({ select: { id: true } })
      const inactiveIds = allCustomers.map((c) => c.id).filter((id) => !recentIds.has(id))
      ids = ids ? ids.filter((id) => inactiveIds.includes(id)) : inactiveIds
    }

    return ids ?? []
  }

  /**
   * Avisa a equipe de separacao que ha pedido novo pra separar.
   *
   * Existe porque o app de separacao roda no CELULAR do funcionario e ate
   * 03/09/2026 nao avisava nada: so descobria pedido novo quem lembrasse de
   * abrir o app e olhar a lista. Pedido parado e SLA estourado sem ninguem
   * saber -- e o cliente esperando.
   *
   * Nunca deixa uma falha de push derrubar o fluxo: o pedido ja foi criado e
   * a tarefa ja existe quando isto roda. Aviso que nao sai e ruim; pedido que
   * nao entra na fila por causa do aviso e muito pior.
   */
  async notifyPickingTeamNewOrder(orderId: string, itemCount: number): Promise<void> {
    const shortId = orderId.slice(-8).toUpperCase()
    try {
      await this.pushNotificationService.sendNotificationToModule('picking', {
        title: 'Novo pedido para separar',
        body: `Pedido #${shortId} - ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`,
        url: `/pedidos/${orderId}`,
        // Uma notificacao por pedido: sem tag, dez pedidos viram dez avisos
        // empilhados e o separador para de ler.
        tag: `picking-${orderId}`,
      })
    } catch (error) {
      this.logger.warn(`Push de separacao falhou para ${orderId}: ${(error as Error).message}`)
    }
  }

  /**
   * Avisa a equipe de entrega que ha pedido disponivel na fila.
   *
   * Dispara quando o pedido e faturado no PDV e vira READY_FOR_DELIVERY --
   * o momento em que ele aparece na fila compartilhada e qualquer entregador
   * pode pegar pra si.
   */
  async notifyDeliveryTeamOrderReady(orderId: string): Promise<void> {
    const shortId = orderId.slice(-8).toUpperCase()
    try {
      await this.pushNotificationService.sendNotificationToModule('delivery', {
        title: 'Entrega disponivel',
        body: `Pedido #${shortId} liberado para entrega`,
        url: '/',
        tag: `delivery-${orderId}`,
      })
    } catch (error) {
      this.logger.warn(`Push de entrega falhou para ${orderId}: ${(error as Error).message}`)
    }
  }

  async notifyOrderStatusChange(orderId: string, status: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, customer: { select: { id: true, name: true, whatsapp: true } } },
      })
      if (!order?.customerId) return

      const meta = ORDER_STATUS_META[status]
      if (!meta) return

      const shortId = orderId.slice(-8).toUpperCase()

      // Uma chamada so: create() ja manda o push (ver acima). Sino e push
      // usam o MESMO titulo/corpo agora -- nao tem segundo caminho de envio.
      await this.create({
        type: 'ORDER_UPDATE',
        title: `${meta.emoji} ${meta.label}`,
        body: meta.body(shortId),
        customerId: order.customerId,
        url: '/account',
      })

      if (order.customer?.whatsapp) {
        this.whatsAppService.sendStatusUpdate(order.customer.whatsapp, shortId, status).catch((err) => {
          this.logger.warn(`WhatsApp falhou para pedido ${orderId}: ${err.message}`)
        })
      }
    } catch (err) {
      this.logger.error(`Erro ao notificar status ${status} do pedido ${orderId}:`, err)
    }
  }
}
