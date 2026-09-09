import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { HeroSlidesService } from './hero-slides.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RelaxedThrottle } from '../../../common/decorators/relaxed-throttle.decorator'

@RelaxedThrottle()
@Controller('cms/hero-slides')
export class HeroSlidesController {
  constructor(private readonly heroSlidesService: HeroSlidesService) {}

  @Get()
  findAll() {
    return this.heroSlidesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() data: { title: string; tag?: string; description?: string; ctaLabel?: string; imageUrl: string; link?: string; order?: number }) {
    // JON-31: achado na varredura de 09/09/2026 -- body sem `title`/`imageUrl`
    // (colunas NOT NULL) estourava 500 direto do Prisma em vez de 400.
    if (!data?.title || !data?.imageUrl) {
      throw new BadRequestException('Campos "title" e "imageUrl" são obrigatórios.')
    }
    return this.heroSlidesService.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: { title?: string; tag?: string; description?: string; ctaLabel?: string; imageUrl?: string; link?: string; active?: boolean; order?: number }) {
    return this.heroSlidesService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.heroSlidesService.remove(id);
  }
}
