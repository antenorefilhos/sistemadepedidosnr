import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma, ScheduledNotification } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { dayWindows, isWithinDeliveryHours, nextOpenAt, spDay } from '../../common/delivery-hours'
import { loadHoursConfig } from '../../common/promo-day'
import { NotificationsService } from '../notifications/notifications.service'
import { OfferPushService } from '../notifications/offer-push.service'
import { PromotionsService } from '../promotions/promotions.service'
import { CartReminderService } from '../cart-reminder/cart-reminder.service'

/**
 * Fila de envios (02/10/2026) -- a tela Notificacoes > Fila. Tudo que sai com
 * hora marcada (encarte, oferta personalizada, agendado manual) e um item de
 * scheduled_notifications; aqui o admin ve, edita, aprova, cancela, restaura e
 * manda na hora. Quem envia e NotificationsService.dispatchQueueItem.
 *
 * Decisao do Jonathan: tudo sai sozinho por padrao, mas a ferramenta da poder
 * total -- cada tipo pode ser desligado ou passar a exigir aprovacao.
 */
const EDITABLE = ['SCHEDULED', 'PENDING_APPROVAL']
const UPCOMING = ['SCHEDULED', 'PENDING_APPROVAL', 'SENDING']
const DONE = ['SENT', 'CANCELLED', 'SKIPPED', 'FAILED']

export type QueueEditInput = { title?: string; body?: string; url?: string | null; sendAt?: string; imageUrl?: string | null }
export type QueueSettingsInput = {
  encarteEnabled?: boolean
  encarteApproval?: boolean
  offerEnabled?: boolean
  offerApproval?: boolean
  cartEnabled?: boolean
  cartApproval?: boolean
  cartDelayMinutes?: number
  cartTitle?: string
  cartBody?: string
  cartImage?: boolean
  cartMinTotal?: number
  cartCooldownDays?: number
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly offerPush: OfferPushService,
    private readonly promotions: PromotionsService,
    private readonly cartReminders: CartReminderService,
  ) {}

  /** Refaz os planos (encarte e oferta) antes de mostrar -- a tela nunca mostra plano velho. */
  async refreshPlans(now = new Date()) {
    await Promise.all([
      this.promotions.planCampaignNotifications(now).catch((e) => this.logger.error(`plano de encarte: ${e instanceof Error ? e.message : e}`)),
      this.offerPush.planNextSlot(now).catch((e) => this.logger.error(`plano de oferta: ${e instanceof Error ? e.message : e}`)),
      this.cartReminders.plan(now).catch((e) => this.logger.error(`plano de carrinho: ${e instanceof Error ? e.message : e}`)),
    ])
  }

  async list(opts: { refresh?: boolean } = {}) {
    const now = new Date()
    if (opts.refresh) await this.refreshPlans(now)

    const [settings, hours, upcoming, recent, allCustomers, subs, cartStats] = await Promise.all([
      this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } }),
      loadHoursConfig(this.prisma),
      this.prisma.scheduledNotification.findMany({ where: { status: { in: UPCOMING } }, orderBy: { sendAt: 'asc' }, take: 200 }),
      this.prisma.scheduledNotification.findMany({
        where: { status: { in: DONE }, updatedAt: { gte: new Date(now.getTime() - 3 * 86_400_000) } },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      }),
      this.prisma.customer.count({ where: { blocked: false } }),
      this.prisma.pushSubscription.findMany({ where: { customerId: { not: null } }, select: { customerId: true }, distinct: ['customerId'] }),
      this.cartReminders.stats(),
    ])
    const withPush = new Set(subs.map((s) => s.customerId as string))

    const batchIds = recent.map((r) => r.batchId).filter((b): b is string => Boolean(b))
    const opened = batchIds.length
      ? await this.prisma.notification.groupBy({ by: ['batchId'], where: { batchId: { in: batchIds }, OR: [{ read: true }, { clickedAt: { not: null } }] }, _count: { _all: true } })
      : []
    const openedBy = new Map(opened.map((o) => [o.batchId as string, o._count._all]))
    const adminIds = [...new Set([...upcoming, ...recent].flatMap((i) => [i.editedBy, i.approvedBy, i.cancelledBy]).filter((x): x is string => Boolean(x)))]
    const admins = adminIds.length ? await this.prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }) : []
    const adminName = new Map(admins.map((a) => [a.id, a.name]))

    const open = !hours || isWithinDeliveryHours(hours, now)
    const today = spDay(now)
    const todayWindows = hours ? dayWindows(hours, today) : []
    const closesAt = todayWindows.find((w) => now.getTime() < w.end.getTime())?.end ?? null
    const view = (i: ScheduledNotification) => {
      const total = i.customerIds.length || (i.customerId ? 1 : i.inactiveDays || i.purchasedCategory ? null : allCustomers)
      const pushCount = i.customerIds.length ? i.customerIds.filter((c) => withPush.has(c)).length : i.customerId ? Number(withPush.has(i.customerId)) : i.inactiveDays || i.purchasedCategory ? null : withPush.size
      // Automatico com a loja fechada na hora marcada: sai na abertura.
      const effectiveSendAt = i.respectHours && hours && EDITABLE.includes(i.status) ? nextOpenAt(hours, new Date(Math.max(i.sendAt.getTime(), now.getTime()))) : i.sendAt
      return {
        id: i.id,
        origin: i.origin,
        status: i.status,
        type: i.type,
        title: i.title,
        body: i.body,
        url: i.url,
        imageUrl: i.imageUrl,
        productId: i.productId,
        sendAt: i.sendAt,
        effectiveSendAt,
        expiresAt: i.expiresAt,
        respectHours: i.respectHours,
        audienceLabel: i.audienceLabel,
        audience: { total, withPush: pushCount },
        meta: i.meta,
        note: i.note,
        edited: i.editedAt ? { at: i.editedAt, by: adminName.get(i.editedBy || '') ?? null } : null,
        approved: i.approvedAt ? { at: i.approvedAt, by: adminName.get(i.approvedBy || '') ?? null } : null,
        cancelled: i.cancelledAt ? { at: i.cancelledAt, by: i.cancelledBy ? adminName.get(i.cancelledBy) ?? null : null } : null,
        sentAt: i.sentAt,
        sentCount: i.sentCount,
        opened: i.batchId ? openedBy.get(i.batchId) ?? 0 : null,
        editable: EDITABLE.includes(i.status),
        canRestore: i.status === 'CANCELLED' && (!i.expiresAt || i.expiresAt.getTime() > now.getTime()),
      }
    }

    return {
      now,
      store: { open, closesAt, opensAt: open ? null : hours ? nextOpenAt(hours, now) : null },
      settings: {
        encarteEnabled: settings.encarteEnabled,
        encarteApproval: settings.encarteApproval,
        offerEnabled: settings.enabled,
        offerApproval: settings.offerApproval,
        offerSendHours: settings.sendHours,
        cartEnabled: settings.cartEnabled,
        cartApproval: settings.cartApproval,
        cartDelayMinutes: settings.cartDelayMinutes,
        cartTitle: settings.cartTitle,
        cartBody: settings.cartBody,
        cartImage: settings.cartImage,
        cartMinTotal: settings.cartMinTotal,
        cartCooldownDays: settings.cartCooldownDays,
      },
      cartStats,
      audience: { customers: allCustomers, withPush: withPush.size },
      upcoming: upcoming.map(view),
      recent: recent.map(view),
    }
  }

  private async getEditable(id: string) {
    const item = await this.prisma.scheduledNotification.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('Envio não encontrado.')
    if (!EDITABLE.includes(item.status)) throw new BadRequestException('Esse envio já saiu ou foi encerrado e não pode mais ser alterado.')
    return item
  }

  async edit(id: string, input: QueueEditInput, adminId?: string | null) {
    const item = await this.getEditable(id)
    const data: Prisma.ScheduledNotificationUpdateInput = { editedAt: new Date(), editedBy: adminId || null }
    if (input.title !== undefined) {
      const title = String(input.title).replace(/\s+/g, ' ').trim()
      if (!title) throw new BadRequestException('O título não pode ficar vazio.')
      if (title.length > 80) throw new BadRequestException('O título passa de 80 caracteres; no celular ele é cortado.')
      data.title = title
    }
    if (input.body !== undefined) {
      const body = String(input.body).replace(/\s+/g, ' ').trim()
      if (!body) throw new BadRequestException('O texto não pode ficar vazio.')
      if (body.length > 180) throw new BadRequestException('O texto passa de 180 caracteres; no celular ele é cortado.')
      data.body = body
    }
    if (input.url !== undefined) {
      const url = input.url ? String(input.url).trim() : null
      // So destino dentro da loja: caminho relativo ou o proprio dominio.
      if (url && !/^\/[^\s]*$/.test(url) && !/^https:\/\/(mercado\.)?antenorefilhos\.com\.br(\/[^\s]*)?$/.test(url)) {
        throw new BadRequestException('O destino precisa ser uma página da loja (ex.: /promocoes).')
      }
      data.url = url
    }
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ? String(input.imageUrl) : null
    if (input.sendAt !== undefined) {
      const at = new Date(input.sendAt)
      if (Number.isNaN(at.getTime())) throw new BadRequestException('Data e hora inválidas.')
      if (at.getTime() < Date.now() - 60_000) throw new BadRequestException('Escolha um horário daqui para frente (ou use "Enviar agora").')
      if (item.expiresAt && at.getTime() > item.expiresAt.getTime()) {
        const limit = item.expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        throw new BadRequestException(`Esse aviso só faz sentido até ${limit} (depois disso a oferta já saiu do site).`)
      }
      data.sendAt = at
    }
    await this.prisma.scheduledNotification.update({ where: { id }, data })
    return { ok: true }
  }

  async approve(id: string, adminId?: string | null) {
    const r = await this.prisma.scheduledNotification.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: { status: 'SCHEDULED', approvedAt: new Date(), approvedBy: adminId || null },
    })
    if (!r.count) throw new BadRequestException('Esse envio não está esperando aprovação.')
    return { ok: true }
  }

  async cancel(id: string, adminId?: string | null) {
    const r = await this.prisma.scheduledNotification.updateMany({
      where: { id, status: { in: EDITABLE } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: adminId || null, note: 'Cancelado no admin.' },
    })
    if (!r.count) throw new BadRequestException('Esse envio já saiu ou já estava encerrado.')
    return { ok: true }
  }

  async restore(id: string, adminId?: string | null) {
    const item = await this.prisma.scheduledNotification.findUnique({ where: { id } })
    if (!item || item.status !== 'CANCELLED') throw new BadRequestException('Só dá para restaurar um envio cancelado.')
    const now = new Date()
    if (item.expiresAt && item.expiresAt.getTime() <= now.getTime()) throw new BadRequestException('Passou do horário-limite desse aviso; não dá mais para restaurar.')
    const settings = await this.prisma.autoOfferSettings.findUnique({ where: { id: 'singleton' } })
    const needsApproval =
      (item.origin.startsWith('ENCARTE') && settings?.encarteApproval) || (item.origin === 'OFERTA' && settings?.offerApproval) || (item.origin === 'CARRINHO' && settings?.cartApproval)
    await this.prisma.scheduledNotification.update({
      where: { id },
      data: {
        status: needsApproval ? 'PENDING_APPROVAL' : 'SCHEDULED',
        sendAt: item.sendAt.getTime() < now.getTime() ? now : item.sendAt,
        cancelledAt: null,
        cancelledBy: null,
        note: null,
        // Restaurado a mao: o planejador nao deve mexer de novo no conteudo.
        editedAt: now,
        editedBy: adminId || null,
      },
    })
    return { ok: true }
  }

  /** Manda agora, mesmo com a loja fechada -- acao explicita do admin. */
  async sendNow(id: string, adminId?: string | null) {
    const item = await this.getEditable(id)
    if (item.expiresAt && item.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Passou do horário-limite desse aviso.')
    await this.prisma.scheduledNotification.update({
      where: { id },
      data: {
        status: 'SCHEDULED',
        sendAt: new Date(),
        ...(item.status === 'PENDING_APPROVAL' ? { approvedAt: new Date(), approvedBy: adminId || null } : {}),
      },
    })
    const sent = await this.notifications.dispatchQueueItem(id)
    const after = await this.prisma.scheduledNotification.findUnique({ where: { id }, select: { status: true, note: true, sentCount: true } })
    return { sent, ...after }
  }

  async retry(id: string) {
    const r = await this.prisma.scheduledNotification.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'SCHEDULED', sendAt: new Date(), note: null } })
    if (!r.count) throw new BadRequestException('Só dá para tentar de novo um envio que falhou.')
    await this.notifications.dispatchQueueItem(id)
    return { ok: true }
  }

  async updateSettings(input: QueueSettingsInput) {
    const data: Prisma.AutoOfferSettingsUpdateInput = {}
    if (input.encarteEnabled !== undefined) data.encarteEnabled = Boolean(input.encarteEnabled)
    if (input.encarteApproval !== undefined) data.encarteApproval = Boolean(input.encarteApproval)
    if (input.offerEnabled !== undefined) data.enabled = Boolean(input.offerEnabled)
    if (input.offerApproval !== undefined) data.offerApproval = Boolean(input.offerApproval)
    if (input.cartEnabled !== undefined) data.cartEnabled = Boolean(input.cartEnabled)
    if (input.cartApproval !== undefined) data.cartApproval = Boolean(input.cartApproval)
    if (input.cartImage !== undefined) data.cartImage = Boolean(input.cartImage)
    if (input.cartDelayMinutes !== undefined) {
      const m = Math.round(Number(input.cartDelayMinutes))
      if (!Number.isFinite(m) || m < 30 || m > 48 * 60) throw new BadRequestException('A espera do lembrete vai de 30 minutos a 48 horas.')
      data.cartDelayMinutes = m
    }
    if (input.cartMinTotal !== undefined) {
      const v = Number(input.cartMinTotal)
      if (!Number.isFinite(v) || v < 0 || v > 5000) throw new BadRequestException('Valor mínimo inválido.')
      data.cartMinTotal = Math.round(v * 100) / 100
    }
    if (input.cartCooldownDays !== undefined) {
      const d = Math.round(Number(input.cartCooldownDays))
      if (!Number.isFinite(d) || d < 0 || d > 30) throw new BadRequestException('O intervalo entre lembretes vai de 0 a 30 dias.')
      data.cartCooldownDays = d
    }
    for (const [key, max] of [['cartTitle', 80], ['cartBody', 180]] as const) {
      if (input[key] === undefined) continue
      const text = String(input[key]).replace(/\s+/g, ' ').trim()
      if (!text) throw new BadRequestException(key === 'cartTitle' ? 'O título não pode ficar vazio.' : 'O texto não pode ficar vazio.')
      if (text.length > max) throw new BadRequestException(`${key === 'cartTitle' ? 'Título' : 'Texto'} passa de ${max} caracteres.`)
      data[key] = text
    }
    await this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...(data as object) } })

    // Mudou a exigencia de aprovacao: o que ja esta na fila segue a regra nova
    // (aprovado a mao continua aprovado).
    const flip = async (origins: string[], approval: boolean | undefined) => {
      if (approval === undefined) return
      await this.prisma.scheduledNotification.updateMany({
        where: approval ? { origin: { in: origins }, status: 'SCHEDULED', approvedAt: null } : { origin: { in: origins }, status: 'PENDING_APPROVAL' },
        data: { status: approval ? 'PENDING_APPROVAL' : 'SCHEDULED' },
      })
    }
    await flip(['ENCARTE_INICIO', 'ENCARTE_FIM'], input.encarteApproval)
    await flip(['OFERTA'], input.offerApproval)
    await flip(['CARRINHO'], input.cartApproval)
    await this.refreshPlans()
    return this.list()
  }
}
