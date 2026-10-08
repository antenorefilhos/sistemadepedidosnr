import { Body, Controller, ForbiddenException, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { PickingService } from './picking.service'

class CustomerSuggestionDecision {
  @IsString()
  id: string

  @IsBoolean()
  accept: boolean
}

export class CustomerDecideSuggestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CustomerSuggestionDecision)
  decisions: CustomerSuggestionDecision[]
}

/**
 * Troca sugerida, etapa 2 (08/10/2026): o cliente aceita ou recusa pelo site,
 * em Minha conta. Mesmo registro que o separador usa para a resposta do
 * WhatsApp -- os dois caminhos ficam sincronizados.
 */
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard)
@RelaxedThrottle()
@Controller('orders')
export class CustomerSubstitutionsController {
  constructor(private readonly pickingService: PickingService) {}

  @Post(':orderId/substitutions/decide')
  @ApiOperation({ summary: 'Cliente aceita ou recusa as trocas sugeridas na separacao' })
  async decide(@Param('orderId') orderId: string, @Body() dto: CustomerDecideSuggestionsDto, @Req() req: TenantContextRequest) {
    const role = String(req.user?.role || '').toLowerCase()
    const customerId = String(req.user?.id || '')
    if (role !== 'customer' || !customerId) throw new ForbiddenException('Só o cliente do pedido escolhe as trocas.')
    return this.pickingService.decideSuggestionsAsCustomer(orderId, customerId, dto.decisions, getTenantContext(req))
  }
}
