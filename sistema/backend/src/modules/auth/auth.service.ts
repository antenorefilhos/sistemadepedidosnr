import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { CreateAdminDto, STAFF_MODULES, UpdateStaffDto } from './dto/create-admin.dto'
import { CreateCustomerRegisterDto } from './dto/create-customer-register.dto'
import { CreateGuestCheckoutDto } from './dto/create-guest-checkout.dto'
import { LoginDto, CustomerLoginDto } from './dto/login.dto'
import * as bcrypt from 'bcrypt'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { EmailService } from '../notifications/email.service'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /**
   * Sempre responde generico (nunca revela se o e-mail existe) pra nao virar
   * oraculo de enumeracao de contas. So envia e-mail de verdade se achar a
   * conta.
   */
  async forgotPassword(email: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email } })
    if (admin) {
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      })
      const adminUrl = process.env.ADMIN_URL || 'http://localhost:3002'
      const resetUrl = `${adminUrl}/redefinir-senha?token=${token}`
      await this.emailService.sendPasswordReset(admin.email, admin.name, resetUrl)
    }
    return { message: 'Se o e-mail existir, enviamos um link de redefinicao.' }
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const admin = await this.prisma.admin.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
    })
    if (!admin) {
      throw new BadRequestException('Link invalido ou expirado. Peca uma nova redefinicao.')
    }
    const password = await bcrypt.hash(newPassword, 10)
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { password, resetTokenHash: null, resetTokenExpiresAt: null },
    })
    return { message: 'Senha redefinida com sucesso.' }
  }

  /**
   * Mesmo padrao de forgotPassword do admin, mas para clientes do storefront.
   * So funciona se o cliente tiver e-mail cadastrado -- contas criadas via
   * checkout convidado sem e-mail nao tem como recuperar senha por aqui.
   */
  async customerForgotPassword(email: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email } })
    if (customer) {
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      })
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`
      await this.emailService.sendPasswordReset(customer.email!, customer.name, resetUrl)
    }
    return { message: 'Se o e-mail existir, enviamos um link de redefinicao.' }
  }

  async customerResetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const customer = await this.prisma.customer.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
    })
    if (!customer) {
      throw new BadRequestException('Link invalido ou expirado. Peca uma nova redefinicao.')
    }
    const password = await bcrypt.hash(newPassword, 10)
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { password, resetTokenHash: null, resetTokenExpiresAt: null },
    })
    return { message: 'Senha redefinida com sucesso.' }
  }

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
    const role = admin.role || 'admin'
    const moduleAccess = role === 'admin' ? [...STAFF_MODULES] : admin.moduleAccess || []

    if (role === 'admin') {
      await this.grantDefaultAdminAccess(admin.id, tenantId, storeId)
    }

    const access_token = this.jwtService.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role,
      moduleAccess,
      tenantId,
      storeId,
    })

    return { access_token, admin: { id: admin.id, email: admin.email, name: admin.name, role, moduleAccess, tenantId, storeId } }
  }

  async customerLogin(loginDto: CustomerLoginDto) {
    const identifier = (loginDto.identifier ?? loginDto.email ?? '').trim()
    const customer = await this.findCustomerByLoginIdentifier(identifier)

    if (!customer || !customer.password || !await bcrypt.compare(loginDto.password, customer.password)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Credenciais invalidas',
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

  /**
   * Garante que todo admin tenha acesso RBAC granular (catalog.write,
   * pricing.write etc) via a role "Administrador" do tenant. Sem isso o
   * PermissionGuard bloqueia edicoes mesmo para quem tem role='admin' --
   * o token JWT nao carrega permissions e user_store_access fica vazio
   * se ninguem popular manualmente. Idempotente: nao faz nada se ja existe.
   */
  /**
   * Login do storefront aceita e-mail, CPF ou celular num campo unico.
   * Detecta pelo formato: contem "@" -> email; senao normaliza removendo
   * mascara e busca por digitos. CPF (11 digitos) e celular com DDD (10-11
   * digitos, celular novo tem o 9 na frente) se sobrepoem em quantidade de
   * digitos, entao busca por CPF OU whatsapp igual e deixa o banco resolver
   * -- ambos sao @unique, so pode bater um customer.
   */
  private async findCustomerByLoginIdentifier(identifier: string) {
    if (!identifier) return null

    if (identifier.includes('@')) {
      return this.prisma.customer.findUnique({ where: { email: identifier.toLowerCase() } })
    }

    const digits = identifier.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) return null

    return this.prisma.customer.findFirst({ where: { OR: [{ cpf: digits }, { whatsapp: digits }] } })
  }

  private async grantDefaultAdminAccess(userId: string, tenantId: string, storeId: string) {
    const existing = await this.prisma.userStoreAccess.findFirst({
      where: { userId, storeId },
    })
    if (existing) return

    const adminRole = await this.prisma.role.findFirst({
      where: { tenantId, name: 'Administrador' },
    })
    if (!adminRole) return

    await this.prisma.userStoreAccess.create({
      data: { userId, storeId, roleId: adminRole.id },
    })
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

    // 'role' fica reservado para o marcador legado (admin = master/superuser, com bypass
    // total). Contas de equipe criadas com moduleAccess/permissions usam role='staff' --
    // assim elas nunca herdam checagens `@Roles('admin')` as quais nao deveriam ter acesso
    // so por terem o modulo Admin liberado; o que elas podem fazer dentro do Admin e
    // decidido pelas permissoes granulares (RequirePermission), nao pelo role.
    const isMaster = createAdminDto.role === 'admin'
    const role = isMaster ? 'admin' : 'staff'
    const moduleAccess = isMaster ? [] : (createAdminDto.moduleAccess || [])

    const admin = await this.prisma.admin.create({
      data: {
        email: createAdminDto.email,
        name: createAdminDto.name,
        password: hashedPassword,
        role,
        moduleAccess,
      },
    })

    const tenantId = admin.tenantId || DEFAULT_TENANT_ID
    const storeId = DEFAULT_STORE_ID

    if (isMaster) {
      await this.grantDefaultAdminAccess(admin.id, tenantId, storeId)
    } else {
      await this.syncStaffPermissions(admin.id, tenantId, storeId, createAdminDto.permissions || [])
      if (moduleAccess.includes('delivery')) {
        await this.ensureDriverProfile(admin.id, tenantId, storeId, admin.name)
      }
    }

    const effectiveModuleAccess = isMaster ? [...STAFF_MODULES] : moduleAccess
    const access_token = this.jwtService.sign({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role,
      moduleAccess: effectiveModuleAccess,
      tenantId,
      storeId,
    })

    return { access_token, admin: { id: admin.id, email: admin.email, name: admin.name, role, moduleAccess: effectiveModuleAccess, tenantId, storeId } }
  }

  /**
   * Sincroniza as permissoes granulares de uma conta de equipe (nao-master) usando o
   * pipeline RBAC ja existente (Role -> RolePermission -> UserStoreAccess), o mesmo lido
   * pelo PermissionGuard. Cada conta de equipe tem uma Role privada 1:1 ("Permissoes de
   * <nome>"), recriada a cada chamada -- assim a UI so precisa mandar a lista final de
   * permission keys marcadas, sem se preocupar em criar/gerenciar roles.
   */
  private async syncStaffPermissions(adminId: string, tenantId: string, storeId: string, permissionKeys: string[]) {
    const roleKey = `staff_${adminId}`
    const role = await this.prisma.role.upsert({
      where: { tenantId_key: { tenantId, key: roleKey } },
      create: { tenantId, key: roleKey, name: `Permissoes de ${adminId}`, isSystem: false },
      update: {},
    })

    const validPermissions = permissionKeys.length
      ? await this.prisma.permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true } })
      : []

    await this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    if (validPermissions.length) {
      await this.prisma.rolePermission.createMany({
        data: validPermissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      })
    }

    await this.prisma.userStoreAccess.upsert({
      where: { userId_storeId_roleId: { userId: adminId, storeId, roleId: role.id } },
      create: { userId: adminId, storeId, roleId: role.id },
      update: {},
    })

    // Remove vinculos a outras roles de equipe antigas (ex: role foi recriada com outro id
    // em algum cenario de migracao) para nao deixar permissao "fantasma" sobrando.
    await this.prisma.userStoreAccess.deleteMany({
      where: { userId: adminId, storeId, roleId: { not: role.id }, role: { key: { startsWith: 'staff_' } } },
    })
  }

  /** Cria o perfil de motorista (tabela Driver) para quem ganhou acesso ao modulo delivery. Idempotente. */
  private async ensureDriverProfile(adminId: string, tenantId: string, storeId: string, name: string) {
    await this.prisma.driver.upsert({
      where: { adminId },
      create: { adminId, tenantId, storeId, name },
      update: {},
    })
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

  async listStaff(tenantId: string) {
    const staff = await this.prisma.admin.findMany({
      where: { tenantId },
      select: { id: true, email: true, name: true, role: true, moduleAccess: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const accessRows = await this.prisma.userStoreAccess.findMany({
      where: { userId: { in: staff.map((s) => s.id) }, role: { key: { startsWith: 'staff_' } } },
      select: { userId: true, role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
    })
    const permissionsByUserId = new Map<string, string[]>()
    for (const row of accessRows) {
      permissionsByUserId.set(row.userId, row.role.permissions.map((p) => p.permission.key))
    }

    return staff.map((s) => ({ ...s, permissions: permissionsByUserId.get(s.id) || [] }))
  }

  async updateStaff(id: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.admin.findUnique({ where: { id } })
    if (!staff) throw new NotFoundException('Membro nao encontrado')

    const data: Record<string, unknown> = {}
    if (dto.name) data.name = dto.name
    if (dto.email) data.email = dto.email
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10)

    const isMaster = staff.role === 'admin'
    if (!isMaster && dto.moduleAccess) data.moduleAccess = dto.moduleAccess

    const updated = await this.prisma.admin.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, moduleAccess: true, active: true, createdAt: true },
    })

    const tenantId = staff.tenantId || DEFAULT_TENANT_ID
    if (!isMaster && dto.permissions) {
      await this.syncStaffPermissions(id, tenantId, DEFAULT_STORE_ID, dto.permissions)
    }
    if (!isMaster && dto.moduleAccess?.includes('delivery')) {
      await this.ensureDriverProfile(id, tenantId, DEFAULT_STORE_ID, updated.name)
    }

    return updated
  }

  async toggleStaffActive(id: string) {
    const staff = await this.prisma.admin.findUnique({ where: { id } })
    if (!staff) throw new NotFoundException('Membro nao encontrado')
    return this.prisma.admin.update({
      where: { id },
      data: { active: !staff.active },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    })
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
