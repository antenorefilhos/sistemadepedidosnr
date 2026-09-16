import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

/**
 * Token assinado nao tem revogacao.
 *
 * Ate 03/09/2026 este guard so conferia a assinatura: desativar um
 * funcionario na tela Equipe nao derrubava a sessao dele, o acesso so acabava
 * quando o token expirava. Com 24h isso ficava contido; com a sessao de 30
 * dias que separacao e entrega precisam, um demitido teria um mes de acesso.
 */
const build = (dados: { customer?: unknown; admin?: unknown }) => {
  const prisma = {
    customer: { findUnique: jest.fn().mockResolvedValue(dados.customer ?? null) },
    admin: { findUnique: jest.fn().mockResolvedValue(dados.admin ?? null) },
  }
  return new JwtStrategy(prisma as never)
}

const token = (over: Record<string, unknown> = {}) => ({
  id: 'u1', email: 'a@b.com', name: 'Fulano', role: 'picker', ...over,
}) as never

describe('JwtStrategy.validate', () => {
  it('funcionario desativado perde o acesso na hora', async () => {
    const strategy = build({ admin: { id: 'u1', active: false, role: 'picker', moduleAccess: ['picking'] } })
    await expect(strategy.validate(token())).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('funcionario ativo passa', async () => {
    const strategy = build({ admin: { id: 'u1', active: true, role: 'picker', moduleAccess: ['picking'] } })
    await expect(strategy.validate(token())).resolves.toMatchObject({ id: 'u1', role: 'picker' })
  })

  it('conta apagada nao passa com token antigo', async () => {
    const strategy = build({})
    await expect(strategy.validate(token())).rejects.toBeInstanceOf(UnauthorizedException)
  })

  // JON-143 (Auditoria 360): tenantId vinha do payload -- conta movida pra
  // outro tenant mantinha o contexto antigo por toda a validade do token.
  it('admin: tenantId vem do banco, nao do payload assinado antigo', async () => {
    const strategy = build({ admin: { id: 'u1', active: true, role: 'picker', moduleAccess: ['picking'], tenantId: 'tenant_novo' } })
    const result = await strategy.validate(token({ tenantId: 'tenant_antigo' }))
    expect(result.tenantId).toBe('tenant_novo')
  })

  it('customer: tenantId vem do banco, nao do payload assinado antigo', async () => {
    const strategy = build({ customer: { id: 'u1', blocked: false, tenantId: 'tenant_novo' } })
    const result = await strategy.validate(token({ role: 'customer', tenantId: 'tenant_antigo' }))
    expect(result.tenantId).toBe('tenant_novo')
  })

  // O token so prova QUEM e; o que a pessoa pode vem do banco. Sem isso,
  // tirar um modulo de alguem na tela Equipe so valeria no proximo login.
  it('modulos vem do banco, nao do token', async () => {
    const strategy = build({ admin: { id: 'u1', active: true, role: 'driver', moduleAccess: ['delivery'] } })
    const user = await strategy.validate(token({ role: 'picker', moduleAccess: ['picking', 'admin'] }))
    expect(user).toMatchObject({ role: 'driver', moduleAccess: ['delivery'] })
  })

  it('cliente bloqueado perde o acesso na hora', async () => {
    const strategy = build({ customer: { id: 'c1', blocked: true } })
    await expect(strategy.validate(token({ id: 'c1', role: 'customer' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('cliente normal passa', async () => {
    const strategy = build({ customer: { id: 'c1', blocked: false } })
    await expect(strategy.validate(token({ id: 'c1', role: 'customer' }))).resolves.toMatchObject({ id: 'c1' })
  })

  it('token sem id nao passa', async () => {
    const strategy = build({})
    await expect(strategy.validate({} as never)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  // JON-138 (Auditoria 360, High): reset/troca de senha incrementa
  // tokenVersion no banco. JWT antigo (assinado com a versao anterior)
  // continua com assinatura valida ate expirar sozinho -- sem essa
  // comparacao, a revogacao nao acontecia de verdade.
  it('JWT de admin com tokenVersion desatualizado (senha trocada) perde acesso', async () => {
    const strategy = build({ admin: { id: 'u1', active: true, role: 'admin', moduleAccess: [], tokenVersion: 2 } })
    await expect(strategy.validate(token({ tokenVersion: 1 }))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('JWT de cliente com tokenVersion desatualizado (senha trocada) perde acesso', async () => {
    const strategy = build({ customer: { id: 'c1', blocked: false, tokenVersion: 1 } })
    await expect(
      strategy.validate(token({ id: 'c1', role: 'customer', tokenVersion: 0 })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('JWT com tokenVersion atual continua valido apos a comparacao', async () => {
    const strategy = build({ admin: { id: 'u1', active: true, role: 'admin', moduleAccess: [], tokenVersion: 3 } })
    await expect(strategy.validate(token({ tokenVersion: 3 }))).resolves.toMatchObject({ id: 'u1' })
  })
})
