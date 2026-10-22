import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { addressKey, deviceKey, type DeviceContext, isDisposableEmail, mask, normalizeEmail } from './fraud.util'

// Antifraude (01/10/2026). Modelo da loja: o cliente paga na entrega ou na
// retirada, entao o risco nao e cartao roubado -- e (1) a mesma pessoa abrir
// contas para repetir beneficio de primeira compra e (2) pedido de trote, que
// gasta separacao e viagem. O grafo de identidade liga contas da mesma pessoa;
// a nota de risco avisa a equipe antes de separar. Nada aqui depende de
// servico pago: aparelho, impressao digital, rede, e-mail, endereco e historico.

const VALID = { status: { notIn: ['CANCELLED', 'REFUNDED'] } }
/** Liga contas com seguranca. Impressao digital sozinha colide (iPhone do mesmo modelo), so conta junto da rede (DEVICE_KEY). */
const STRONG_KINDS = ['DEVICE', 'DEVICE_KEY', 'EMAIL']
const KIND_LABEL: Record<string, string> = { DEVICE: 'aparelho', DEVICE_KEY: 'aparelho e rede', EMAIL: 'e-mail' }
const IDENT_PT: Record<string, string> = { CPF: 'CPF', WHATSAPP: 'WhatsApp', EMAIL: 'e-mail', DEVICE: 'aparelho', DEVICE_KEY: 'aparelho/rede' }
const maskIfPersonal = (kind: string, value: string) => (kind === 'CPF' || kind === 'WHATSAPP' ? mask(value, kind === 'CPF' ? 3 : 4) : value)
const whenBR = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Escalonamento automatico de bloqueio (21/10/2026). Telemetria real checada
 * antes de inventar numero: `fraud_logs` nunca registrou um "BLOCKED" em
 * producao e `fraud_blocks` nunca teve uma linha -- ou seja, zero abuso
 * documentado pra calibrar limiar estatistico. Por isso os dois gatilhos
 * abaixo NAO sao numero novo chutado:
 *
 * - Reincidencia: identidade ja bloqueada tentando de novo e prova direta,
 *   nao estatistica -- basta 1 ocorrencia pra bloquear o aparelho dela.
 * - Velocidade: reaproveita o limiar que a nota de risco ja usa desde
 *   01/10/2026 ("3 ou mais contas no mesmo aparelho em 7 dias", +30 pontos,
 *   visivel em "Como a nota e calculada" na tela Antifraude) -- o Jonathan
 *   ja validou esse numero implicitamente ao aceitar o calculo de risco.
 *   So promove de "soma ponto" para "bloqueia o aparelho".
 *
 * Prazo mais curto na velocidade (sinal mais fraco -- o maior cluster real
 * visto em produção foi 2 contas no mesmo aparelho ao longo de meses,
 * provavelmente família) do que na reincidencia (sinal direto, aparelho
 * comprovadamente ligado a quem ja esta bloqueado). Os dois sao revertiveis
 * a qualquer momento na tela Antifraude, e nunca sobrescrevem bloqueio
 * manual existente.
 */
const ESCALATION_REINCIDENCE_DAYS = 30
const ESCALATION_VELOCITY_DAYS = 15
const ESCALATION_VELOCITY_THRESHOLD = 3

export type RiskAssessment = { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[] }
export type LinkedCustomer = { customerId: string; via: string[] }
export type BlockMatch = { reason: string; kind: string; value: string }

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grava o que identifica o cliente (cadastro, login, pedido). Nunca derruba o fluxo. */
  async recordSignals(tenantId: string, customerId: string, ctx: DeviceContext, email?: string | null) {
    const pairs: Array<[string, string]> = []
    if (ctx.deviceId) pairs.push(['DEVICE', ctx.deviceId])
    if (ctx.fingerprint) pairs.push(['FINGERPRINT', ctx.fingerprint])
    const key = deviceKey(ctx)
    if (key) pairs.push(['DEVICE_KEY', key])
    if (ctx.ip) pairs.push(['IP', ctx.ip])
    const mail = normalizeEmail(email)
    if (mail) pairs.push(['EMAIL', mail])
    await Promise.all(
      pairs.map(([kind, value]) =>
        this.prisma.identitySignal
          .upsert({
            where: { tenantId_customerId_kind_value: { tenantId, customerId, kind, value } },
            create: { tenantId, customerId, kind, value },
            update: { lastSeen: new Date(), hits: { increment: 1 } },
          })
          .catch(() => null),
      ),
    )
  }

  /** Outras contas da mesma pessoa: mesmo aparelho, mesma impressao digital na mesma rede ou mesma caixa de e-mail. */
  async linkedCustomers(tenantId: string, customerId: string): Promise<LinkedCustomer[]> {
    const mine = await this.prisma.identitySignal.findMany({
      where: { tenantId, customerId, kind: { in: STRONG_KINDS } },
      select: { kind: true, value: true },
    })
    if (!mine.length) return []
    const others = await this.prisma.identitySignal.findMany({
      where: { tenantId, customerId: { not: customerId }, OR: mine.map((s) => ({ kind: s.kind, value: s.value })) },
      select: { customerId: true, kind: true },
    })
    const byCustomer = new Map<string, Set<string>>()
    for (const o of others) byCustomer.set(o.customerId, (byCustomer.get(o.customerId) || new Set()).add(KIND_LABEL[o.kind] || o.kind))
    return [...byCustomer].map(([id, via]) => ({ customerId: id, via: [...via] }))
  }

  /** Outros cadastros no mesmo endereco (CEP + rua + numero normalizados). Familia e legitima: so pesa em beneficio. */
  async householdCustomers(tenantId: string, customerId: string, addressId?: string | null): Promise<string[]> {
    const mine = addressId
      ? await this.prisma.address.findMany({ where: { id: addressId, customerId } })
      : await this.prisma.address.findMany({ where: { tenantId, customerId } })
    const keys = new Set(mine.map(addressKey).filter((k): k is string => Boolean(k)))
    if (!keys.size) return []
    const ceps = [...new Set(mine.map((a) => String(a.zipCode || '').replace(/\D/g, '')).filter((c) => c.length === 8))]
    const candidates = await this.prisma.address.findMany({
      where: { tenantId, customerId: { not: customerId }, zipCode: { in: ceps.flatMap((c) => [c, `${c.slice(0, 5)}-${c.slice(5)}`]) } },
      select: { customerId: true, zipCode: true, street: true, number: true },
    })
    return [...new Set(candidates.filter((a) => keys.has(addressKey(a) || '')).map((a) => a.customerId))]
  }

  /**
   * Beneficio de primeira compra vale por PESSOA, nao por conta (01/10/2026).
   * Antes: so o customerId -- conta nova (outro CPF e telefone) no mesmo
   * aparelho repetia o BEMVINDO quantas vezes quisesse.
   */
  async firstPurchase(tenantId: string, customerId: string, addressId?: string | null): Promise<{ eligible: boolean; reason?: string }> {
    if (await this.prisma.order.count({ where: { tenantId, customerId, ...VALID } })) {
      return { eligible: false, reason: 'Esse cupom é só para a primeira compra.' }
    }
    const linked = await this.linkedCustomers(tenantId, customerId)
    if (linked.length && (await this.prisma.order.count({ where: { tenantId, customerId: { in: linked.map((l) => l.customerId) }, ...VALID } }))) {
      return { eligible: false, reason: 'Esse cupom é só para a primeira compra, e este aparelho ou e-mail já comprou em outra conta.' }
    }
    const household = await this.householdCustomers(tenantId, customerId, addressId)
    if (household.length && (await this.prisma.order.count({ where: { tenantId, customerId: { in: household }, ...VALID } }))) {
      return { eligible: false, reason: 'Esse cupom é só para a primeira compra, e este endereço já recebeu pedido de outro cadastro.' }
    }
    return { eligible: true }
  }

  /**
   * Evento para a tela Antifraude; nao repete o mesmo evento do mesmo cliente
   * em 10 min (o checkout recalcula varias vezes). `details` guarda o que foi
   * tentado de fato (16/10/2026) -- sem isso, o evento so dizia "alguem
   * tentou" e nunca QUEM nem COM QUAL identificador/aparelho.
   *
   * `ctx` (21/10/2026): quando o evento e 'BLOCKED', e o aparelho da
   * tentativa ainda nao esta bloqueado, bloqueia ele sozinho -- ver
   * `escalateReincidence`. So entra aqui, nunca no cadastro/login ou pedido
   * em si, pra nao duplicar a logica de quando escalar em dois lugares.
   */
  async logEvent(tenantId: string, vector: string, value: string, customerId?: string | null, orderId?: string | null, details?: Record<string, unknown> | null, ctx?: DeviceContext | null) {
    if (customerId) {
      const recent = await this.prisma.fraudLog.findFirst({ where: { tenantId, vector, customerId, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } }, select: { id: true } })
      if (recent) return
    }
    const safeDetails = details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined
    await this.prisma.fraudLog.create({ data: { tenantId, vector, value, customerId: customerId || null, orderId: orderId || null, details: safeDetails } }).catch(() => null)
    if (vector === 'BLOCKED' && ctx) await this.escalateReincidence(tenantId, ctx, details).catch(() => null)
  }

  /** So cria se nao existir bloqueio nenhum pro par kind/value -- nunca sobrescreve bloqueio manual (ou automatico) ja existente. */
  private async createAutoBlock(tenantId: string, kind: string, value: string, reason: string, days: number) {
    const exists = await this.prisma.fraudBlock.findUnique({ where: { tenantId_kind_value: { tenantId, kind, value } }, select: { id: true } })
    if (exists) return
    await this.prisma.fraudBlock
      .create({ data: { tenantId, kind, value, reason, automatic: true, expiresAt: new Date(Date.now() + days * 86_400_000) } })
      .catch(() => null)
  }

  /**
   * Tentativa bloqueada de novo (16/10/2026 registra; 21/10/2026 escala):
   * quem fez a tentativa ja tem identidade bloqueada, e isso e prova direta
   * -- nao precisa de volume pra agir, trava o aparelho na hora.
   */
  private async escalateReincidence(tenantId: string, ctx: DeviceContext, details?: Record<string, unknown> | null) {
    const key = deviceKey(ctx)
    const targets: Array<[string, string]> = []
    if (ctx.deviceId) targets.push(['DEVICE', ctx.deviceId])
    if (key) targets.push(['DEVICE_KEY', key])
    if (!targets.length) return
    const matchedKind = details?.matchedKind ? String(details.matchedKind) : null
    const matchedValue = details?.matchedValue ? String(details.matchedValue) : null
    const quem = matchedKind && matchedValue ? `${IDENT_PT[matchedKind] || matchedKind} bloqueado ${maskIfPersonal(matchedKind, matchedValue)}` : 'identidade já bloqueada'
    const reason = `Automático: aparelho usado por ${quem} tentou de novo em ${whenBR(new Date())}.`
    for (const [kind, value] of targets) await this.createAutoBlock(tenantId, kind, value, reason, ESCALATION_REINCIDENCE_DAYS)
  }

  /**
   * 3+ contas novas no mesmo aparelho em 7 dias (mesmo limiar da nota de
   * risco, ja validado em producao desde 01/10/2026 -- ver comentario grande
   * acima de `ESCALATION_VELOCITY_DAYS`).
   */
  private async escalateVelocity(tenantId: string, ctx: DeviceContext, accountsOnDevice: number) {
    if (!ctx.deviceId) return
    const reason = `Automático: ${accountsOnDevice} contas diferentes usaram este aparelho em 7 dias (limite de ${ESCALATION_VELOCITY_THRESHOLD}) em ${whenBR(new Date())}.`
    const key = deviceKey(ctx)
    await this.createAutoBlock(tenantId, 'DEVICE', ctx.deviceId, reason, ESCALATION_VELOCITY_DAYS)
    if (key) await this.createAutoBlock(tenantId, 'DEVICE_KEY', key, reason, ESCALATION_VELOCITY_DAYS)
  }

  /** Remove um bloqueio pelo id (21/10/2026): o automatico nao tem cliente pra usar `setCustomerBlocked`. */
  async removeBlock(tenantId: string, id: string) {
    const res = await this.prisma.fraudBlock.deleteMany({ where: { id, tenantId } })
    return { ok: res.count > 0 }
  }

  /** Identificador bloqueado pelo admin (CPF, WhatsApp, e-mail ou aparelho). Devolve o motivo e QUAL identificador bateu, ou null. */
  async blockedReason(tenantId: string, ids: { cpf?: string | null; whatsapp?: string | null; email?: string | null }, ctx?: DeviceContext | null): Promise<BlockMatch | null> {
    const or: Array<{ kind: string; value: string }> = []
    if (ids.cpf) or.push({ kind: 'CPF', value: String(ids.cpf).replace(/\D/g, '') })
    if (ids.whatsapp) or.push({ kind: 'WHATSAPP', value: String(ids.whatsapp).replace(/\D/g, '') })
    const mail = normalizeEmail(ids.email)
    if (mail) or.push({ kind: 'EMAIL', value: mail })
    if (ctx?.deviceId) or.push({ kind: 'DEVICE', value: ctx.deviceId })
    const key = ctx ? deviceKey(ctx) : null
    if (key) or.push({ kind: 'DEVICE_KEY', value: key })
    if (!or.length) return null
    const hit = await this.prisma.fraudBlock.findFirst({ where: { tenantId, OR: or }, select: { reason: true, kind: true, value: true } })
    return hit ? { reason: hit.reason || 'bloqueado', kind: hit.kind, value: hit.value } : null
  }

  /**
   * Suspende o cliente e bloqueia o que identifica a pessoa: CPF, WhatsApp,
   * e-mail e os aparelhos ja vistos. Conta nova com qualquer um deles nao passa.
   */
  async setCustomerBlocked(tenantId: string, customerId: string, blocked: boolean, reason?: string | null, adminId?: string | null) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!customer) return null
    if (!blocked) {
      await this.prisma.fraudBlock.deleteMany({ where: { tenantId, customerId } })
    } else {
      const devices = await this.prisma.identitySignal.findMany({ where: { tenantId, customerId, kind: { in: ['DEVICE', 'DEVICE_KEY'] } }, select: { kind: true, value: true } })
      const mail = normalizeEmail(customer.email)
      const rows = [
        { kind: 'CPF', value: customer.cpf },
        { kind: 'WHATSAPP', value: customer.whatsapp },
        ...(mail ? [{ kind: 'EMAIL', value: mail }] : []),
        ...devices,
      ]
      for (const r of rows) {
        await this.prisma.fraudBlock
          .upsert({
            where: { tenantId_kind_value: { tenantId, kind: r.kind, value: r.value } },
            create: { tenantId, kind: r.kind, value: r.value, reason: reason || null, customerId, createdBy: adminId || null },
            update: { reason: reason || null, customerId, createdBy: adminId || null },
          })
          .catch(() => null)
      }
    }
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { blocked, blockedReason: blocked ? reason?.trim() || null : null },
      select: { id: true, name: true, blocked: true, blockedReason: true },
    })
  }

  /**
   * Nota de risco do pedido, com motivos legiveis. Nao bloqueia: HIGH vira
   * "ligar para o cliente antes de separar" na separacao e no admin.
   */
  async assessOrder(input: { tenantId: string; customerId: string; ctx: DeviceContext; total: number }): Promise<RiskAssessment> {
    const { tenantId, customerId, ctx, total } = input
    const points: Array<[number, string]> = []
    if (ctx.automation) points.push([60, 'Navegador automatizado (robô)'])
    if (ctx.country && ctx.country !== 'BR') points.push([30, `Acesso de fora do Brasil (${ctx.country})`])

    const [customer, previous, linked] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { createdAt: true, email: true } }),
      this.prisma.order.count({ where: { tenantId, customerId, ...VALID } }),
      this.linkedCustomers(tenantId, customerId),
    ])
    const ageHours = customer ? (Date.now() - customer.createdAt.getTime()) / 3_600_000 : Infinity
    if (previous === 0 && ageHours < 24) {
      if (total >= 600) points.push([40, `Conta criada hoje, primeiro pedido de R$ ${total.toFixed(2).replace('.', ',')}`])
      else if (total >= 300) points.push([20, `Conta criada hoje, primeiro pedido de R$ ${total.toFixed(2).replace('.', ',')}`])
    }
    if (isDisposableEmail(customer?.email)) points.push([15, 'E-mail descartável'])
    if (linked.length) {
      const via = [...new Set(linked.flatMap((l) => l.via))].join(', ')
      points.push([Math.min(40, 15 * linked.length), `Mesmo ${via} de ${linked.length} outra(s) conta(s)`])
    }

    const since7d = new Date(Date.now() - 7 * 86_400_000)
    const [accountsOnDevice, failedDeliveries, burst] = await Promise.all([
      ctx.deviceId
        ? this.prisma.identitySignal.count({ where: { tenantId, kind: 'DEVICE', value: ctx.deviceId, firstSeen: { gte: since7d } } })
        : Promise.resolve(0),
      this.prisma.deliveryStop.count({ where: { status: 'FAILED', order: { customerId: { in: [customerId, ...linked.map((l) => l.customerId)] } } } }),
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
          OR: [{ customerId }, ...(ctx.deviceId ? [{ deviceId: ctx.deviceId }] : [])],
        },
      }),
    ])
    if (accountsOnDevice >= ESCALATION_VELOCITY_THRESHOLD) {
      points.push([30, `${accountsOnDevice} contas usaram este aparelho em 7 dias`])
      await this.escalateVelocity(tenantId, ctx, accountsOnDevice).catch(() => null)
    }
    if (failedDeliveries) points.push([Math.min(60, 35 * failedDeliveries), `${failedDeliveries} entrega(s) frustrada(s) antes`])
    if (burst >= 2) points.push([30, `${burst + 1} pedidos em 10 minutos`])

    const score = Math.min(100, points.reduce((a, [p]) => a + p, 0))
    return {
      score,
      level: score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW',
      reasons: points.sort((a, b) => b[0] - a[0]).map(([, r]) => r),
    }
  }
}
