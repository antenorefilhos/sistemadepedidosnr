import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { IntegrationsService } from '../integrations/integrations.service'

type UpdateCustomerDto = Partial<CreateCustomerDto>

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name)

  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
  ) {}

  async findAll(search?: string) {
    if (search) {
      return this.prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { cpf: { contains: search } },
            { whatsapp: { contains: search } },
          ],
        },
        include: { addresses: true },
      })
    }

    return this.prisma.customer.findMany({
      include: { addresses: true },
      orderBy: { createdAt: 'desc' },
    })
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
