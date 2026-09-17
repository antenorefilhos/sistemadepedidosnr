import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { HomeVitrinesService, HomeVitrinesQuery } from './home-vitrines.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RelaxedThrottle } from '../../../common/decorators/relaxed-throttle.decorator'
import { Logger, Query } from '@nestjs/common';

@RelaxedThrottle()
@Controller('cms/categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly homeVitrinesService: HomeVitrinesService,
  ) {}

  @Get('commercial')
  findCommercialTaxonomy() {
    return this.categoriesService.findCommercialTaxonomy();
  }

  /**
   * Home Vitrines Inteligentes (JON-172/173 -> AEF-037). `null` sinaliza pro
   * front cair no fallback client-side (useHomeShelves) -- a AntenorApi e uma
   * dependencia externa nova no caminho critico da Home, e cair com 500
   * quebraria a pagina mais importante do storefront por indisponibilidade de
   * terceiro.
   */
  @Get('home-vitrines')
  async findHomeVitrines(@Query() query: HomeVitrinesQuery) {
    try {
      return await this.homeVitrinesService.getHomeVitrines(query);
    } catch (error) {
      this.logger.warn(
        `Falha ao buscar vitrines da AntenorApi, front cai no fallback client-side: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
  create(@Body() data: { name: string; shortName?: string; bannerUrl?: string; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    return this.categoriesService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: { name?: string; shortName?: string; bannerUrl?: string; active?: boolean; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    return this.categoriesService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
