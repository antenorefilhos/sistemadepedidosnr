import { Module } from '@nestjs/common'
import { CustomersService } from './customers.service'
import { CustomersController } from './customers.controller'
import { CustomersAdminController } from './customers-admin.controller'
import { CustomersAdminService } from './customers-admin.service'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [IntegrationsModule],
  controllers: [CustomersController, CustomersAdminController],
  providers: [CustomersService, CustomersAdminService],
  exports: [CustomersService],
})
export class CustomersModule {}
