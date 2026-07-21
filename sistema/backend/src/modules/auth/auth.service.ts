import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../common/prisma.service'
import { CreateAdminDto } from './dto/create-admin.dto'
import { CreateCustomerRegisterDto } from './dto/create-customer-register.dto'
import { CreateGuestCheckoutDto } from './dto/create-guest-checkout.dto'
import { LoginDto } from './dto/login.dto'
import * as bcrypt from 'bcrypt'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: loginDto.email },
    })

    if (!admin || !await bcrypt.compare(loginDto.password, admin.password)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Email ou senha invalidos',
        error: 'Nao autorizado',
      })
    }

    const tenantId = admin.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID
    const access_token = this.jwtService.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
      tenantId,
      storeId,
    })

    return { access_token, admin: { id: admin.id, email: admin.email, name: admin.name, role: 'admin', tenantId, storeId } }
  }

  async customerLogin(loginDto: LoginDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: loginDto.email },
    })

    if (!customer || !customer.password || !await bcrypt.compare(loginDto.password, customer.password)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Email ou senha invalidos',
        error: 'Nao autorizado',
      })
    }

    const tenantId = customer.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID
    const access_token = this.jwtService.sign({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      cpf: customer.cpf,
      whatsapp: customer.whatsapp,
      role: 'customer',
      tenantId,
      storeId,
    })

    return { access_token, user: { id: customer.id, email: customer.email, name: customer.name, cpf: customer.cpf, whatsapp: customer.whatsapp, role: 'customer', tenantId, storeId } }
  }

  async register(createAdminDto: CreateAdminDto) {
    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email: createAdminDto.email },
    })

    if (existingAdmin) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Email ja cadastrado',
        error: 'Conflito',
      })
    }

    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10)

    const admin = await this.prisma.admin.create({
      data: {
        email: createAdminDto.email,
        name: createAdminDto.name,
        password: hashedPassword,
      },
    })

    const tenantId = admin.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID
    const access_token = this.jwtService.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
      tenantId,
      storeId,
    })

    return { access_token, admin: { id: admin.id, email: admin.email, name: admin.name, role: 'admin', tenantId, storeId } }
  }

  async customerRegister(dto: CreateCustomerRegisterDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { OR: [{ email: dto.email }, { cpf: dto.cpf }] },
    })
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Email ou CPF ja cadastrado',
        error: 'Conflito',
      })
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10)
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        email: dto.email,
        cpf: dto.cpf,
        whatsapp: dto.whatsapp,
        password: hashedPassword,
        ...(dto.origin && { origin: dto.origin }),
      },
    })

    const tenantId = customer.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID
    const access_token = this.jwtService.sign({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      cpf: customer.cpf,
      whatsapp: customer.whatsapp,
      role: 'customer',
      tenantId,
      storeId,
    })

    return { access_token, user: { id: customer.id, email: customer.email, name: customer.name, cpf: customer.cpf, whatsapp: customer.whatsapp, role: 'customer', tenantId, storeId } }
  }

  async guestCheckout(dto: CreateGuestCheckoutDto) {
    const allowGuestCheckout = (process.env.ALLOW_GUEST_CHECKOUT || 'true').toLowerCase() !== 'false'
    if (!allowGuestCheckout) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Checkout convidado desabilitado',
        error: 'Nao autorizado',
      })
    }

    const name = String(dto.name || '').trim()
    const whatsapp = String(dto.whatsapp || '').replace(/\D/g, '')
    const cpfInput = String(dto.cpf || '').replace(/\D/g, '')
    const emailInput = String(dto.email || '').trim().toLowerCase()

    if (!name || !whatsapp) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Nome e WhatsApp são obrigatórios para checkout convidado',
        error: 'Dados invalidos',
      })
    }

    const fallbackCpf = `9${whatsapp.padStart(10, '0').slice(-10)}`
    const cpf = cpfInput || fallbackCpf

    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [{ whatsapp }, { cpf }, ...(emailInput ? [{ email: emailInput }] : [])],
      },
    })

    if (existing) {
      return this.buildCustomerTokenResponse(existing)
    }

    const customer = await this.prisma.customer.create({
      data: {
        name,
        whatsapp,
        cpf,
        ...(emailInput ? { email: emailInput } : {}),
        origin: 'guest_checkout',
      },
    })

    return this.buildCustomerTokenResponse(customer)
  }

  private buildCustomerTokenResponse(customer: {
    id: string
    email: string | null
    name: string
    cpf: string
    whatsapp: string
    tenantId?: string
  }) {
    const tenantId = customer.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID
    const access_token = this.jwtService.sign({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      cpf: customer.cpf,
      whatsapp: customer.whatsapp,
      role: 'customer',
      tenantId,
      storeId,
    })

    return {
      access_token,
      user: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        cpf: customer.cpf,
        whatsapp: customer.whatsapp,
        role: 'customer',
        tenantId,
        storeId,
      },
    }
  }
}
