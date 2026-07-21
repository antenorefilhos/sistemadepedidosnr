import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PromoBannersService } from './promo-banners.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('cms/promo-banners')
export class PromoBannersController {
  constructor(private readonly promoBannersService: PromoBannersService) {}

  @Get()
  findAll() {
    return this.promoBannersService.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin() {
    return this.promoBannersService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body()
    data: {
      title: string;
      subtitle?: string;
      link?: string;
      badge?: string;
      highlightNote?: string;
      highlightedProductId?: string;
      description?: string;
      imageUrl: string;
      ctaLabel?: string;
      ctaTo?: string;
      align?: string;
      order?: number;
    },
  ) {
    return this.promoBannersService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body()
    data: {
      title?: string;
      subtitle?: string;
      link?: string;
      badge?: string;
      highlightNote?: string;
      highlightedProductId?: string;
      description?: string;
      imageUrl?: string;
      ctaLabel?: string;
      ctaTo?: string;
      align?: string;
      active?: boolean;
      order?: number;
    },
  ) {
    return this.promoBannersService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.promoBannersService.remove(id);
  }
}
