import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

export interface CreateAddressPayload {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault?: boolean
}

const DEFAULT_KEYS = ['street', 'number', 'neighborhood', 'zipCode'] as const

/** Normaliza um valor de endereco pra comparacao de igualdade (desconsidera
 * caixa e espacos sobrando, inclusive duplicados no meio). */
function normalize(value?: string | null): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async list(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  }

  private async findOwned(customerId: string, addressId: string, tx?: any) {
    const address = await (tx || this.prisma).address.findFirst({
      where: { id: addressId, customerId },
    })
    if (!address) throw new NotFoundException('Endereco nao encontrado.')
    return address
  }

  async create(customerId: string, data: CreateAddressPayload) {
    return this.prisma.$transaction(async (tx) => {
      // Reaproveita registro duplicado: mesmo cliente, mesma rua, numero,
      // bairro e CEP (ignorando caixa e espacos sobrando) -> atualiza o
      // existente (e o torna default se pedido) em vez de criar linhas
      // repetidas (ex.: a mesma 'Estrada Uniao e Industria, 22099' gravada
      // dezenas de vezes). A comparacao roda em memoria porque colapsar
      // espacos internos nao da pra expressar em uma query `equals`.
      const existing = (await tx.address.findMany({ where: { customerId } })).find((candidate) => {
        return (
          normalize(candidate.street) === normalize(data.street) &&
          normalize(candidate.number) === normalize(data.number) &&
          normalize(candidate.neighborhood) === normalize(data.neighborhood) &&
          normalize(candidate.zipCode) === normalize(data.zipCode)
        )
      })

      if (existing) {
        const patch: Record<string, unknown> = {
          complement: data.complement ?? existing.complement,
          city: data.city || existing.city,
          state: data.state || existing.state,
        }
        if (data.isDefault) {
          await tx.address.updateMany({
            where: { customerId, isDefault: true, id: { not: existing.id } },
            data: { isDefault: false },
          })
          patch.isDefault = true
        }
        return tx.address.update({ where: { id: existing.id }, data: patch })
      }

      if (data.isDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.address.create({
        data: {
          ...data,
          customerId,
        },
      })
    })
  }

  async update(customerId: string, addressId: string, data: Partial<CreateAddressPayload>) {
    return this.prisma.$transaction(async (tx) => {
      await this.findOwned(customerId, addressId, tx)

      const patch: Record<string, any> = {}
      if (data.street !== undefined) patch.street = data.street
      if (data.number !== undefined) patch.number = data.number
      if (data.complement !== undefined) patch.complement = data.complement
      if (data.neighborhood !== undefined) patch.neighborhood = data.neighborhood
      if (data.city !== undefined) patch.city = data.city
      if (data.state !== undefined) patch.state = data.state
      if (data.zipCode !== undefined) patch.zipCode = data.zipCode

      if (data.isDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        })
        patch.isDefault = true
      }

      return tx.address.update({
        where: { id: addressId },
        data: patch,
      })
    })
  }

  async delete(customerId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      const address = await this.findOwned(customerId, addressId, tx)

      await tx.address.delete({ where: { id: addressId } })

      // Se era o padrao, promove o mais recente restante a padrao.
      if (address.isDefault) {
        const remaining = await tx.address.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        })
        if (remaining) {
          await tx.address.update({
            where: { id: remaining.id },
            data: { isDefault: true },
          })
        }
      }

      return { id: addressId }
    })
  }

  async setDefault(customerId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.findOwned(customerId, addressId, tx)
      await tx.address.updateMany({
        where: { customerId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      })
      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      })
    })
  }
}
