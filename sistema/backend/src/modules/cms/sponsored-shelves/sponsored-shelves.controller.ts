import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { cached, invalidateCached } from '../../../common/memory-cache'
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
    const context = req ? getTenantContext(req) : undefined
    return cached(`sponsored:${context?.tenantId}:${context?.storeId}`, 60_000, () => this.service.listPublic(context))
  }

  /** Publico: a vitrine entrou na tela (mesmo padrao do banner). */
  @Post(':id/impression')
  async registerImpression(@Param('id') id: string) {
    await this.service.registerImpression(id);
    return { success: true };
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
    return this.service.create(req ? getTenantContext(req) : undefined, body).finally(() => invalidateCached('sponsored:'));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body).finally(() => invalidateCached('sponsored:'));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id).finally(() => invalidateCached('sponsored:'));
  }
}
