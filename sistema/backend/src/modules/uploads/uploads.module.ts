import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { CloudflareCacheService } from '../../common/cloudflare-cache.service';

@Module({
  providers: [UploadsService, CloudflareCacheService],
  controllers: [UploadsController]
})
export class UploadsModule {}
