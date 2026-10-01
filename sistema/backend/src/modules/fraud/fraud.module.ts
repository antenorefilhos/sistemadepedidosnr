import { Global, Module } from '@nestjs/common'
import { FraudAdminService } from './fraud-admin.service'
import { FraudController } from './fraud.controller'
import { FraudService } from './fraud.service'

/** Global: cadastro, cupom, pedido e checkout usam o mesmo FraudService. */
@Global()
@Module({
  controllers: [FraudController],
  providers: [FraudService, FraudAdminService],
  exports: [FraudService],
})
export class FraudModule {}
