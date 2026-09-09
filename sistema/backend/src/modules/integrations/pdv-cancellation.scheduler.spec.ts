import { Test, TestingModule } from '@nestjs/testing'
import { PdvCancellationScheduler } from './pdv-cancellation.scheduler'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationModulesService } from './integration-modules.service'
import { AntenorApiService } from './antenor-api.service'
import { OrderOrchestrationService } from './order-orchestration.service'

const mockPrisma = { order: { findMany: jest.fn() } }
const mockIntegrationModules = { isEnabled: jest.fn() }
const mockAntenorApi = { getOrderStatus: jest.fn() }
const mockOrchestration = { markCancelledInErp: jest.fn() }

describe('PdvCancellationScheduler', () => {
  let scheduler: PdvCancellationScheduler
  const envOriginal = { ...process.env }

  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.PDV_CANCELLATION_CRON_ENABLED = 'true'
    mockIntegrationModules.isEnabled.mockResolvedValue(true)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdvCancellationScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IntegrationModulesService, useValue: mockIntegrationModules },
        { provide: AntenorApiService, useValue: mockAntenorApi },
        { provide: OrderOrchestrationService, useValue: mockOrchestration },
      ],
    }).compile()

    scheduler = module.get(PdvCancellationScheduler)
  })

  afterAll(() => {
    process.env = envOriginal
  })

  it('desligado por env: nem consulta o banco', async () => {
    process.env.PDV_CANCELLATION_CRON_ENABLED = 'false'
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdvCancellationScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IntegrationModulesService, useValue: mockIntegrationModules },
        { provide: AntenorApiService, useValue: mockAntenorApi },
        { provide: OrderOrchestrationService, useValue: mockOrchestration },
      ],
    }).compile()
    const desligado = module.get(PdvCancellationScheduler)

    await desligado.handleCheck()

    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })

  it('conector antenorapi desligado: nao verifica nada', async () => {
    mockIntegrationModules.isEnabled.mockResolvedValue(false)

    await scheduler.handleCheck()

    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })

  it('sem candidatos: nao chama a AntenorApi', async () => {
    mockPrisma.order.findMany.mockResolvedValue([])

    await scheduler.handleCheck()

    expect(mockAntenorApi.getOrderStatus).not.toHaveBeenCalled()
  })

  it('pedido ainda AGUARDANDO_PDV: nao cancela', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'order-1', erpDav: '102073' }])
    mockAntenorApi.getOrderStatus.mockResolvedValue({ statusGeral: 'AGUARDANDO_PDV' })

    await scheduler.handleCheck()

    expect(mockOrchestration.markCancelledInErp).not.toHaveBeenCalled()
  })

  it('cancelado na retaguarda: reflete no pedido com o motivo do ERP', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'order-1', erpDav: '102073' }])
    mockAntenorApi.getOrderStatus.mockResolvedValue({
      statusGeral: 'CANCELADO_NA_RETAGUARDA',
      cancelamento: { canceladoEm: '2026-09-08T00:00:00.000Z', motivo: 'Cancelado no PDV' },
    })

    await scheduler.handleCheck()

    expect(mockOrchestration.markCancelledInErp).toHaveBeenCalledWith(undefined, 'order-1', {
      canceladoEm: '2026-09-08T00:00:00.000Z',
      motivo: 'Cancelado no PDV',
      dav: '102073',
    })
  })

  it('cancelado no PDV (variante do status) tambem reflete', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'order-2', erpDav: '102076' }])
    mockAntenorApi.getOrderStatus.mockResolvedValue({ statusGeral: 'CANCELADO_NO_PDV' })

    await scheduler.handleCheck()

    expect(mockOrchestration.markCancelledInErp).toHaveBeenCalled()
  })

  it('um pedido falhando na consulta nao impede os outros do lote', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'order-com-erro', erpDav: '999999' },
      { id: 'order-ok', erpDav: '102073' },
    ])
    mockAntenorApi.getOrderStatus
      .mockRejectedValueOnce(new Error('AntenorApi fora do ar'))
      .mockResolvedValueOnce({ statusGeral: 'CANCELADO_NA_RETAGUARDA' })

    await scheduler.handleCheck()

    expect(mockOrchestration.markCancelledInErp).toHaveBeenCalledTimes(1)
    expect(mockOrchestration.markCancelledInErp).toHaveBeenCalledWith(
      undefined,
      'order-ok',
      expect.anything(),
    )
  })

  it('execucao concorrente e ignorada', async () => {
    mockPrisma.order.findMany.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    )

    const primeira = scheduler.handleCheck()
    await scheduler.handleCheck() // dispara enquanto a primeira ainda roda
    await primeira

    expect(mockPrisma.order.findMany).toHaveBeenCalledTimes(1)
  })
})
