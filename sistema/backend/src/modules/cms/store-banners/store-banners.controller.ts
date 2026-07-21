import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { StoreBannersService, StoreBannerPayload } from './store-banners.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('cms/store-banners')
export class StoreBannersController {
  constructor(private readonly storeBannersService: StoreBannersService) {}

  @Get()
  findActive() {
    return this.storeBannersService.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.storeBannersService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() data: StoreBannerPayload) {
    return this.storeBannersService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: Partial<StoreBannerPayload>) {
    return this.storeBannersService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.storeBannersService.deleteWithCleanup(id);
  }
}
