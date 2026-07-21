import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { PublicApiKeyGuard } from '../../common/guards/public-api-key.guard'
import { PublicApiAdminController, PublicApiV1Controller } from './public-api.controller'
import { PublicApiService } from './public-api.service'

@Module({
  controllers: [PublicApiV1Controller, PublicApiAdminController],
  providers: [PublicApiService, PublicApiKeyGuard, PrismaService],
  exports: [PublicApiService],
})
export class PublicApiModule {}
