import { Module } from '@nestjs/common'
import { AddressesService } from './addresses.service'
import { AddressesController } from './addresses.controller'
import { ViaCEPService } from '../../common/services/via-cep.service'
import { PrismaService } from '../../common/prisma.service'

@Module({
  controllers: [AddressesController],
  providers: [AddressesService, ViaCEPService, PrismaService],
})
export class AddressesModule {}
