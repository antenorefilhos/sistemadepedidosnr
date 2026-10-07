import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { AuthService } from './auth.service'

// Conta do cliente (07/10/2026): ele mesmo muda nome, e-mail e WhatsApp.
const build = (customer: Record<string, unknown>, other: Record<string, unknown> | null = null, blockedReason: string | null = null) => {
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(customer),
      findFirst: jest.fn().mockResolvedValue(other),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...customer, ...data })),
    },
    fraudLog: { create: jest.fn().mockResolvedValue({}) },
  }
  const jwt = { sign: jest.fn().mockReturnValue('token-novo') }
  const fraud = { blockedReason: jest.fn().mockResolvedValue(blockedReason) }
  const service = new AuthService(prisma as never, jwt as never, {} as never, fraud as never)
  return { service, prisma, fraud }
}
const cliente = { id: 'c1', name: 'Maria', email: 'maria@x.com', cpf: '12345678909', whatsapp: '24999990000', blocked: false, tokenVersion: 0 }

describe('customerUpdateProfile', () => {
  it('normaliza e grava, e devolve token novo', async () => {
    const { service, prisma } = build(cliente)
    const res = await service.customerUpdateProfile('c1', { name: '  Maria   da Silva ', email: ' Maria.S@X.com ', whatsapp: '(24) 98888-7777' })
    expect(prisma.customer.update.mock.calls[0][0].data).toEqual({ name: 'Maria da Silva', email: 'maria.s@x.com', whatsapp: '24988887777' })
    expect(res).toMatchObject({ access_token: 'token-novo' })
  })

  it('e-mail ou WhatsApp de outra conta e conflito', async () => {
    const { service } = build(cliente, { id: 'c2' })
    await expect(service.customerUpdateProfile('c1', { email: 'outra@x.com' })).rejects.toBeInstanceOf(ConflictException)
    await expect(service.customerUpdateProfile('c1', { whatsapp: '24977776666' })).rejects.toBeInstanceOf(ConflictException)
  })

  it('valida nome, e-mail e WhatsApp', async () => {
    const { service } = build(cliente)
    await expect(service.customerUpdateProfile('c1', { name: 'A' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.customerUpdateProfile('c1', { email: 'sem-arroba' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.customerUpdateProfile('c1', { whatsapp: '9999' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('e-mail vazio apaga o e-mail (e opcional)', async () => {
    const { service, prisma } = build(cliente)
    await service.customerUpdateProfile('c1', { email: '' })
    expect(prisma.customer.update.mock.calls[0][0].data).toEqual({ email: null })
  })

  it('WhatsApp ou e-mail novo bloqueado pelo antifraude nao entra', async () => {
    const { service, prisma } = build(cliente, null, 'bloqueado')
    await expect(service.customerUpdateProfile('c1', { whatsapp: '24911112222' })).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.customer.update).not.toHaveBeenCalled()
  })
})
