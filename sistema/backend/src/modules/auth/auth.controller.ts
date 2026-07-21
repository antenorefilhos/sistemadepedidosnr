import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { CreateAdminDto } from './dto/create-admin.dto'
import { CreateCustomerRegisterDto } from './dto/create-customer-register.dto'
import { CreateGuestCheckoutDto } from './dto/create-guest-checkout.dto'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login de Administrador',
    description: 'Autentica um administrador e retorna um token JWT.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciais de login (email e password)',
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          email: 'admin@antenor.com.br',
          role: 'admin',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto)
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login de Cliente',
    description: 'Autentica um cliente e retorna um token JWT.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciais de login (email e password)',
  })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 1,
          email: 'cliente@email.com',
          role: 'customer',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
  })
  customerLogin(@Body() loginDto: LoginDto) {
    return this.authService.customerLogin(loginDto)
  }

  @Post('customer/register')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Registro de novo Cliente',
    description: 'Cria uma nova conta de cliente e retorna um token JWT.',
  })
  @ApiBody({
    type: CreateCustomerRegisterDto,
    description: 'Dados do cliente',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente registrado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou cliente já existe',
  })
  customerRegister(@Body() dto: CreateCustomerRegisterDto) {
    return this.authService.customerRegister(dto)
  }

  @Post('customer/guest-checkout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ checkout: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Autenticação para checkout convidado',
    description: 'Cria ou reutiliza um cliente a partir do WhatsApp e retorna token para finalizar pedido sem login explícito.',
  })
  @ApiBody({
    type: CreateGuestCheckoutDto,
    description: 'Dados mínimos do cliente convidado',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkout convidado autorizado com sucesso',
  })
  guestCheckout(@Body() dto: CreateGuestCheckoutDto) {
    return this.authService.guestCheckout(dto)
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registro de novo Administrador',
    description: 'Cria uma nova conta de administrador (requer autenticação de admin).',
  })
  @ApiBody({
    type: CreateAdminDto,
    description: 'Dados do administrador',
  })
  @ApiResponse({
    status: 201,
    description: 'Administrador registrado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou admin já existe',
  })
  register(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.register(createAdminDto)
  }
}
