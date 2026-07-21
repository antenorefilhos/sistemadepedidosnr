import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger'
import { CustomersService } from './customers.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

type UpdateCustomerDto = Partial<CreateCustomerDto>

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles('admin')
  @Get()
  @ApiOperation({
    summary: 'Listar clientes',
    description: 'Retorna lista de todos os clientes, com opção de busca.',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome ou email' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes',
    schema: {
      example: [
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@example.com',
          phone: '11999999999',
        },
      ],
    },
  })
  async findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search)
  }

  @Roles('admin')
  @Get('analytics/origin')
  @ApiOperation({
    summary: 'Canal de aquisição de clientes (Phase 17)',
    description: 'Retorna a distribuição de clientes por origem (Instagram, WhatsApp, Google, etc.).',
  })
  @ApiResponse({ status: 200, description: 'Array com origin e count' })
  async getOriginAnalytics() {
    return this.customersService.getOriginAnalytics()
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter cliente por ID',
    description: 'Retorna os detalhes de um cliente específico.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do cliente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente não encontrado',
  })
  async findOne(@Param('id') id: string, @Req() req: { user?: { id?: string; role?: string } }) {
    const role = String(req.user?.role || '').toLowerCase()
    const requesterId = String(req.user?.id || '')

    if (role !== 'admin' && requesterId !== id) {
      throw new ForbiddenException('Acesso negado para este cliente')
    }

    return this.customersService.findOne(id)
  }

  @Roles('admin')
  @Post()
  @ApiOperation({
    summary: 'Criar cliente',
    description: 'Cria um novo cliente no sistema.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
  })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto)
  }

  @Roles('admin')
  @Put(':id')
  @ApiOperation({
    summary: 'Atualizar cliente',
    description: 'Atualiza os dados de um cliente existente.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Cliente atualizado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente não encontrado',
  })
  async update(@Param('id') id: string, @Body() data: UpdateCustomerDto) {
    return this.customersService.update(id, data)
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({
    summary: 'Deletar cliente',
    description: 'Remove um cliente do sistema.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Cliente deletado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente não encontrado',
  })
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id)
  }
}
