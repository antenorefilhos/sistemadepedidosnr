import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const mockOrdersService = {
  create: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
  findAll: jest.fn(),
  getRevenueAnalytics: jest.fn(),
  getSalesAnalytics: jest.fn(),
  getStatusAnalytics: jest.fn(),
  getCategoryRevenue: jest.fn(),
  getRevenueHeatmap: jest.fn(),
};

describe('Orders Controller - Integration Tests', () => {
  let controller: OrdersController;
  let service: OrdersService;
  const customerRequest: any = {
    user: { id: 'customer-1', role: 'customer' },
    ip: '127.0.0.1',
    headers: {},
    tenantContext: { tenantId: 'tenant_default', storeId: 'store_default', source: 'default' as const },
    tenantId: 'tenant_default',
    storeId: 'store_default',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /orders (Create Order)', () => {
    it('should create order with multiple items and correct pricing', async () => {
      const createOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-multicart',
        items: [
          { productId: 'prod-1', quantity: 2 }, // 2 * 15 = 30
          { productId: 'prod-2', quantity: 3 }, // 3 * 10 = 30
        ],
        deliveryAddressId: 'addr-1',
        paymentMethod: 'PIX',
      };

      const mockResult = {
        order: {
          id: 'order-123',
          customerId: 'customer-1',
          subtotal: 60,
          delivery: 15,
          discount: 0,
          total: 75,
          status: 'PENDING',
          paymentMethod: 'PIX',
          items: createOrderDto.items,
        },
        whatsapp: { url: 'https://wa.me/message' },
      };

      mockOrdersService.create.mockResolvedValue(mockResult);

      const result = await controller.create(createOrderDto as any, customerRequest);

      expect(mockOrdersService.create).toHaveBeenCalledWith({
        ...createOrderDto,
        tenantId: 'tenant_default',
        storeId: 'store_default',
        clientIp: '127.0.0.1',
      });
      expect(result.order.id).toBe('order-123');
      expect(result.order.status).toBe('PENDING');
      expect(result.order.subtotal).toBe(60);
      expect(result.order.total).toBe(75);
      expect(result.whatsapp).toBeDefined();
    });

    it('should store change amount for DINHEIRO payment', async () => {
      const createOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-cash',
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryAddressId: 'addr-1',
        paymentMethod: 'DINHEIRO',
        changeAmount: 50,
      };

      const mockResult = {
        order: {
          id: 'order-cash',
          customerId: 'customer-1',
          subtotal: 25,
          delivery: 5,
          discount: 0,
          total: 30,
          status: 'PENDING',
          paymentMethod: 'DINHEIRO',
          notes: 'Troco para: 50',
        },
        whatsapp: { url: 'https://wa.me/message' },
      };

      mockOrdersService.create.mockResolvedValue(mockResult);

      const result = await controller.create(createOrderDto as any, customerRequest);

      expect(result.order.notes).toContain('Troco para: 50');
    });

    it('should apply coupon discount on creation', async () => {
      const createOrderDto = {
        customerId: 'customer-1',
        idempotencyKey: 'idem-coupon',
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryAddressId: 'addr-1',
        paymentMethod: 'PIX',
        couponCode: 'SAVE10',
      };

      const mockResult = {
        order: {
          id: 'order-coupon',
          customerId: 'customer-1',
          subtotal: 100,
          delivery: 10,
          discount: 10,
          total: 100,
          status: 'PENDING',
          notes: 'Cupom: SAVE10',
        },
        whatsapp: { url: 'https://wa.me/message' },
      };

      mockOrdersService.create.mockResolvedValue(mockResult);

      const result = await controller.create(createOrderDto as any, customerRequest);

      expect(result.order.discount).toBe(10);
      expect(result.order.total).toBe(100);
    });
  });

  describe('GET /orders/:id', () => {
    it('should retrieve order by ID', async () => {
      const mockOrder = {
        id: 'order-123',
        customerId: 'customer-1',
        subtotal: 100,
        delivery: 10,
        discount: 5,
        total: 105,
        status: 'CONFIRMED',
        paymentMethod: 'PIX',
        items: [{ productId: 'prod-1', quantity: 2, unitPrice: 50, subtotal: 100 }],
        createdAt: new Date(),
      };

      mockOrdersService.findOne.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-123', customerRequest);

      expect(mockOrdersService.findOne).toHaveBeenCalledWith('order-123', {
        tenantId: 'tenant_default',
        storeId: 'store_default',
        source: 'default',
      });
      expect(result.id).toBe('order-123');
      expect(result.status).toBe('CONFIRMED');
      expect(result.total).toBe(105);
    });

    it('should reject customer reading another customer order', async () => {
      mockOrdersService.findOne.mockResolvedValue({
        id: 'order-foreign',
        customerId: 'customer-2',
      });

      await expect(controller.findOne('order-foreign', customerRequest)).rejects.toThrow('Acesso negado');
    });
  });

  describe('POST /orders ownership', () => {
    it('should reject customer creating order for another customer', async () => {
      const createOrderDto = {
        customerId: 'customer-2',
        idempotencyKey: 'idem-foreign',
        items: [{ productId: 'prod-1', quantity: 1 }],
        paymentMethod: 'PIX',
      };

      await expect(controller.create(createOrderDto as any, customerRequest)).rejects.toThrow('Acesso negado');
      expect(mockOrdersService.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('should update order status', async () => {
      const updateDto = { status: 'CONFIRMED' };

      const mockUpdatedOrder = {
        id: 'order-123',
        customerId: 'customer-1',
        status: 'CONFIRMED',
        total: 105,
      };

      mockOrdersService.updateStatus.mockResolvedValue(mockUpdatedOrder);

      const result = await controller.updateStatus('order-123', updateDto as any);

      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith('order-123', 'CONFIRMED', undefined);
      expect(result.status).toBe('CONFIRMED');
    });

    it('should cancel order and return reason', async () => {
      const updateDto = { status: 'CANCELLED', reason: 'Out of stock' };

      const mockUpdatedOrder = {
        id: 'order-123',
        customerId: 'customer-1',
        status: 'CANCELLED',
        notes: 'Out of stock',
        total: 105,
      };

      mockOrdersService.updateStatus.mockResolvedValue(mockUpdatedOrder);

      const result = await controller.updateStatus('order-123', updateDto as any);

      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith('order-123', 'CANCELLED', 'Out of stock');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('Analytics - Revenue', () => {
    it('should return revenue analytics with trends', async () => {
      const mockAnalytics = {
        today: 1000,
        yesterday: 900,
        week: 5000,
        previousWeek: 4800,
        month: 20000,
        previousMonth: 18000,
        delta: {
          todayVsYesterday: 11.11,
          weekVsPreviousWeek: 4.17,
          monthVsPreviousMonth: 11.11,
        },
      };

      mockOrdersService.getRevenueAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getRevenueAnalytics();

      expect(result.today).toBe(1000);
      expect(result.delta.todayVsYesterday).toBeCloseTo(11.11, 1);
      expect(result.delta.monthVsPreviousMonth).toBeCloseTo(11.11, 1);
    });
  });

  describe('Analytics - Sales', () => {
    it('should return sales analytics for period', async () => {
      const mockSalesData = [
        { date: '2026-05-01', total: 500, orders: 10 },
        { date: '2026-05-02', total: 600, orders: 12 },
        { date: '2026-05-03', total: 400, orders: 8 },
      ];

      mockOrdersService.getSalesAnalytics.mockResolvedValue(mockSalesData);

      const result = await controller.getSalesAnalytics('week');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2026-05-01');
      expect(result[0].total).toBe(500);
    });
  });

  describe('Analytics - Status', () => {
    it('should return order status distribution', async () => {
      const mockStatusData = {
        total: 30,
        data: [
          { status: 'PENDING', count: 10 },
          { status: 'CONFIRMED', count: 12 },
          { status: 'COMPLETED', count: 8 },
        ],
      };

      mockOrdersService.getStatusAnalytics.mockResolvedValue(mockStatusData);

      const result = await controller.getStatusAnalytics();

      expect(result.total).toBe(30);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].status).toBe('PENDING');
    });
  });

  describe('Analytics - Category Revenue', () => {
    it('should return revenue grouped by product category', async () => {
      const mockCategoryData = [
        { category: 'Frutas', revenue: 1500, orders: 20, avgOrderValue: 75 },
        { category: 'Verduras', revenue: 1200, orders: 25, avgOrderValue: 48 },
        { category: 'Carnes', revenue: 3000, orders: 15, avgOrderValue: 200 },
      ];

      mockOrdersService.getCategoryRevenue.mockResolvedValue(mockCategoryData);

      const result = await controller.getCategoryRevenue();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[2].category).toBe('Carnes');
      expect(result[2].revenue).toBe(3000);
    });
  });
});
