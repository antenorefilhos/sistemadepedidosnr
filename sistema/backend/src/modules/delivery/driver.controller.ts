import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RequireModule } from '../../common/decorators/require-module.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ModuleAccessGuard } from '../../common/guards/module-access.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { PrismaService } from '../../common/prisma.service'
import { UpdateDeliveryStopStatusDto } from './dto/fulfillment.dto'
import { DeliveryService } from './delivery.service'

@ApiTags('Driver')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)
@RequireModule('delivery')
@Controller('driver')
export class DriverController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Dados do motorista logado' })
  async getMe(@Req() req: TenantContextRequest) {
    const driver = await this.findDriverByAdmin(req)
    return {
      id: req.user?.id,
      name: req.user?.name,
      role: req.user?.role,
      driverId: driver.id,
      driverName: driver.name,
    }
  }

  @Get('routes')
  @ApiOperation({ summary: 'Listar minhas rotas' })
  async listMyRoutes(@Req() req: TenantContextRequest) {
    const driver = await this.findDriverByAdmin(req)
    return this.prisma.deliveryRoute.findMany({
      where: { driverId: driver.id },
      include: {
        driver: true,
        stops: {
          orderBy: [{ sequence: 'asc' }],
          include: { order: { include: { customer: true } } } as any,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  @Get('routes/:id')
  @ApiOperation({ summary: 'Detalhar rota' })
  async findRoute(@Param('id') id: string, @Req() req: TenantContextRequest) {
    const driver = await this.findDriverByAdmin(req)
    const route = await this.prisma.deliveryRoute.findFirst({
      where: { id, driverId: driver.id },
      include: {
        driver: true,
        stops: {
          orderBy: [{ sequence: 'asc' }],
          include: {
            order: {
              include: {
                customer: true,
                items: { include: { product: true } },
              },
            },
          } as any,
        },
      },
    })
    if (!route) throw new NotFoundException('Rota nao encontrada.')
    return route
  }

  @Post('routes/:id/start')
  @ApiOperation({ summary: 'Sair para entrega' })
  async startRoute(@Param('id') id: string, @Req() req: TenantContextRequest) {
    await this.findDriverByAdmin(req)
    return this.deliveryService.startRoute(id, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('routes/:id/stops/:stopId/status')
  @ApiOperation({ summary: 'Atualizar status da parada' })
  async updateStopStatus(
    @Param('id') id: string,
    @Param('stopId') stopId: string,
    @Body() dto: UpdateDeliveryStopStatusDto,
    @Req() req: TenantContextRequest,
  ) {
    await this.findDriverByAdmin(req)
    return this.deliveryService.updateStopStatus(id, stopId, getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Post('routes/:id/complete')
  @ApiOperation({ summary: 'Concluir rota' })
  async completeRoute(@Param('id') id: string, @Req() req: TenantContextRequest) {
    await this.findDriverByAdmin(req)
    return this.deliveryService.completeRoute(id, getTenantContext(req), this.actorFromRequest(req))
  }

  private async findDriverByAdmin(req: TenantContextRequest) {
    const adminId = req.user?.id
    const driver = await this.prisma.driver.findFirst({
      where: { adminId },
    })
    if (!driver) throw new NotFoundException('Nenhum perfil de motorista vinculado a esta conta.')
    return driver
  }

  private actorFromRequest(req: TenantContextRequest) {
    return {
      actorType: 'DRIVER',
      actorId: req.user?.id,
    }
  }
}
