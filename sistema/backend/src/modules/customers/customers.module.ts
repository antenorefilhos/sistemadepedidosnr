import { Module } from '@nestjs/common'
import { CustomersService } from './customers.service'
import { CustomersController } from './customers.controller'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [IntegrationsModule],
  controllers: [CustomersController],
  providers: [CustomersService, PrismaService],
  exports: [CustomersService],
})
export class CustomersModule {}
