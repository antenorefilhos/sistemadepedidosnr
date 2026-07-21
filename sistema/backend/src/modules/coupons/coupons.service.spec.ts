import { CouponsService } from './coupons.service'
import { PricingService } from '../pricing/pricing.service'

const mockPricingService = {
  validateCoupon: jest.fn(),
}

describe('CouponsService', () => {
  let service: CouponsService

  beforeEach(() => {
    service = new CouponsService(mockPricingService as unknown as PricingService)
    mockPricingService.validateCoupon.mockResolvedValue({
      valid: true,
      code: 'BEMVINDO10',
      message: 'Cupom aplicado com sucesso.',
      discountAmount: 10,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('delegates validation to pricing service', async () => {
    const result = await service.validateCoupon('bemvindo10', 100, 'customer-1')

    expect(mockPricingService.validateCoupon).toHaveBeenCalledWith('bemvindo10', 100, { customerId: 'customer-1' })
    expect(result.discountAmount).toBe(10)
  })
})
