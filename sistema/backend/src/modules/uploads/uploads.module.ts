import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { ThumbsController, UploadVariantsController } from './thumbs.controller';
import { CloudflareCacheService } from '../../common/cloudflare-cache.service';

@Module({
  providers: [UploadsService, CloudflareCacheService],
  controllers: [UploadsController, ThumbsController, UploadVariantsController]
})
export class UploadsModule {}
