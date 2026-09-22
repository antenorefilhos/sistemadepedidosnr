import { Module } from '@nestjs/common';
import { SponsoredShelvesService } from './sponsored-shelves.service';
import { SponsoredShelvesController, AdminSponsoredShelvesController } from './sponsored-shelves.controller';

@Module({
  providers: [SponsoredShelvesService],
  controllers: [SponsoredShelvesController, AdminSponsoredShelvesController],
})
export class SponsoredShelvesModule {}
