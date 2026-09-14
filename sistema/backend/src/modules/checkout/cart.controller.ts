import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CartService } from './cart.service'
import { CreateCartDto, UpdateCartItemDto, UpsertCartItemDto } from './dto/cart.dto'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard'

type RequestUser = { id?: string; role?: string }

@RelaxedThrottle()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() dto: CreateCartDto, @Req() req?: TenantContextRequest & { user?: RequestUser }) {
    // JON-132: cliente logado nunca decide o proprio customerId pelo corpo --
    // o token manda. Sem token, guest checkout continua como sempre foi.
    const verifiedCustomerId = req?.user?.role === 'customer' ? req.user.id : undefined
    const payload = verifiedCustomerId ? { ...dto, customerId: verifiedCustomerId } : dto
    return this.cartService.createCart(req ? getTenantContext(req) : undefined, payload)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: TenantContextRequest) {
    return this.cartService.findCart(id, req ? getTenantContext(req) : undefined)
  }

  @Post(':id/items')
  async addItem(@Param('id') id: string, @Body() dto: UpsertCartItemDto, @Req() req?: TenantContextRequest) {
    return this.cartService.addItem(id, req ? getTenantContext(req) : undefined, dto)
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req?: TenantContextRequest,
  ) {
    return this.cartService.updateItem(id, itemId, req ? getTenantContext(req) : undefined, dto)
  }

  @Delete(':id/items/:itemId')
  async deleteItem(@Param('id') id: string, @Param('itemId') itemId: string, @Req() req?: TenantContextRequest) {
    return this.cartService.deleteItem(id, itemId, req ? getTenantContext(req) : undefined)
  }
}
