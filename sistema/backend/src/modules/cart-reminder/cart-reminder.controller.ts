import { Body, Controller, ForbiddenException, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { CartReminderService } from './cart-reminder.service'

@ApiTags('Cart')
@ApiBearerAuth()
@RelaxedThrottle()
@Controller('cart-snapshot')
export class CartReminderController {
  constructor(private readonly reminders: CartReminderService) {}

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Carrinho do site do cliente logado (base do lembrete de carrinho esquecido)' })
  save(@Req() req: { user?: { id?: string; role?: string } }, @Body() body: { items?: unknown }) {
    if (req.user?.role !== 'customer' || !req.user.id) throw new ForbiddenException('Só para clientes.')
    return this.reminders.saveSnapshot(req.user.id, body?.items)
  }
}
