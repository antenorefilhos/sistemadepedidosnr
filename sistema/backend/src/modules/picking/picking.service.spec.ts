import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { PickingService } from './picking.service'
import { NotificationsService } from '../notifications/notifications.service'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { IntegrationModulesService } from '../integrations/integration-modules.service'

const mockNotificationsService = {
  notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
  notifyPickingTeamNewOrder: jest.fn().mockResolvedValue(undefined),
}

const mockAntenorApiService = {
  updatePickedItems: jest.fn().mockResolvedValue(undefined),
}

// syncOption de separacao so dispara quando 'antenorapi' esta ligado; nos testes
// fica desligado, entao o PUT /itens nunca e chamado.
const mockIntegrationModulesService = {
  isEnabled: jest.fn().mockResolvedValue(false),
}

const mockPrismaService = {
  pickingTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  pickingTaskItem: {
    update: jest.fn(),
    create: jest.fn(),
  },
  pickingBatch: {
    count: jest.fn(),
  },
  pickerPerformanceSnapshot: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  admin: { findMany: jest.fn().mockResolvedValue([]) },
  substitutionSuggestion: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  packingChecklist: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  orderEvent: {
    create: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  productMaster: {
    findFirst: jest.fn(),
  },
  productSubstitution: {
    findMany: jest.fn(),
  },
}

const baseOrder = {
  id: 'order-1',
  tenantId: 'tenant_default',
  storeId: 'store_default',
  customerId: 'customer-1',
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  fulfillmentType: 'DELIVERY',
  subtotal: 20,
  delivery: 5,
  discount: 0,
  total: 25,
  createdAt: new Date('2026-05-26T10:00:00.000Z'),
  customer: { id: 'customer-1', name: 'Cliente', whatsapp: '5511999999999' },
  items: [
    {
      id: 'order-item-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      orderId: 'order-1',
      productId: 'prod-1',
      quantity: 2,
      unitPrice: 10,
      subtotal: 20,
      requestedQuantity: '2',
      fulfilledQuantity: '2',
      finalUnitPrice: null,
      finalSubtotal: '20',
      status: 'PENDING',
      substitutionPolicy: 'ALLOW',
      product: { id: 'prod-1', name: 'Produto 1', ean: '789', unit: 'un', isFractional: false },
    },
  ],
}

const baseTask = {
  id: 'task-1',
  tenantId: 'tenant_default',
  storeId: 'store_default',
  orderId: 'order-1',
  status: 'IN_PROGRESS',
  priority: 20,
  assignedToId: 'picker-1',
  slaDueAt: new Date('2026-05-26T11:30:00.000Z'),
  startedAt: new Date('2026-05-26T10:05:00.000Z'),
  completedAt: null,
  createdAt: new Date('2026-05-26T10:00:00.000Z'),
  updatedAt: new Date('2026-05-26T10:05:00.000Z'),
  items: [
    {
      id: 'task-item-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      taskId: 'task-1',
      orderItemId: 'order-item-1',
      productId: 'prod-1',
      requestedQuantity: '2',
      pickedQuantity: null,
      finalWeight: null,
      status: 'PENDING',
      barcode: null,
      notes: null,
      createdAt: new Date('2026-05-26T10:00:00.000Z'),
      updatedAt: new Date('2026-05-26T10:00:00.000Z'),
    },
  ],
}

describe('PickingService', () => {
  let service: PickingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AntenorApiService, useValue: mockAntenorApiService },
        { provide: IntegrationModulesService, useValue: mockIntegrationModulesService },
      ],
    }).compile()

    service = module.get(PickingService)
    jest.clearAllMocks()
    mockPrismaService.order.findMany.mockResolvedValue([baseOrder])
    mockPrismaService.packingChecklist.findMany.mockResolvedValue([])
    mockPrismaService.orderEvent.create.mockResolvedValue({ id: 'event-1' })
    mockPrismaService.productMaster.findFirst.mockResolvedValue(null)
    mockPrismaService.productSubstitution.findMany.mockResolvedValue([])
    mockPrismaService.product.findMany.mockResolvedValue([])
  })

  it('creates a picking task from an eligible order and records the OMS event', async () => {
    mockPrismaService.order.findFirst.mockResolvedValue(baseOrder)
    mockPrismaService.pickingTask.findFirst.mockResolvedValue(null)
    mockPrismaService.pickingTask.create.mockResolvedValue(baseTask)
    mockPrismaService.order.update.mockResolvedValue({ ...baseOrder, status: 'PICKING_PENDING' })

    const result = await service.ensureTaskForOrder(
      'order-1',
      { tenantId: 'tenant_default', storeId: 'store_default' },
      { orderId: 'order-1', assignedToId: 'picker-1' },
      { actorType: 'ADMIN', actorId: 'admin-1' },
    )

    expect(mockPrismaService.pickingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          assignedToId: 'picker-1',
          items: expect.objectContaining({
            create: [expect.objectContaining({ orderItemId: 'order-item-1', productId: 'prod-1' })],
          }),
        }),
      }),
    )
    expect(mockPrismaService.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PICKING_PENDING' } }))
    expect(mockPrismaService.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'order.picking_task_created',
          actorId: 'admin-1',
        }),
      }),
    )
    expect(result.order?.id).toBe('order-1')
  })

  it('updates task item, order item and totals when an item is picked', async () => {
    const pickedTaskItem = { ...baseTask.items[0], status: 'PICKED', pickedQuantity: '2' }
    const pickedOrderItem = { ...baseOrder.items[0], status: 'PICKED', fulfilledQuantity: '2', finalSubtotal: '20' }
    const recalculatedOrder = { ...baseOrder, subtotal: 20, total: 25, items: [pickedOrderItem] }

    mockPrismaService.pickingTask.findFirst
      .mockResolvedValueOnce(baseTask)
      .mockResolvedValueOnce({ ...baseTask, items: [pickedTaskItem] })
    mockPrismaService.orderItem.findFirst.mockResolvedValue(baseOrder.items[0])
    mockPrismaService.pickingTaskItem.update.mockResolvedValue(pickedTaskItem)
    mockPrismaService.orderItem.update.mockResolvedValue(pickedOrderItem)
    mockPrismaService.order.findFirst.mockResolvedValue(baseOrder)
    mockPrismaService.orderItem.findMany.mockResolvedValue([pickedOrderItem])
    mockPrismaService.order.update.mockResolvedValue(recalculatedOrder)

    const result = await service.pickItem(
      'task-1',
      'task-item-1',
      { quantity: 2, barcode: '789' },
      { tenantId: 'tenant_default', storeId: 'store_default' },
      { actorType: 'ADMIN', actorId: 'admin-1' },
    )

    expect(mockPrismaService.pickingTaskItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-item-1' },
        data: expect.objectContaining({ status: 'PICKED', barcode: '789' }),
      }),
    )
    expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-item-1' },
        // App antigo nao manda `method`: codigo informado vira BARCODE (08/10/2026).
        data: expect.objectContaining({ status: 'PICKED', pickMethod: 'BARCODE', pickedBarcode: '789' }),
      }),
    )
    expect(mockPrismaService.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'order.item_picked',
          payload: expect.objectContaining({ pickedQuantity: 2, barcode: '789', method: 'BARCODE' }),
        }),
      }),
    )
    expect(result.order?.total).toBe(25)
  })

  it('blocks conference with divergence when no justification is provided', async () => {
    mockPrismaService.pickingTask.findFirst.mockResolvedValue({
      ...baseTask,
      status: 'CONFERENCE_PENDING',
      items: [{ ...baseTask.items[0], status: 'PICKED', pickedQuantity: '1' }],
    })

    await expect(
      service.conferenceTask('task-1', {}, { tenantId: 'tenant_default', storeId: 'store_default' }),
    ).rejects.toThrow(BadRequestException)
    expect(mockPrismaService.packingChecklist.create).not.toHaveBeenCalled()
  })

  // JON-73 (Auditoria 360, Medium): dois separadores abrindo a mesma tarefa
  // PENDING ao mesmo tempo -- so um pode ganhar a corrida.
  describe('startTask (JON-73)', () => {
    const pendingTask = { ...baseTask, status: 'PENDING', assignedToId: null }

    it('claim atomico ganha quando o status ainda bate (nenhum concorrente venceu antes)', async () => {
      mockPrismaService.pickingTask.findFirst.mockResolvedValue(pendingTask)
      mockPrismaService.pickingTask.updateMany.mockResolvedValue({ count: 1 })
      mockPrismaService.pickingTask.findUniqueOrThrow.mockResolvedValue({ ...pendingTask, status: 'IN_PROGRESS', assignedToId: 'picker-2' })
      mockPrismaService.order.update.mockResolvedValue(baseOrder)

      const result = await service.startTask(
        'task-1',
        { tenantId: 'tenant_default', storeId: 'store_default' },
        { actorType: 'PICKER', actorId: 'picker-2' },
      )

      expect(mockPrismaService.pickingTask.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'task-1', status: 'PENDING' } }),
      )
      expect(result).toBeDefined()
    })

    it('perde a corrida quando outro separador ja mudou o status entre a leitura e o claim', async () => {
      mockPrismaService.pickingTask.findFirst.mockResolvedValue(pendingTask)
      // updateMany com where.status:'PENDING' nao acha mais a linha -- ja foi
      // reivindicada por outro separador entre a leitura e este ponto.
      mockPrismaService.pickingTask.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        service.startTask(
          'task-1',
          { tenantId: 'tenant_default', storeId: 'store_default' },
          { actorType: 'PICKER', actorId: 'picker-3' },
        ),
      ).rejects.toThrow(BadRequestException)

      expect(mockPrismaService.pickingTask.findUniqueOrThrow).not.toHaveBeenCalled()
      expect(mockPrismaService.order.update).not.toHaveBeenCalled()
    })
  })

  // JON-73: tarefa JA em separacao por outro membro nao aceita item de um
  // segundo separador (pickItem passa por ensureTaskCanReceiveItems).
  describe('ensureTaskCanReceiveItems ownership (JON-73)', () => {
    it('recusa pickItem de quem nao e o dono da tarefa IN_PROGRESS', async () => {
      mockPrismaService.pickingTask.findFirst.mockResolvedValue(baseTask) // assignedToId: 'picker-1'

      await expect(
        service.pickItem(
          'task-1',
          'task-item-1',
          { quantity: 1 },
          { tenantId: 'tenant_default', storeId: 'store_default' },
          { actorType: 'PICKER', actorId: 'picker-outro' },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('admin continua sem restricao de posse', async () => {
      mockPrismaService.pickingTask.findFirst.mockResolvedValue(baseTask)
      mockPrismaService.orderItem.findFirst.mockResolvedValue(baseOrder.items[0])
      mockPrismaService.pickingTaskItem.update.mockResolvedValue({ ...baseTask.items[0], status: 'PICKED' })
      mockPrismaService.orderItem.update.mockResolvedValue({ ...baseOrder.items[0], status: 'PICKED' })
      mockPrismaService.order.findFirst.mockResolvedValue(baseOrder)
      mockPrismaService.orderItem.findMany.mockResolvedValue([baseOrder.items[0]])
      mockPrismaService.order.update.mockResolvedValue(baseOrder)

      await expect(
        service.pickItem(
          'task-1',
          'task-item-1',
          { quantity: 1 },
          { tenantId: 'tenant_default', storeId: 'store_default' },
          { actorType: 'ADMIN', actorId: 'admin-qualquer' },
        ),
      ).resolves.toBeDefined()
    })
  })
})

describe('sendToCashier fecha a tarefa (29/09/2026)', () => {
  it('tarefa em CONFERENCE_PENDING vira COMPLETED ao enviar ao caixa', async () => {
    const svc = new PickingService(mockPrismaService as never, mockNotificationsService as never, {} as never, mockIntegrationModulesService as never)
    mockPrismaService.order.findFirst.mockResolvedValueOnce(baseOrder)
    mockPrismaService.pickingTask.findFirst.mockResolvedValueOnce({ id: 'task-1', status: 'CONFERENCE_PENDING', completedAt: null, items: [{ status: 'PICKED' }] })
    mockPrismaService.order.update.mockResolvedValueOnce({ ...baseOrder, status: 'READY_FOR_CHECKOUT', erpDav: null })
    mockPrismaService.orderEvent.create.mockResolvedValueOnce({})
    mockPrismaService.pickingTask.update.mockClear()

    await svc.sendToCashier('order-1', {})

    expect(mockPrismaService.pickingTask.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
  })
})

describe('troca sugerida antes do caixa (08/10/2026)', () => {
  const svc = () => new PickingService(mockPrismaService as never, mockNotificationsService as never, {} as never, mockIntegrationModulesService as never)
  const prepare = (suggestions: Array<{ sentAt: Date | null }>) => {
    mockPrismaService.order.findFirst.mockResolvedValueOnce(baseOrder)
    mockPrismaService.pickingTask.findFirst.mockResolvedValueOnce({ id: 'task-1', status: 'IN_PROGRESS', completedAt: null, items: [{ status: 'MISSING' }] })
    mockPrismaService.substitutionSuggestion.findMany.mockResolvedValueOnce(suggestions.map((s, i) => ({ id: `s${i}`, status: 'PENDING', ...s })))
  }

  it('troca sugerida e nao enviada barra o envio ao caixa', async () => {
    prepare([{ sentAt: null }])
    await expect(svc().sendToCashier('order-1', {})).rejects.toThrow('não foi enviada ao cliente')
  })

  it('troca enviada ha 5 min barra com o tempo que falta', async () => {
    prepare([{ sentAt: new Date(Date.now() - 5 * 60000) }])
    await expect(svc().sendToCashier('order-1', {})).rejects.toThrow('faltam 10 min')
  })

  it('passou dos 15 min: a troca expira e o pedido segue para o caixa', async () => {
    prepare([{ sentAt: new Date(Date.now() - 16 * 60000) }])
    mockPrismaService.substitutionSuggestion.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrismaService.order.findFirst.mockResolvedValue(baseOrder)
    mockPrismaService.order.update.mockResolvedValueOnce({ ...baseOrder, status: 'READY_FOR_CHECKOUT', erpDav: null })
    await svc().sendToCashier('order-1', {})
    expect(mockPrismaService.substitutionSuggestion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'EXPIRED', decidedBy: 'SYSTEM' }),
    }))
  })
})

describe('o cliente escolhe as trocas pelo site (08/10/2026)', () => {
  const notifications = { ...mockNotificationsService, notifyPickingTeamSubstitutionAnswer: jest.fn().mockResolvedValue(undefined) }
  const svc = () => new PickingService(mockPrismaService as never, notifications as never, {} as never, mockIntegrationModulesService as never)

  it('pedido de outro cliente: nao encontrado', async () => {
    mockPrismaService.order.findFirst.mockResolvedValueOnce({ id: 'order-1', customerId: 'outro', erpDav: '1', status: 'WAITING_CUSTOMER_SUBSTITUTION' })
    await expect(svc().decideSuggestionsAsCustomer('order-1', 'customer-1', [{ id: 's0', accept: true }], {})).rejects.toThrow('Pedido não encontrado')
  })

  it('prazo vencido: avisa que seguiu sem as trocas', async () => {
    mockPrismaService.order.findFirst.mockResolvedValueOnce({ id: 'order-1', customerId: 'customer-1', erpDav: '1', status: 'PICKING' })
    mockPrismaService.substitutionSuggestion.findMany.mockResolvedValueOnce([{ id: 's0', status: 'EXPIRED', sentAt: new Date() }])
    await expect(svc().decideSuggestionsAsCustomer('order-1', 'customer-1', [{ id: 's0', accept: true }], {})).rejects.toThrow('prazo para responder passou')
  })

  it('decide como CUSTOMER, na mesma sugestao do separador, e avisa a separacao', async () => {
    mockPrismaService.order.findFirst.mockResolvedValueOnce({ id: 'order-1', customerId: 'customer-1', erpDav: '102130', status: 'WAITING_CUSTOMER_SUBSTITUTION' })
    mockPrismaService.substitutionSuggestion.findMany.mockResolvedValueOnce([{ id: 's0', status: 'PENDING', sentAt: new Date() }])
    const service = svc()
    const decide = jest.spyOn(service, 'decideSuggestion').mockResolvedValue({} as never)
    await expect(service.decideSuggestionsAsCustomer('order-1', 'customer-1', [{ id: 's0', accept: false }], {})).resolves.toEqual({ accepted: 0, rejected: 1 })
    expect(decide).toHaveBeenCalledWith('s0', false, {}, { actorType: 'CUSTOMER', actorId: 'customer-1' }, 'CUSTOMER')
    expect(notifications.notifyPickingTeamSubstitutionAnswer).toHaveBeenCalledWith('order-1', '102130', 0, 1)
  })
})
