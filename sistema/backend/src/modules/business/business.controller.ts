import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { BusinessService } from './business.service'

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('customers/:customerId/context')
  getCustomerContext(@Param('customerId') customerId: string, @Req() req?: TenantContextRequest) {
    return this.businessService.getCustomerBusinessContext(customerId, req ? getTenantContext(req) : undefined)
  }
}

@Controller('admin/business-accounts')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
export class AdminBusinessAccountsController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  list(@Req() req?: TenantContextRequest) {
    return this.businessService.listAccounts(req ? getTenantContext(req) : undefined)
  }

  @Post()
  create(@Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.createAccount(req ? getTenantContext(req) : undefined, body)
  }

  @Get('approvals/pending')
  approvals(@Req() req?: TenantContextRequest) {
    return this.businessService.listApprovalQueue(req ? getTenantContext(req) : undefined)
  }

  @Post('orders/:orderId/approve')
  approveOrder(@Param('orderId') orderId: string, @Req() req?: TenantContextRequest) {
    return this.businessService.approveOrder(orderId, req ? getTenantContext(req) : undefined, req?.user?.id)
  }

  @Post('orders/:orderId/billing')
  billOrder(@Param('orderId') orderId: string, @Req() req?: TenantContextRequest) {
    return this.businessService.runBillingForOrder(orderId, req ? getTenantContext(req) : undefined)
  }

  @Post(':id/users')
  addUser(@Param('id') id: string, @Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.addUser(id, req ? getTenantContext(req) : undefined, body)
  }

  @Get(':id/shopping-lists')
  shoppingLists(@Param('id') id: string, @Req() req?: TenantContextRequest) {
    return this.businessService.listCorporateShoppingLists(id, req ? getTenantContext(req) : undefined)
  }

  @Post(':id/shopping-lists')
  createShoppingList(@Param('id') id: string, @Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.createCorporateShoppingList(id, req ? getTenantContext(req) : undefined, body)
  }

  @Post(':id/recurring-orders')
  createRecurringOrder(@Param('id') id: string, @Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.createRecurringOrder(id, req ? getTenantContext(req) : undefined, { ...body, actorId: req?.user?.id })
  }

  @Post(':id/billing/run')
  runBilling(@Param('id') id: string, @Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.runBillingForAccount(id, req ? getTenantContext(req) : undefined, body || {})
  }

  @Get(':id/financial')
  financial(@Param('id') id: string, @Req() req?: TenantContextRequest) {
    return this.businessService.getFinancialSummary(id, req ? getTenantContext(req) : undefined)
  }

  @Post(':id/price-list')
  createPriceList(@Param('id') id: string, @Body() body: any, @Req() req?: TenantContextRequest) {
    return this.businessService.createAccountPriceList(id, req ? getTenantContext(req) : undefined, body)
  }
}
