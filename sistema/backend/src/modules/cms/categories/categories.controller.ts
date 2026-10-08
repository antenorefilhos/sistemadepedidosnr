import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { HomeVitrinesService, HomeVitrinesQuery } from './home-vitrines.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RelaxedThrottle } from '../../../common/decorators/relaxed-throttle.decorator'
import { invalidateNotOffered } from '../../../common/not-offered-categories';
import { cached, invalidateCached } from '../../../common/memory-cache';
import { Logger, Query } from '@nestjs/common';

@RelaxedThrottle()
@Controller('cms/categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly homeVitrinesService: HomeVitrinesService,
  ) {}

  // Igual para todo cliente e pesada (varre o catalogo e monta as vitrines):
  // 1 min em memoria, e o admin mexendo em departamento zera na hora.
  @Get('commercial')
  findCommercialTaxonomy() {
    return cached('cms:commercial', 60_000, () => this.categoriesService.findCommercialTaxonomy());
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
    return this.categoriesService.addClassificationMapping(data).finally(() => invalidateCached('cms:'));
  }

  @Delete('classification-mappings/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeClassificationMapping(@Param('id') id: string) {
    return this.categoriesService.removeClassificationMapping(id).finally(() => invalidateCached('cms:'));
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('admin/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminOverview() {
    return this.categoriesService.adminOverview();
  }

  // 29/09/2026: sem criar nem excluir pelo painel. Categoria nova nunca aparecia
  // no site (o site conhece as 19 oficiais) e excluir apagava a categoria de
  // todos os produtos dela, tirando-os do site.
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() data: { shortName?: string; bannerUrl?: string; active?: boolean; priority?: number; limit?: number; curatedProductIds?: string[] }) {
    const result = await this.categoriesService.update(id, data);
    // Ocultar/reexibir departamento vale na hora (vitrine, recomendacao, listagem).
    invalidateNotOffered();
    invalidateCached('cms:');
    this.homeVitrinesService.clearCache();
    return result;
  }
}
