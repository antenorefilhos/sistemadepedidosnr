import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { IntegrationsService } from '../integrations/integrations.service'
import { TenantContext } from '../../common/tenant/tenant-context'

// JON-142 (Auditoria 360, High): nenhum metodo aqui filtrava por tenant --
// admin de UM tenant listava/editava/bloqueava/apagava cliente de OUTRO
// tenant so por adivinhar o id. tenantId no `data` de create/update tambem
// vinha do body, entao o proprio chamador escolhia o tenant do registro.
type TenantScope = Pick<TenantContext, 'tenantId'>

type UpdateCustomerDto = Partial<CreateCustomerDto>

// Campos sensiveis que nunca podem sair pra tela do admin: hash de senha e
// token de reset. Ate 10/09/2026 findAll/findOne devolviam o registro cru e
// o /api/customers vazava o hash de TODOS os clientes pro navegador.
// Strip pos-query (em vez de `select`) pra que campo sensivel novo no model
// tambem caia aqui sem alguem lembrar de listar.
function stripSecrets<T extends Record<string, unknown>>(customer: T): T {
  const { password, resetTokenHash, resetTokenExpiresAt, ...safe } = customer
  return safe as unknown as T
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora, mesmo padrao do fluxo de auth

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name)

  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
  ) {}

  // JON-44 (Auditoria 360, Medium): sem take/skip, o payload e o groupBy de
  // push abaixo crescem sem limite com o cadastro -- cap defensivo evita que
  // a tela (e a memoria da API) travem quando a loja passar de algumas
  // centenas de clientes. Paginacao completa no admin (page/cursor na UI)
  // fica como evolucao incremental do Dashboard.tsx, fora de escopo aqui.
  private static readonly MAX_CUSTOMERS = 500

  async findAll(scope: TenantScope, search?: string, limit = CustomersService.MAX_CUSTOMERS) {
    const take = Math.min(Math.max(1, limit), CustomersService.MAX_CUSTOMERS)
    const customers = search
      ? await this.prisma.customer.findMany({
          where: {
            tenantId: scope.tenantId,
            OR: [
              { name: { contains: search } },
              { cpf: { contains: search } },
              { whatsapp: { contains: search } },
            ],
          },
          include: { addresses: true },
          orderBy: { createdAt: 'desc' },
          take,
        })
      : await this.prisma.customer.findMany({
          where: { tenantId: scope.tenantId },
          include: { addresses: true },
          orderBy: { createdAt: 'desc' },
          take,
        })

    return this.withPushInfo(customers.map(stripSecrets))
  }

  /**
   * Anexa a cada cliente quantos aparelhos dele aceitam notificacao push.
   *
   * Responde uma pergunta operacional que a lista nao respondia: antes de
   * disparar um broadcast, quem de fato recebe? Em 28/08/2026 a resposta era
   * "ninguem" -- zero assinaturas, e nao havia como saber isso sem consultar o
   * banco na mao.
   *
   * `PushSubscription` nao tem relacao Prisma com `Customer` (so um `customerId`
   * indexado), entao nao da pra usar `_count`/`include` -- e um groupBy a parte,
   * de proposito: criar a relacao agora exigiria migration com FK, e o ganho
   * seria so sintatico.
   *
   * Uma assinatura por aparelho/navegador: o mesmo cliente no celular e no PC
   * conta 2. Por isso o campo e contagem, nao booleano.
   */
  private async withPushInfo<T extends { id: string }>(customers: T[]) {
    if (customers.length === 0) return []

    const grouped = await this.prisma.pushSubscription.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customers.map((c) => c.id) } },
      _count: { _all: true },
    })
    const porCliente = new Map(grouped.map((g) => [g.customerId, g._count._all]))

    return customers.map((customer) => ({
      ...customer,
      pushSubscriptionCount: porCliente.get(customer.id) ?? 0,
      pushEnabled: (porCliente.get(customer.id) ?? 0) > 0,
    }))
  }

  async findOne(id: string, scope: TenantScope) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: scope.tenantId },
      include: { addresses: true },
    })
    return customer ? stripSecrets(customer) : customer
  }

  async findByCPF(cpf: string, scope: TenantScope) {
    const customer = await this.prisma.customer.findFirst({
      where: { cpf, tenantId: scope.tenantId },
      include: { addresses: true },
    })
    return customer ? stripSecrets(customer) : customer
  }

  async create(createCustomerDto: CreateCustomerDto, scope: TenantScope) {
    // Check if customer already exists by CPF or whatsapp, dentro do MESMO
    // tenant -- CPF/whatsapp repetido em tenant diferente e cliente distinto.
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId: scope.tenantId,
        OR: [
          { cpf: createCustomerDto.cpf },
          { whatsapp: createCustomerDto.whatsapp },
        ],
      },
    })

    if (existing) {
      return existing
    }

    // tenantId sempre vem do contexto autenticado, nunca do body: senao o
    // proprio chamador escolhe em qual tenant o cliente nasce.
    const customer = await this.prisma.customer.create({
      data: { ...createCustomerDto, tenantId: scope.tenantId },
    })

    if (this.integrations) {
      this.integrations.syncCrmContact(customer.id).catch((err: Error) => {
        this.logger.warn(`Falha ao sincronizar cliente ${customer.id} com CRM: ${err.message}`)
      })
    }

    return customer
  }

  async update(id: string, data: UpdateCustomerDto, scope: TenantScope) {
    const { tenantId: _ignoredTenantId, ...safeData } = data as UpdateCustomerDto & { tenantId?: string }
    const result = await this.prisma.customer.updateMany({
      where: { id, tenantId: scope.tenantId },
      data: safeData,
    })
    if (result.count === 0) throw new NotFoundException('Cliente nao encontrado')
    return this.prisma.customer.findFirst({ where: { id, tenantId: scope.tenantId }, include: { addresses: true } })
  }

  async remove(id: string, scope: TenantScope) {
    const result = await this.prisma.customer.deleteMany({ where: { id, tenantId: scope.tenantId } })
    if (result.count === 0) throw new NotFoundException('Cliente nao encontrado')
    return { id }
  }

  async setBlocked(id: string, blocked: boolean, scope: TenantScope, reason?: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: scope.tenantId } })
    if (!customer) throw new NotFoundException('Cliente nao encontrado')

    return this.prisma.customer.update({
      where: { id },
      data: { blocked, blockedReason: blocked ? (reason?.trim() || null) : null },
      select: { id: true, name: true, blocked: true, blockedReason: true },
    })
  }

  /**
   * Gera link de redefinicao de senha sob demanda do admin -- mesmo padrao
   * (hash sha256 do token, TTL de 1h) do auth.service.ts, mas devolve a URL
   * pra quem chamou em vez de mandar e-mail sozinho: cliente de checkout
   * convidado pode nao ter e-mail cadastrado, so WhatsApp, entao o admin
   * decide o canal (copiar, WhatsApp ou e-mail) na hora.
   */
  async generateResetLink(id: string, scope: TenantScope) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: scope.tenantId } })
    if (!customer) throw new NotFoundException('Cliente nao encontrado')

    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await this.prisma.customer.update({
      where: { id },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    })

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    return { resetUrl: `${frontendUrl}/redefinir-senha?token=${token}`, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) }
  }

  /** Phase 17 – Canal de aquisição de clientes */
  async getOriginAnalytics(scope: TenantScope) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId: scope.tenantId },
      select: { origin: true },
    })

    const map = new Map<string, number>()
    for (const c of customers) {
      const key = c.origin?.toLowerCase().trim() || 'outro'
      map.set(key, (map.get(key) || 0) + 1)
    }

    return [...map.entries()]
      .map(([origin, count]) => ({ origin, count }))
      .sort((a, b) => b.count - a.count)
  }
}
