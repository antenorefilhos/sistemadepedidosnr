import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductsService } from './products.service'

@Controller('admin/products')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('classification01') classification01?: string,
    @Query('classification02') classification02?: string,
    @Query('classification03') classification03?: string,
    @Query('classification04') classification04?: string,
    @Query('outOfStock') outOfStock?: string,
    @Query('inactive') inactive?: string,
    @Query('uncategorized') uncategorized?: string,
    @Req() req?: TenantContextRequest,
  ) {
    return this.productsService.findAllAdmin(
      Number(page) || 1,
      Number(limit) || 10,
      search,
      classification01,
      classification02,
      classification03,
      classification04,
      outOfStock === 'true',
      inactive === 'true',
      uncategorized === 'true',
      req ? getTenantContext(req) : undefined,
    )
  }

  @Post()
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async create(@Body() dto: CreateProductDto, @Req() req?: TenantContextRequest) {
    return this.productsService.create(dto, req ? getTenantContext(req) : undefined)
  }

  @Patch(':id')
  @RequirePermission('catalog.write', 'pricing.write')
  @UseGuards(PermissionGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req?: TenantContextRequest) {
    return this.productsService.update(id, dto, req ? getTenantContext(req) : undefined)
  }

  @Post(':id/media')
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async addMedia(
    @Param('id') id: string,
    @Body() body: { type?: string; url: string; alt?: string; sortOrder?: number; isPrimary?: boolean },
    @Req() req?: TenantContextRequest,
  ) {
    return this.productsService.addMedia(
      id,
      {
        type: body.type || 'IMAGE',
        url: body.url,
        alt: body.alt,
        sortOrder: body.sortOrder,
        isPrimary: body.isPrimary,
      },
      req ? getTenantContext(req) : undefined,
    )
  }

  @Post(':id/substitutes')
  @RequirePermission('catalog.write')
  @UseGuards(PermissionGuard)
  async createSubstitute(
    @Param('id') id: string,
    @Body() body: { substituteId: string; priority?: number; rule?: string },
    @Req() req?: TenantContextRequest,
  ) {
    return this.productsService.createSubstitute(id, body, req ? getTenantContext(req) : undefined)
  }
}
