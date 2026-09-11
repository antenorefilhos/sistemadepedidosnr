import { GUARDS_METADATA } from '@nestjs/common/constants'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { PricingController } from './pricing.controller'

describe('PricingController security metadata', () => {
  it('locks POST /pricing/quote to admin (JON-43)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PricingController.prototype.quote) || []
    const roles = Reflect.getMetadata(ROLES_KEY, PricingController.prototype.quote) || []
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]))
    expect(roles).toEqual(['admin'])
  })
})
