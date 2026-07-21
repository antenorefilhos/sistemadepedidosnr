import { Injectable } from '@nestjs/common'
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

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async create(customerId: string, data: CreateAddressPayload) {
    return this.prisma.$transaction(async (tx) => {
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
}
