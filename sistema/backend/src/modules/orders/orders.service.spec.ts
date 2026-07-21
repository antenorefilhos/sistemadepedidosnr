import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../common/prisma.service';
import { WhatsAppService } from '../../modules/notifications/whatsapp.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrderOrchestrationService } from '../integrations/order-orchestration.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';
import { PublicApiService } from '../public-api/public-api.service';

const mockPrismaService = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  orderEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  address: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  fraudLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  idempotencyKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockReservation: {
    count: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
};

const mockWhatsAppService = {
  sendOrderConfirmation: jest.fn(),
  sendStatusUpdate: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn(),
};

const mockOrderOrchestrationService = {
  syncCreatedOrder: jest.fn(),
  syncCancelledOrder: jest.fn(),
};

const mockIntegrationsService = {
  syncFiscalDocument: jest.fn().mockReturnValue(Promise.resolve()),
  syncChargePayment: jest.fn().mockReturnValue(Promise.resolve()),
};

const mockNotificationsService = {
  create: jest.fn(),
};
const mockInventoryService = {
  reserveForCheckout: jest.fn(),
  releaseOrderReservations: jest.fn(),
  consumeOrderReservations: jest.fn(),
};
const mockPricingService = {
  quote: jest.fn(),
  recordPromotionUsage: jest.fn(),
};
const mockPublicApiService = {
  emitWebhookEvent: jest.fn().mockResolvedValue({ deliveries: [] }),
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: OrderOrchestrationService, useValue: mockOrderOrchestrationService },
        { provide: IntegrationsService, useValue: mockIntegrationsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: PublicApiService, useValue: mockPublicApiService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get(PrismaService);
    mockPrismaService.customer.findUnique.mockResolvedValue({
      id: 'customer-1',
      name: 'John',
      cpf: '12345678900',
      whatsapp: '5511999999999',
      email: 'test@test.com',
    });
    mockPrismaService.customer.findFirst.mockResolvedValue({
      id: 'customer-1',
      name: 'John',
      cpf: '12345678900',
      whatsapp: '5511999999999',
      email: 'test@test.com',
      tenantId: 'tenant_default',
    });
    mockPrismaService.address.findUnique.mockResolvedValue(null);
    mockPrismaService.address.findFirst.mockResolvedValue({
      id: 'addr-1',
      customerId: 'customer-1',
      street: 'Rua A',
      number: '123',
      complement: null,
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001000',
      isDefault: true,
    });
    mockPrismaService.order.findFirst.mockResolvedValue(null);
    mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrismaService.idempotencyKey.create.mockResolvedValue({ id: 'idem-record' });
    mockPrismaService.idempotencyKey.update.mockResolvedValue({ id: 'idem-record' });
    mockPrismaService.orderEvent.create.mockResolvedValue({ id: 'event-1' });
    mockPrismaService.orderEvent.findMany.mockResolvedValue([]);
    mockPrismaService.stockReservation.count.mockResolvedValue(1);
    mockInventoryService.reserveForCheckout.mockResolvedValue([{ id: 'reservation-1' }]);
    mockInventoryService.releaseOrderReservations.mockResolvedValue({ count: 1 });
    mockInventoryService.consumeOrderReservations.mockResolvedValue({ consumed: 1 });
    mockPricingService.recordPromotionUsage.mockResolvedValue({ count: 0 });
    mockPricingService.quote.mockImplementation(async (request: any) => {
      if (request.items.some((item: any) => item.productId === 'missing-prod')) {
        throw new Error('Produto nao encontrado: missing-prod');
      }
      if (request.couponCode === 'INVALID') {
        throw new Error('Cupom invalido.');
      }

      const catalog: Record<string, { name: string; ean: string; unitPrice: number }> = {
        'prod-1': { name: 'Product 1', ean: '123', unitPrice: request.couponCode === 'SAVE10' ? 100 : 15 },
        'prod-2': { name: 'Product 2', ean: '456', unitPrice: 10 },
      };
      const quoteItems = request.items.map((item: any) => {
        const product = catalog[item.productId] || { name: 'Product', ean: '100', unitPrice: 25 };
        const subtotal = product.unitPrice * item.quantity;
        return {
          productId: item.productId,
          name: product.name,
          ean: product.ean,
          category: 'GERAL',
          quantity: item.quantity,
          unitPrice: product.unitPrice,
          subtotal,
          priceListId: 'pl-default',
          margin: null,
        };
      });
      const subtotal = quoteItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
      const discountAmount = request.couponCode === 'SAVE10' ? 10 : 0;
      const deliveryAmount = Number(request.deliveryAmount || 0);
      return {
        tenantId: request.tenantId || 'tenant_default',
        storeId: request.storeId || 'store_default',
        channel: request.channel || 'STOREFRONT',
        items: quoteItems,
        subtotal,
        deliveryAmount,
        originalDeliveryAmount: deliveryAmount,
        discountAmount,
        total: subtotal + deliveryAmount - discountAmount,
        appliedPromotions: discountAmount > 0 ? [{ promotionId: 'promo-1', discountAmount }] : [],
        estimatedMargin: null,
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create order with correct subtotal calculation with promotional prices', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-promotional',
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-2', quantity: 3 },
        ],
        delivery: 15,
        discount: 0,
        paymentMethod: 'PIX',
      };

      const mockProduct1 = { id: 'prod-1', name: 'Product 1', ean: '123', price: 20, promotionalPrice: 15 };
      const mockProduct2 = { id: 'prod-2', name: 'Product 2', ean: '456', price: 10, promotionalPrice: null };

      mockPrismaService.product.findFirst
        .mockResolvedValueOnce(mockProduct1)
        .mockResolvedValueOnce(mockProduct2);

      const mockCreatedOrder = {
        id: 'order-multicart',
        customerId: 'customer-1',
        subtotal: 60,
        delivery: 15,
        discount: 0,
        total: 75,
        status: 'PENDING',
        paymentMethod: 'PIX',
        customer: { whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [
          { id: 'item-1', productId: 'prod-1', quantity: 2, unitPrice: 15, subtotal: 30, product: { ean: '123', name: 'Product 1' } },
          { id: 'item-2', productId: 'prod-2', quantity: 3, unitPrice: 10, subtotal: 30, product: { ean: '456', name: 'Product 2' } },
        ],
      };

      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      mockOrderOrchestrationService.syncCreatedOrder.mockResolvedValue(undefined);
      mockWhatsAppService.sendOrderConfirmation.mockResolvedValue({ url: 'wa.me' });

      const result = await service.create(mockCreateOrderDto as any);

      expect(prismaService.order.create).toHaveBeenCalled();
      expect(mockInventoryService.reserveForCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: expect.stringMatching(/^order_/),
          items: [
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 3 },
          ],
        }),
      );
      expect(prismaService.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: expect.stringMatching(/^order_/),
            customerSnapshot: expect.objectContaining({ id: 'customer-1', whatsapp: '5511999999999' }),
            addressSnapshot: expect.objectContaining({ id: 'addr-1', zipCode: '01001000' }),
            deliverySnapshot: expect.objectContaining({ fee: 15, outOfArea: false }),
            priceSnapshot: expect.objectContaining({ subtotal: 60, delivery: 15, discount: 0, total: 75 }),
          }),
        }),
      );
      expect(mockPrismaService.orderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-multicart',
            type: 'order.created',
            payload: expect.objectContaining({
              status: 'PENDING',
              channel: 'STOREFRONT',
              fulfillmentType: 'DELIVERY',
              itemCount: 2,
            }),
          }),
        }),
      );
      expect(result.order.subtotal).toBe(60);
      expect(result.order.total).toBe(75);
    });

    it('should reject order with missing product before creating', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-missing-product',
        items: [{ productId: 'missing-prod', quantity: 1 }],
        delivery: 5,
        paymentMethod: 'PIX',
      };

      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await expect(service.create(mockCreateOrderDto as any)).rejects.toThrow('Produto nao encontrado');
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
      expect(mockInventoryService.reserveForCheckout).not.toHaveBeenCalled();
      expect(mockPrismaService.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'idem-record' },
          data: { status: 'FAILED' },
        }),
      );
    });

    it('should return existing order for duplicate idempotency key with same payload', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-duplicate',
        items: [{ productId: 'prod-1', quantity: 1 }],
        delivery: 5,
        paymentMethod: 'PIX',
      };

      const existingOrder = {
        id: 'order-existing',
        customerId: 'customer-1',
        subtotal: 10,
        delivery: 5,
        total: 15,
        customer: { id: 'customer-1', whatsapp: '5511999999999', name: 'John' },
        items: [],
      };

      let requestHash = '';
      mockPrismaService.idempotencyKey.findUnique.mockImplementation(async (args: any) => {
        requestHash = (service as any).hashCreateOrderRequest(mockCreateOrderDto);
        const unique = args.where.tenantId_storeId_scope_key;
        return {
          id: 'idem-record',
          scope: unique.scope,
          key: unique.key,
          tenantId: unique.tenantId,
          storeId: unique.storeId,
          requestHash,
          responseRef: 'order-existing',
          status: 'COMPLETED',
        };
      });
      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);

      const result = await service.create(mockCreateOrderDto as any);

      expect(result).toEqual({ order: existingOrder, whatsapp: null });
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });

    it('should apply coupon with correct discountAmount', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-coupon',
        items: [{ productId: 'prod-1', quantity: 1 }],
        delivery: 10,
        paymentMethod: 'PIX',
        couponCode: 'SAVE10',
      };

      const mockCreatedOrder = {
        id: 'order-with-coupon',
        subtotal: 100,
        delivery: 10,
        discount: 10,
        total: 100,
        status: 'PENDING',
        customer: { whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: { ean: '100', name: 'Product' } }],
      };

      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      mockOrderOrchestrationService.syncCreatedOrder.mockResolvedValue(undefined);
      mockWhatsAppService.sendOrderConfirmation.mockResolvedValue({ url: 'wa.me' });

      const result = await service.create(mockCreateOrderDto as any);

      expect(mockPricingService.quote).toHaveBeenCalledWith(expect.objectContaining({ couponCode: 'SAVE10' }));
      expect(mockPricingService.recordPromotionUsage).toHaveBeenCalledWith(
        expect.objectContaining({ appliedPromotions: [expect.objectContaining({ promotionId: 'promo-1' })] }),
        'order-with-coupon',
        'customer-1',
      );
      expect(result.order.discount).toBe(10);
      expect(result.order.total).toBe(100);
    });

    it('should store change amount in notes for DINHEIRO payment', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-cash',
        items: [{ productId: 'prod-1', quantity: 1 }],
        delivery: 5,
        paymentMethod: 'DINHEIRO',
        changeAmount: 50,
      };

      const mockProduct = { id: 'prod-1', name: 'Product', ean: '789', price: 25, promotionalPrice: null };
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const mockCreatedOrder = {
        id: 'order-cash',
        subtotal: 25,
        delivery: 5,
        discount: 0,
        total: 30,
        status: 'PENDING',
        notes: 'Troco para: 50',
        customer: { whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: { ean: '789', name: 'Product' } }],
      };

      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      mockOrderOrchestrationService.syncCreatedOrder.mockResolvedValue(undefined);
      mockWhatsAppService.sendOrderConfirmation.mockResolvedValue({ url: 'wa.me' });

      const result = await service.create(mockCreateOrderDto as any);

      expect(result.order.notes).toContain('Troco para: 50');
    });

    it('should treat CARD as offline card-on-delivery when payment gateway is enabled', () => {
      process.env.ENABLE_PAYMENTS_INTEGRATION = 'true';

      try {
        expect(
          (service as any).requiresOnlinePaymentAuthorization({
            paymentMethod: 'CARD',
            paymentStatus: 'UNPAID',
          }),
        ).toBe(false);
      } finally {
        delete process.env.ENABLE_PAYMENTS_INTEGRATION;
      }
    });

    it('should throw error for invalid coupon', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-invalid-coupon',
        items: [{ productId: 'prod-1', quantity: 1 }],
        delivery: 5,
        paymentMethod: 'PIX',
        couponCode: 'INVALID',
      };

      await expect(service.create(mockCreateOrderDto as any)).rejects.toThrow();
    });

    it('should reject order when stock reservation cannot be created', async () => {
      const mockCreateOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-stock-reservation',
        items: [{ productId: 'prod-1', quantity: 1 }],
        delivery: 5,
        paymentMethod: 'PIX',
      };

      const mockProduct = { id: 'prod-1', name: 'Product', ean: '100', price: 100, promotionalPrice: null };
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);
      mockInventoryService.reserveForCheckout.mockRejectedValue(new Error('Estoque indisponivel para o produto: prod-1'));

      await expect(service.create(mockCreateOrderDto as any)).rejects.toThrow('Estoque indisponivel');
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
      expect(mockPrismaService.idempotencyKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'idem-record' },
          data: { status: 'FAILED' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return order by ID with all details', async () => {
      const mockOrder = {
        id: 'order-123',
        customerId: 'customer-1',
        subtotal: 100,
        delivery: 10,
        total: 110,
        status: 'CONFIRMED',
        items: [{ id: 'item-1', productId: 'prod-1' }],
        customer: { id: 'customer-1', name: 'John' },
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-123');

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-123' },
        })
      );
      expect(result?.id).toBe('order-123');
    });

    it('should return null for non-existent order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      const result = await service.findOne('invalid-id');

      expect(result).toBeNull();
    });

    it('should scope lookup by tenant and store when context is provided', async () => {
      const mockOrder = {
        id: 'order-tenant-a',
        customerId: 'customer-1',
        tenantId: 'tenant-a',
        storeId: 'store-a',
        items: [],
        customer: { id: 'customer-1' },
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-tenant-a', { tenantId: 'tenant-a', storeId: 'store-a' });

      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-tenant-a', tenantId: 'tenant-a', storeId: 'store-a' },
        }),
      );
      expect(result?.tenantId).toBe('tenant-a');
    });
  });

  describe('findAll', () => {
    it('should return all orders with pagination', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'CONFIRMED', total: 100 },
        { id: 'order-2', status: 'PENDING', total: 50 },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findAll();

      expect(mockPrismaService.order.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should filter orders by customer ID', async () => {
      const mockOrders = [
        { id: 'order-1', customerId: 'customer-1', status: 'CONFIRMED' },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findAll('customer-1');

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'customer-1',
          }),
        })
      );
      expect(result[0].customerId).toBe('customer-1');
    });

    it('should filter orders by tenant and store context', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'order-tenant-a', tenantId: 'tenant-a', storeId: 'store-a' },
      ]);

      const result = await service.findAll(undefined, { tenantId: 'tenant-a', storeId: 'store-a' });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-a', storeId: 'store-a' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update order status to CONFIRMED', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'PENDING',
        customer: { whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [{ id: 'item-1', product: { ean: '123' } }],
      };

      const mockUpdatedOrder = { ...mockOrder, status: 'CONFIRMED' };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);

      const result = await service.updateStatus('order-123', 'CONFIRMED');

      expect(mockPrismaService.stockReservation.count).toHaveBeenCalledWith({
        where: { orderId: 'order-123', status: 'ACTIVE' },
      });
      expect(mockPrismaService.order.update).toHaveBeenCalled();
      expect(mockInventoryService.consumeOrderReservations).toHaveBeenCalledWith('order-123');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should reject confirmation without active stock reservation', async () => {
      mockPrismaService.stockReservation.count.mockResolvedValue(0);

      await expect(service.updateStatus('order-123', 'CONFIRMED')).rejects.toThrow('reserva de estoque ativa');
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should cancel order with reason in notes', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'PENDING',
        customer: { whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [{ id: 'item-1', product: { ean: '123' } }],
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'CANCELLED',
        notes: 'Cancelled: Out of stock',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);

      const result = await service.updateStatus('order-123', 'CANCELLED', 'Out of stock');

      expect(mockInventoryService.releaseOrderReservations).toHaveBeenCalledWith('order-123', 'Out of stock');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('OMS item operations', () => {
    it('should cancel a single item, recalculate totals and record an event', async () => {
      const mockOrder = {
        id: 'order-oms',
        tenantId: 'tenant_default',
        storeId: 'store_default',
        customerId: 'customer-1',
        subtotal: 30,
        delivery: 5,
        discount: 2,
        total: 33,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        customer: { id: 'customer-1', whatsapp: '5511999999999', email: 'test@test.com', name: 'John' },
        items: [],
      };
      const sourceItem = {
        id: 'item-1',
        tenantId: 'tenant_default',
        storeId: 'store_default',
        orderId: 'order-oms',
        productId: 'prod-1',
        quantity: 2,
        unitPrice: 10,
        subtotal: 20,
        finalUnitPrice: null,
        finalSubtotal: '20',
        status: 'PENDING',
        product: { id: 'prod-1', name: 'Produto 1', ean: '123' },
      };
      const cancelledItem = {
        ...sourceItem,
        status: 'CANCELLED',
        finalSubtotal: '0',
      };
      const recalculatedOrder = {
        ...mockOrder,
        subtotal: 10,
        total: 13,
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.orderItem.findFirst.mockResolvedValue(sourceItem);
      mockPrismaService.orderItem.update.mockResolvedValue(cancelledItem);
      mockPrismaService.orderItem.findMany.mockResolvedValue([
        cancelledItem,
        { id: 'item-2', status: 'PICKED', subtotal: 10, finalSubtotal: '10', product: { id: 'prod-2' } },
      ]);
      mockPrismaService.order.update.mockResolvedValue(recalculatedOrder);

      const result = await service.cancelOrderItem(
        'order-oms',
        'item-1',
        { reason: 'Ruptura', pickerNotes: 'Sem estoque na gondola' },
        { tenantId: 'tenant_default', storeId: 'store_default' },
        { actorType: 'ADMIN', actorId: 'admin-1' },
      );

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cutReason: 'Ruptura',
            pickerNotes: 'Sem estoque na gondola',
          }),
        }),
      );
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-oms' },
          data: { subtotal: 10, total: 13 },
        }),
      );
      expect(mockPrismaService.orderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'order.item_cancelled',
            actorType: 'ADMIN',
            actorId: 'admin-1',
            payload: expect.objectContaining({
              itemId: 'item-1',
              previousStatus: 'PENDING',
              status: 'CANCELLED',
              reason: 'Ruptura',
              total: 13,
            }),
          }),
        }),
      );
      expect(result.order.total).toBe(13);
    });
  });

  describe('delete', () => {
    it('should delete order successfully', async () => {
      const mockDeletedOrder = { id: 'order-123', status: 'DELETED' };

      mockPrismaService.order.delete.mockResolvedValue(mockDeletedOrder);

      const result = await service.remove('order-123');

      expect(mockPrismaService.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
      expect(result.id).toBe('order-123');
    });
  });

  describe('analytics', () => {
    it('should get sales analytics grouped by period', async () => {
      const mockOrders = [
        { id: 'order-1', createdAt: new Date('2024-01-15'), total: 100 },
        { id: 'order-2', createdAt: new Date('2024-01-15'), total: 400 },
        { id: 'order-3', createdAt: new Date('2024-01-14'), total: 300 },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getSalesAnalytics('7days');

      expect(result).toBeDefined();
      expect(mockPrismaService.order.findMany).toHaveBeenCalled();



    });

    it('should calculate revenue analytics with deltas', async () => {
      const mockAggregateResults = [
        { _sum: { total: 1000 } },
        { _sum: { total: 900 } },
        { _sum: { total: 5000 } },
        { _sum: { total: 4800 } },
        { _sum: { total: 20000 } },
        { _sum: { total: 18000 } },
      ];

      for (const result of mockAggregateResults) {
        mockPrismaService.order.aggregate.mockResolvedValueOnce(result);
      }

      const result = await service.getRevenueAnalytics();

      expect(result.today).toBe(1000);
      expect(result.delta.todayVsYesterday).toBeCloseTo(11.11, 1);
    });

    it('should get status analytics with breakdown', async () => {
      const mockGroupedStatuses = [
        { status: 'PENDING', _count: { _all: 5 } },
        { status: 'CONFIRMED', _count: { _all: 8 } },
        { status: 'CANCELLED', _count: { _all: 2 } },
      ];

      mockPrismaService.order.groupBy.mockResolvedValue(mockGroupedStatuses);

      const result = await service.getStatusAnalytics();

      expect(result.total).toBe(15);
      expect(result.data).toHaveLength(3);
    });
  });
});
