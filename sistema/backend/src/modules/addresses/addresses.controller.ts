import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger'
import { AddressesService } from './addresses.service'
import { CreateAddressPayload } from './addresses.service'
import { ViaCEPService } from '../../common/services/via-cep.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { assertCustomerOwnership } from '../../common/security/customer-ownership'

@ApiTags('Addresses')
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
}
