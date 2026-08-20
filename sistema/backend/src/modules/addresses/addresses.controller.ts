import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger'
import { AddressesService, CreateAddressPayload } from './addresses.service'
import { ViaCEPService } from '../../common/services/via-cep.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { assertCustomerOwnership } from '../../common/security/customer-ownership'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Addresses')
@RelaxedThrottle()
@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly viaCEPService: ViaCEPService,
  ) {}

  @Get('search/:cep')
  @ApiOperation({
    summary: 'Buscar endereço por CEP',
    description: 'Consulta a API ViaCEP para obter dados de endereço via CEP.',
  })
  @ApiParam({ name: 'cep', type: String, description: 'CEP no formato XXXXX-XXX' })
  @ApiResponse({
    status: 200,
    description: 'Dados do endereço encontrados',
    schema: {
      example: {
        cep: '01310200',
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        localidade: 'São Paulo',
        uf: 'SP',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'CEP não encontrado',
  })
  async searchCEP(@Param('cep') cep: string) {
    return this.viaCEPService.getAddress(cep)
  }

  @UseGuards(JwtAuthGuard)
  @Get(':customerId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar endereços do cliente',
    description: 'Lista os endereços salvos de um cliente, endereço padrão primeiro.',
  })
  @ApiParam({ name: 'customerId', type: String, description: 'ID do cliente' })
  async listAddresses(
    @Param('customerId') customerId: string,
    @Req() req: { user?: { id?: string; role?: string } },
  ) {
    assertCustomerOwnership(req.user, customerId)
    return this.addressesService.list(customerId)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':customerId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Adicionar endereço do cliente',
    description: 'Adiciona um novo endereço associado a um cliente.',
  })
  @ApiParam({ name: 'customerId', type: String, description: 'ID do cliente' })
  @ApiResponse({
    status: 201,
    description: 'Endereço adicionado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente não encontrado',
  })
  async addAddress(
    @Param('customerId') customerId: string,
    @Body() data: CreateAddressPayload,
    @Req() req: { user?: { id?: string; role?: string } },
  ) {
    assertCustomerOwnership(req.user, customerId)
    return this.addressesService.create(customerId, data)
  }

  @UseGuards(JwtAuthGuard)
  @Put(':customerId/:addressId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar endereço do cliente',
    description: 'Atualiza os campos de um endereço do cliente. Se isDefault: true, desmarca os demais.',
  })
  @ApiParam({ name: 'customerId', type: String, description: 'ID do cliente' })
  @ApiParam({ name: 'addressId', type: String, description: 'ID do endereço' })
  async updateAddress(
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() data: Partial<CreateAddressPayload>,
    @Req() req: { user?: { id?: string; role?: string } },
  ) {
    assertCustomerOwnership(req.user, customerId)
    return this.addressesService.update(customerId, addressId, data)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':customerId/:addressId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Excluir endereço do cliente',
    description: 'Exclui o endereço. Se era o padrão, promove o mais recente restante.',
  })
  @ApiParam({ name: 'customerId', type: String, description: 'ID do cliente' })
  @ApiParam({ name: 'addressId', type: String, description: 'ID do endereço' })
  async deleteAddress(
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Req() req: { user?: { id?: string; role?: string } },
  ) {
    assertCustomerOwnership(req.user, customerId)
    return this.addressesService.delete(customerId, addressId)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':customerId/:addressId/default')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Definir endereço padrão do cliente',
    description: 'Marca o endereço como padrão e desmarca os demais.',
  })
  @ApiParam({ name: 'customerId', type: String, description: 'ID do cliente' })
  @ApiParam({ name: 'addressId', type: String, description: 'ID do endereço' })
  async setDefaultAddress(
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Req() req: { user?: { id?: string; role?: string } },
  ) {
    assertCustomerOwnership(req.user, customerId)
    return this.addressesService.setDefault(customerId, addressId)
  }
}