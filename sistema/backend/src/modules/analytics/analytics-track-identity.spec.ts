import { BadRequestException } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'

// JON-155 (Auditoria 360, Medium): tenantId/storeId/customerId vinham do
// body sem prova -- chamador anonimo atribuia evento (inclusive PURCHASE)
// a outro tenant ou a outro customerId.
describe('AnalyticsController.track (JON-155)', () => {
  const build = () => {
    const analyticsService = { trackEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }) }
    const controller = new AnalyticsController(analyticsService as never, {} as never, {} as never)
    return { controller, analyticsService }
  }

  it('ignora tenantId/storeId do body -- sempre usa o contexto do request', async () => {
    const { controller, analyticsService } = build()
    const req: any = { tenantContext: { tenantId: 'tenant_real', storeId: 'store_real' }, user: undefined }

    await controller.track({ type: 'PAGE_VIEW', tenantId: 'tenant_forjado', storeId: 'store_forjado' }, req)

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant_real', storeId: 'store_real' }),
    )
  })

  it('com sessao de cliente logada, ignora customerId do body', async () => {
    const { controller, analyticsService } = build()
    const req: any = { tenantContext: { tenantId: 'tenant_default', storeId: 'store_default' }, user: { id: 'customer-real', role: 'customer' } }

    await controller.track({ type: 'PAGE_VIEW', customerId: 'customer-forjado' }, req)

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'customer-real' }),
    )
  })

  it('recusa PURCHASE/CHECKOUT_COMPLETED via API publica', async () => {
    const { controller, analyticsService } = build()
    const req: any = { tenantContext: { tenantId: 'tenant_default', storeId: 'store_default' } }

    await expect(controller.track({ type: 'PURCHASE' }, req)).rejects.toBeInstanceOf(BadRequestException)
    await expect(controller.track({ type: 'CHECKOUT_COMPLETED' }, req)).rejects.toBeInstanceOf(BadRequestException)
    expect(analyticsService.trackEvent).not.toHaveBeenCalled()
  })
})
