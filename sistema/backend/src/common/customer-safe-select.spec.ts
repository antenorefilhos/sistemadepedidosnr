import * as fs from 'fs'
import * as path from 'path'
import { CUSTOMER_SAFE_SELECT } from './customer-safe-select'

describe('CUSTOMER_SAFE_SELECT (JON-71)', () => {
  it('nunca projeta password/resetTokenHash/resetTokenExpiresAt', () => {
    expect(CUSTOMER_SAFE_SELECT).not.toHaveProperty('password')
    expect(CUSTOMER_SAFE_SELECT).not.toHaveProperty('resetTokenHash')
    expect(CUSTOMER_SAFE_SELECT).not.toHaveProperty('resetTokenExpiresAt')
  })

  it('mantem os dados operacionais usados pelos modulos que a consomem', () => {
    expect(CUSTOMER_SAFE_SELECT).toMatchObject({ id: true, name: true, whatsapp: true, email: true })
  })

  it('nenhum modulo operacional (fora do fluxo de auth) volta a incluir customer:true cru', () => {
    const root = path.join(__dirname, '..', 'modules')
    const targets = [
      'orders/orders.service.ts',
      'picking/picking.service.ts',
      'delivery/driver.controller.ts',
      'public-api/public-api.service.ts',
      'business/business.service.ts',
      'integrations/integrations.service.ts',
      'integrations/order-orchestration.service.ts',
    ]
    for (const rel of targets) {
      const content = fs.readFileSync(path.join(root, rel), 'utf8')
      expect(content).not.toMatch(/customer:\s*true/)
    }
  })
})
