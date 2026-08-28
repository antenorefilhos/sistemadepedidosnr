import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Header } from '@nestjs/common';
import { StoreBannersService, StoreBannerPayload } from './store-banners.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RelaxedThrottle } from '../../../common/decorators/relaxed-throttle.decorator'

// Rota publica, sem auth, chamada em toda carga da Home.
//
// Era `public, max-age=60, stale-while-revalidate=300`, e na pratica o
// operador editava um banner no admin e precisava limpar o cache do navegador
// pra ver na loja: 60s servindo a copia antiga direto, e ate 5 min a mais
// servindo a versao velha enquanto revalidava em segundo plano.
//
// `no-cache` NAO desliga o cache -- ele guarda a resposta e revalida antes de
// usar. Como a rota ja responde com ETag, a revalidacao vira um 304 vazio
// quando nada mudou, entao o custo em banda e banco continua perto de zero e
// o que foi salvo aparece na hora. `must-revalidate` fecha a porta pra proxy
// intermediario decidir servir stale por conta propria.
const PUBLIC_CACHE_HEADER = 'public, no-cache, must-revalidate';

@RelaxedThrottle()
@Controller('cms/store-banners')
export class StoreBannersController {
  constructor(private readonly storeBannersService: StoreBannersService) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE_HEADER)
  findActive(@Query('slot') slot?: string, @Query('category') category?: string, @Query('page') page?: string) {
    return this.storeBannersService.findActive({ slot, category, page });
  }

  @Get('active')
  @Header('Cache-Control', PUBLIC_CACHE_HEADER)
  findActiveExplicit(@Query('slot') slot?: string, @Query('category') category?: string, @Query('page') page?: string) {
    return this.storeBannersService.findActive({ slot, category, page });
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

  @Post(':id/click')
  async registerClick(@Param('id') id: string) {
    await this.storeBannersService.registerClick(id);
    return { success: true };
  }

  @Post(':id/impression')
  async registerImpression(@Param('id') id: string) {
    await this.storeBannersService.registerImpression(id);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.storeBannersService.deleteWithCleanup(id);
  }
}
