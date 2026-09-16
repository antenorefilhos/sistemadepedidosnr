import { HealthController } from './health.controller'

// JON-111 (Auditoria 360): sem cache, cada chamada disparava uma consulta
// pesada real ao Solidcom (GetProdutos) -- chamadas concorrentes dentro da
// janela devem reaproveitar a mesma checagem em voo, e chamadas subsequentes
// dentro do TTL devem servir do cache sem rodar de novo.
describe('HealthController (JON-111)', () => {
  const buildPrisma = () => ({
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    outboxEvent: { count: jest.fn().mockResolvedValue(0) },
    integrationDeadLetter: { count: jest.fn().mockResolvedValue(0) },
  })

  const buildIntegrationModules = (enabled: Record<string, boolean> = {}) => ({
    isEnabled: jest.fn((key: string) => Promise.resolve(Boolean(enabled[key]))),
  })

  it('chamadas concorrentes compartilham a mesma checagem em voo (single-flight)', async () => {
    const controller = new HealthController(buildPrisma() as never, buildIntegrationModules() as never)
    const spy = jest.spyOn(controller as never, 'runChecks' as never)

    const [a, b, c] = await Promise.all([controller.check(), controller.check(), controller.check()])

    expect(spy).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
  }, 20000)

  it('chamada seguinte dentro do TTL serve do cache, sem rodar de novo', async () => {
    const controller = new HealthController(buildPrisma() as never, buildIntegrationModules() as never)
    const spy = jest.spyOn(controller as never, 'runChecks' as never)

    const first = await controller.check()
    const second = await controller.check()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  }, 20000)
})

// JON-110: health checava sempre o Solidcom legado, mesmo com AntenorApi
// habilitada (e priorizada pelo catalogo) -- painel podia mostrar saude
// errada do ERP ativo de verdade.
describe('HealthController — provedor de ERP ativo (JON-110)', () => {
  const buildPrisma = () => ({
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    outboxEvent: { count: jest.fn().mockResolvedValue(0) },
    integrationDeadLetter: { count: jest.fn().mockResolvedValue(0) },
  })

  it('sem nenhum conector habilitado, nao faz nenhuma chamada de rede ao ERP', async () => {
    const integrationModules = { isEnabled: jest.fn().mockResolvedValue(false) }
    const controller = new HealthController(buildPrisma() as never, integrationModules as never)

    const result = await (controller as any).checkSolidcom()

    expect(result.status).toBe('ok')
    expect(result.detail).toMatch(/nenhum conector/)
  })

  it('com antenorapi habilitada, consulta o adaptador AntenorApi, nao o Solidcom legado', async () => {
    const integrationModules = { isEnabled: jest.fn((key: string) => Promise.resolve(key === 'antenorapi')) }
    const controller = new HealthController(buildPrisma() as never, integrationModules as never)
    const antenorSpy = jest.spyOn(controller as any, 'checkAntenorApi').mockResolvedValue({ status: 'ok' })
    const solidcomSpy = jest.spyOn(controller as any, 'checkSolidcomLegacy')

    const result = await (controller as any).checkSolidcom()

    expect(antenorSpy).toHaveBeenCalled()
    expect(solidcomSpy).not.toHaveBeenCalled()
    expect(result.status).toBe('ok')
  })
})
