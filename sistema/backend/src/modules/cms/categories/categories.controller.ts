import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('cms/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('commercial')
  findCommercialTaxonomy() {
    return this.categoriesService.findCommercialTaxonomy();
  }

  @Get('classification-mappings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getClassificationMappings() {
    return this.categoriesService.getClassificationMappings();
  }

  @Post('classification-mappings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addClassificationMapping(
    @Body() data: { categoryId: string; classificationLevel: number; classificationValue: string }
  ) {
    return this.categoriesService.addClassificationMapping(data);
  }

  @Delete('classification-mappings/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeClassificationMapping(@Param('id') id: string) {
    return this.categoriesService.removeClassificationMapping(id);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() data: { name: string; bannerUrl?: string; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    return this.categoriesService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: { name?: string; bannerUrl?: string; active?: boolean; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    return this.categoriesService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
