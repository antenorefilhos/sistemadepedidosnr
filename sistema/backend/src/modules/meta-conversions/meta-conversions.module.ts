import { Module } from '@nestjs/common'
import { MetaConversionsService } from './meta-conversions.service'

@Module({
  providers: [MetaConversionsService],
  exports: [MetaConversionsService],
})
export class MetaConversionsModule {}
