import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { CartService } from './cart.service'
import { CreateCartDto, UpdateCartItemDto, UpsertCartItemDto } from './dto/cart.dto'

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async create(@Body() dto: CreateCartDto, @Req() req?: TenantContextRequest) {
    return this.cartService.createCart(req ? getTenantContext(req) : undefined, dto)
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
