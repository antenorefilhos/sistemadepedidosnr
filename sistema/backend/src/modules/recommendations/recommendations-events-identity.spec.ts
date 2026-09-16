import { BadRequestException } from '@nestjs/common'
import { RecommendationsController } from './recommendations.controller'

// JON-155 (Auditoria 360, Medium): customerId vinha do body sem prova, e
// storeId do body sobrepunha o contexto no service (ver
// recommendations.service.ts) -- chamador anonimo atribuia evento
// (inclusive PURCHASE) a outro tenant/loja ou a outro customerId.
describe('RecommendationsController.recordEvent (JON-155)', () => {
  const build = () => {
    const recommendations = { recordEvent: jest.fn().mockResolvedValue({ id: 'rec-1' }) }
    const controller = new RecommendationsController(recommendations as never)
    return { controller, recommendations }
  }

  it('com sessao de cliente logada, ignora customerId do body', async () => {
    const { controller, recommendations } = build()
    const req: any = { tenantContext: { tenantId: 'tenant_default', storeId: 'store_default' }, user: { id: 'customer-real', role: 'customer' } }

    await controller.recordEvent({ recommendedProductId: 'prod-1', customerId: 'customer-forjado' }, req)

    expect(recommendations.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'customer-real' }),
      expect.objectContaining({ tenantId: 'tenant_default', storeId: 'store_default' }),
    )
  })

  it('recusa eventType PURCHASE via API publica', async () => {
    const { controller, recommendations } = build()
    const req: any = { tenantContext: { tenantId: 'tenant_default', storeId: 'store_default' } }

    expect(() =>
      controller.recordEvent({ recommendedProductId: 'prod-1', eventType: 'PURCHASE' }, req),
    ).toThrow(BadRequestException)
    expect(recommendations.recordEvent).not.toHaveBeenCalled()
  })
})
