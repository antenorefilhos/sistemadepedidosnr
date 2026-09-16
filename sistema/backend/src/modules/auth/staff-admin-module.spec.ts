import { BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'

// JON-74 (Auditoria 360, Medium): cadastro de staff permitia salvar
// moduleAccess=['admin'], mas o login do painel exige role==='admin' de
// verdade -- a conta criada anunciava um acesso que o login sempre
// rejeitava. Staff so pode escolher entre modulos operacionais reais.
const buildPrisma = () => ({
  admin: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'staff', tenantId: 'tenant_default' }),
    create: jest.fn(),
    update: jest.fn(),
  },
  role: { upsert: jest.fn().mockResolvedValue({ id: 'role-1' }) },
  permission: { findMany: jest.fn().mockResolvedValue([]) },
  rolePermission: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn() },
})

const buildJwt = () => ({ sign: jest.fn().mockReturnValue('token') })
const buildEmail = () => ({})

describe('AuthService — modulo admin restrito a master (JON-74)', () => {
  it('register rejeita staff com moduleAccess incluindo admin', async () => {
    const service = new AuthService(buildPrisma() as any, buildJwt() as any, buildEmail() as any)

    await expect(
      service.register({
        email: 'staff@example.com',
        name: 'Staff',
        password: 'senha1234',
        role: 'staff',
        moduleAccess: ['admin', 'picking'],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('register nao rejeita staff sem admin no moduleAccess (guard nao dispara)', async () => {
    const prisma = buildPrisma()
    prisma.admin.create.mockResolvedValue({ id: 'staff-2', tokenVersion: 0, name: 'Staff' })
    const service = new AuthService(prisma as any, buildJwt() as any, buildEmail() as any)

    // So confere que a trava do JON-74 (moduleAccess incluindo 'admin') nao
    // dispara aqui -- outras dependencias do fluxo completo (permissoes,
    // etc.) nao sao o alvo deste teste, por isso tolera qualquer erro QUE
    // NAO seja o BadRequestException do guard.
    let caught: unknown = null
    try {
      await service.register({
        email: 'staff2@example.com',
        name: 'Staff',
        password: 'senha1234',
        role: 'staff',
        moduleAccess: ['picking'],
      } as any)
    } catch (err) {
      caught = err
    }
    expect(caught).not.toBeInstanceOf(BadRequestException)
  })

  it('updateStaff rejeita incluir admin no moduleAccess de staff', async () => {
    const service = new AuthService(buildPrisma() as any, buildJwt() as any, buildEmail() as any)

    await expect(
      service.updateStaff('staff-1', { moduleAccess: ['admin'] } as any, 'actor-1', 'tenant_default'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
