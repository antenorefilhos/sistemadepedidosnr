import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CatalogService } from './catalog.service'

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('quality')
  @RequirePermission('catalog.read')
  @UseGuards(PermissionGuard)
  async getQuality(@Req() req?: TenantContextRequest) {
    return this.catalogService.getQuality(req ? getTenantContext(req) : undefined)
  }

  @Get('issues')
  @RequirePermission('catalog.read')
  @UseGuards(PermissionGuard)
  async getIssues(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Req() req?: TenantContextRequest,
  ) {
    return this.catalogService.listIssues(req ? getTenantContext(req) : undefined, {
      status,
      type,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('issues/:id/resolve')
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async resolveIssue(
    @Param('id') id: string,
    @Body() _body: { notes?: string },
    @Req() req?: TenantContextRequest,
  ) {
    return this.catalogService.resolveIssue(id, req?.user?.id)
  }
}

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class CatalogCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('rebuild-tree')
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async rebuildTree(@Req() req?: TenantContextRequest) {
    return this.catalogService.rebuildCategoryTree(req ? getTenantContext(req) : undefined)
  }
}

@Controller('admin/search')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class CatalogSearchController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('reindex')
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async reindex() {
    return this.catalogService.reindexSearch()
  }
}
