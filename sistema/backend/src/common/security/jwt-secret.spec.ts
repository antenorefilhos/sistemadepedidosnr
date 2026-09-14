import { resolveJwtSecret } from './jwt-secret'

// JON-144 (Auditoria 360, High): fallback commitado em docker-compose.yml /
// docker-compose.staging.yml nao pode passar como "segredo forte" so porque
// tem 32+ chars.
describe('resolveJwtSecret (JON-144)', () => {
  const ORIGINAL_ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('aceita qualquer coisa em ambiente local/dev/test', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(() => resolveJwtSecret()).not.toThrow()
  })

  it('rejeita o default commitado do docker-compose.yml mesmo em production', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'antenor_local_stack_jwt_secret_2026_min_32_chars'
    expect(() => resolveJwtSecret()).toThrow(/forte e obrigatorio/)
  })

  it('rejeita o default commitado do docker-compose.staging.yml', () => {
    process.env.NODE_ENV = 'staging'
    process.env.JWT_SECRET = 'staging-jwt-secret-change-before-production'
    expect(() => resolveJwtSecret()).toThrow(/forte e obrigatorio/)
  })

  it('aceita segredo forte e unico fora do ambiente local', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'um-segredo-realmente-unico-gerado-so-para-este-ambiente-2026'
    expect(() => resolveJwtSecret()).not.toThrow()
  })

  it('continua rejeitando segredo curto ou ausente fora do local', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    expect(() => resolveJwtSecret()).toThrow(/forte e obrigatorio/)
  })
})
