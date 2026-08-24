import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { PromotionsService } from './promotions.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@RelaxedThrottle()
@Controller('promotions/campaigns')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('active')
  findActive() {
    return this.promotionsService.findActiveForStorefront()
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
