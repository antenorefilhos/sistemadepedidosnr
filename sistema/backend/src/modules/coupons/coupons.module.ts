import { Module } from '@nestjs/common'
import { CouponsController } from './coupons.controller'
import { CouponsService } from './coupons.service'
import { PricingModule } from '../pricing/pricing.module'

@Module({
  imports: [PricingModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
