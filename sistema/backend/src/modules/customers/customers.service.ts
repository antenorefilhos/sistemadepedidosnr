import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { IntegrationsService } from '../integrations/integrations.service'

type UpdateCustomerDto = Partial<CreateCustomerDto>

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora, mesmo padrao do fluxo de auth

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name)

  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
  ) {}

  async findAll(search?: string) {
    const customers = search
      ? await this.prisma.customer.findMany({
          where: {
            OR: [
              { name: { contains: search } },
              { cpf: { contains: search } },
              { whatsapp: { contains: search } },
            ],
          },
          include: { addresses: true },
        })
      : await this.prisma.customer.findMany({
          include: { addresses: true },
          orderBy: { createdAt: 'desc' },
        })

    return this.withPushInfo(customers)
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

  async findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: { addresses: true },
    })
  }

  async findByCPF(cpf: string) {
    return this.prisma.customer.findUnique({
      where: { cpf },
      include: { addresses: true },
    })
  }

  async create(createCustomerDto: CreateCustomerDto) {
    // Check if customer already exists by CPF or whatsapp
    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { cpf: createCustomerDto.cpf },
          { whatsapp: createCustomerDto.whatsapp },
        ],
      },
    })

    if (existing) {
      return existing
    }

    const customer = await this.prisma.customer.create({
      data: createCustomerDto,
    })

    if (this.integrations) {
      this.integrations.syncCrmContact(customer.id).catch((err: Error) => {
        this.logger.warn(`Falha ao sincronizar cliente ${customer.id} com CRM: ${err.message}`)
      })
    }

    return customer
  }

  async update(id: string, data: UpdateCustomerDto) {
    return this.prisma.customer.update({
      where: { id },
      data,
      include: { addresses: true },
    })
  }

  async remove(id: string) {
    return this.prisma.customer.delete({
      where: { id },
    })
  }

  async setBlocked(id: string, blocked: boolean, reason?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
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
  async generateResetLink(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
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
  async getOriginAnalytics() {
    const customers = await this.prisma.customer.findMany({
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
