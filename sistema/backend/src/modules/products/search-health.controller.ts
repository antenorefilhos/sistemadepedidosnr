import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { SearchHealthService } from './search-health.service'

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/search')
export class SearchHealthController {
  constructor(private readonly health: SearchHealthService) {}

  @Post('check')
  @ApiOperation({ summary: 'Confere agora se os termos acham produto no site e, se nao, por que' })
  check(@Body() body: { terms?: string[] }) {
    return this.health.check(Array.isArray(body?.terms) ? body.terms : [])
  }

  @Get('synonyms')
  list() {
    return this.health.listSynonyms()
  }

  @Post('synonyms')
  @ApiOperation({ summary: 'Cria/atualiza sinonimo: buscar "termo" tambem procura os equivalentes' })
  add(@Body() body: { term: string; equivalents: string[] }) {
    return this.health.addSynonym(body?.term, body?.equivalents)
  }

  @Delete('synonyms/:id')
  remove(@Param('id') id: string) {
    return this.health.removeSynonym(id)
  }
}
