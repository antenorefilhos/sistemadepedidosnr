import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { AuthService } from './auth.service'

/**
 * Conta criada pelo checkout convidado nasce com `password: null`.
 *
 * O reconhecimento do cliente ja funcionava -- `guestCheckout` reusa o
 * cadastro por WhatsApp/CPF/e-mail, entao os pedidos se acumulam no mesmo
 * Customer. O que faltava era o caminho de VOLTA: sem senha o login falha, e
 * "esqueci minha senha" depende de e-mail, opcional no checkout convidado.
 */
const build = (customer: Record<string, unknown> | null) => {
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(customer),
      update: jest.fn().mockResolvedValue({}),
    },
  }
  const service = new AuthService(prisma as never, {} as never, {} as never)
  return { service, prisma }
}

describe('customerSetPassword', () => {
  it('conta sem senha define sem pedir senha atual', async () => {
    const { service, prisma } = build({ id: 'c1', password: null })
    await expect(service.customerSetPassword('c1', 'novaSenha123')).resolves.toMatchObject({
      message: expect.stringContaining('sucesso'),
    })
    expect(prisma.customer.update).toHaveBeenCalled()
  })

  it('grava hash, nunca a senha em texto', async () => {
    const { service, prisma } = build({ id: 'c1', password: null })
    await service.customerSetPassword('c1', 'novaSenha123')
    const gravada = prisma.customer.update.mock.calls[0][0].data.password
    expect(gravada).not.toBe('novaSenha123')
    expect(await bcrypt.compare('novaSenha123', gravada)).toBe(true)
  })

  // Token vazado nao pode virar tomada de conta permanente.
  it('conta COM senha exige a senha atual', async () => {
    const { service } = build({ id: 'c1', password: await bcrypt.hash('antiga', 10) })
    await expect(service.customerSetPassword('c1', 'nova123456')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.customerSetPassword('c1', 'nova123456', 'errada')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.customerSetPassword('c1', 'nova123456', 'antiga')).resolves.toBeDefined()
  })

  // Link de redefinicao pendente no e-mail nao pode continuar valendo depois
  // que o cliente definiu senha por aqui.
  it('invalida token de redefinicao pendente', async () => {
    const { service, prisma } = build({ id: 'c1', password: null })
    await service.customerSetPassword('c1', 'novaSenha123')
    expect(prisma.customer.update.mock.calls[0][0].data).toMatchObject({
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    })
  })

  it('cliente que nao existe mais nao passa', async () => {
    const { service } = build(null)
    await expect(service.customerSetPassword('sumiu', 'novaSenha123')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
