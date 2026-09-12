import axios from 'axios'
import { AiNotificationService } from './ai-notification.service'

jest.mock('axios')

describe('AiNotificationService — teto diario de notificacao', () => {
  const product = { id: 'p1', ean: '123', name: 'Picanha', price: 100, promotionalPrice: 50 }

  function makeService(recentCustomerIds: string[], allCustomerIds = ['c1', 'c2']) {
    process.env.NVIDIA_API_KEY = 'fake-key'

    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue(recentCustomerIds.map((customerId) => ({ customerId }))),
      },
    }
    const notificationsService = {
      getAllCustomerIds: jest.fn().mockResolvedValue(allCustomerIds),
      broadcastToCustomers: jest.fn().mockResolvedValue(undefined),
    }

    ;(axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({ should_notify: true, title: '🥩 Oferta', body: 'Picanha com desconto' }),
                  },
                },
              ],
            },
          },
        ],
      },
    })

    return { service: new AiNotificationService(prisma as any, notificationsService as any), prisma, notificationsService }
  }

  it('nao notifica de novo cliente que ja recebeu PROMO nas ultimas 24h', async () => {
    const { service, notificationsService } = makeService(['c1', 'c2'])

    const resumo = await service.runCycle()

    expect(notificationsService.broadcastToCustomers).not.toHaveBeenCalled()
    expect(resumo.throttled).toBe(1)
    expect(resumo.notified).toBe(0)
  })

  it('notifica normalmente cliente sem notificacao recente', async () => {
    const { service, notificationsService, prisma } = makeService(['c1'])

    const resumo = await service.runCycle()

    expect(notificationsService.broadcastToCustomers).toHaveBeenCalledWith(['c2'], expect.objectContaining({ type: 'PROMO' }))
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: product.id }, data: { aiNotifiedAt: expect.any(Date) } })
    expect(resumo.notified).toBe(1)
    expect(resumo.throttled).toBe(0)
  })

  it('produto aprovado com todos os clientes no teto vira throttled, nao notified', async () => {
    const { service, notificationsService } = makeService(['c1', 'c2'], ['c1', 'c2'])

    const resumo = await service.runCycle()

    expect(resumo.throttled).toBe(1)
    expect(resumo.notified).toBe(0)
    expect(notificationsService.broadcastToCustomers).not.toHaveBeenCalled()
  })
})
