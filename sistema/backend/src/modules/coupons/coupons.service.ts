import { Injectable } from '@nestjs/common'
import { PricingService } from '../pricing/pricing.service'

export type CouponValidationResult = {
  valid: boolean
  code: string
  message: string
  discountAmount: number
}

@Injectable()
export class CouponsService {
  constructor(private readonly pricingService: PricingService) {}

  validateCoupon(code: string, subtotal: number, customerId?: string): Promise<CouponValidationResult> {
    return this.pricingService.validateCoupon(code, Number(subtotal || 0), { customerId })
  }
}
