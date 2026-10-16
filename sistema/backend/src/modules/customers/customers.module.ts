import { Module } from '@nestjs/common'
import { CustomersService } from './customers.service'
import { CustomersController } from './customers.controller'
import { CustomersAdminController } from './customers-admin.controller'
import { CustomersAdminService } from './customers-admin.service'
import { IntegrationsModule } from '../integrations/integrations.module'
import { DataPrivacyModule } from '../data-privacy/data-privacy.module'

@Module({
  imports: [IntegrationsModule, DataPrivacyModule],
  controllers: [CustomersController, CustomersAdminController],
  providers: [CustomersService, CustomersAdminService],
  exports: [CustomersService],
})
export class CustomersModule {}
