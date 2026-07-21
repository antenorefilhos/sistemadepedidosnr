import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../../common/prisma.service'
import { PickingService } from './picking.service'

const mockPrismaService = {
  pickingTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
  packingChecklist: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
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
        data: expect.objectContaining({ status: 'PICKED' }),
      }),
    )
    expect(mockPrismaService.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'order.item_picked',
          payload: expect.objectContaining({ pickedQuantity: 2, barcode: '789' }),
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
})
