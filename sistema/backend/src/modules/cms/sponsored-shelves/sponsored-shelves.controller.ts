import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RelaxedThrottle } from '../../../common/decorators/relaxed-throttle.decorator';
import { getTenantContext, TenantContextRequest } from '../../../common/tenant/tenant-context';
import { SponsoredShelvesService } from './sponsored-shelves.service';

@RelaxedThrottle()
@Controller('cms/sponsored-shelves')
export class SponsoredShelvesController {
  constructor(private readonly service: SponsoredShelvesService) {}

  /** Publico: consumido pela Home do storefront. */
  @Get()
  async listPublic(@Req() req?: TenantContextRequest) {
    return this.service.listPublic(req ? getTenantContext(req) : undefined);
  }
}

@RelaxedThrottle()
@Controller('admin/sponsored-shelves')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSponsoredShelvesController {
  constructor(private readonly service: SponsoredShelvesService) {}

  @Get()
  async list(@Req() req?: TenantContextRequest) {
    return this.service.listAdmin(req ? getTenantContext(req) : undefined);
  }

  @Post()
  async create(@Body() body: any, @Req() req?: TenantContextRequest) {
    return this.service.create(req ? getTenantContext(req) : undefined, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
