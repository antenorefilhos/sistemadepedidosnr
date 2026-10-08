import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { cached } from '../../common/memory-cache'
import { PromotionsService } from './promotions.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@RelaxedThrottle()
@Controller('promotions/campaigns')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // 30 s em memoria (08/10/2026): o sync dos encartes roda a cada 5 min.
  @Get('active')
  findActive() {
    return cached('campaigns:active', 30_000, () => this.promotionsService.findActiveForStorefront())
  }

  /**
   * Um encarte especifico com seus itens -- destino do clique quando um
   * StoreBanner esta vinculado a um encarte (linkType='campaign'). Publico:
   * o cliente clica no banner antes de logar.
   */
  @Get('by-erp/:erpCampaignId')
  findOneByErpId(@Param('erpCampaignId') erpCampaignId: string) {
    return this.promotionsService.findOneForStorefront(Number(erpCampaignId))
  }

  @Get('name-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listNameRules() {
    return this.promotionsService.listNameRules()
  }

  @Put('name-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  saveNameRule(@Body() body: { key: string; customerName: string; nearExpiry?: boolean }) {
    return this.promotionsService.saveNameRule(body)
  }

  @Delete('name-rules/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteNameRule(@Param('key') key: string) {
    return this.promotionsService.deleteNameRule(key)
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findAllAdmin() {
    return this.promotionsService.findAllAdmin()
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  syncFromERP() {
    return this.promotionsService.syncFromERP()
  }

  @Post('expire')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  expireCampaigns() {
    return this.promotionsService.expireCampaigns()
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() data: { active?: boolean; highlightInHome?: boolean }) {
    if (data.active !== undefined) return this.promotionsService.setActive(id, data.active)
    if (data.highlightInHome !== undefined) return this.promotionsService.setHighlightInHome(id, data.highlightInHome)
    return this.promotionsService.findAllAdmin()
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id)
  }
}
