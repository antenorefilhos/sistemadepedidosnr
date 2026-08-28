import { DeliveryService } from './delivery.service'

/**
 * O fallback 'ASAP' do checkout.
 *
 * O storefront escolhe a janela sozinho (nao ha seletor manual) e so manda
 * 'ASAP' quando nenhuma janela utilizavel existe. A checagem antiga era
 * "existe janela cadastrada?", e isso criava um penhasco: bastava cadastrar
 * janelas uma vez e deixar vencer que a loja parava de vender, exibindo
 * "janela de entrega/retirada invalida", sem ninguem ter errado nada.
 *
 * O que vale agora e existir janela UTILIZAVEL.
 */
const HORA = 60 * 60 * 1000

const build = (slots: unknown[]) => {
  const prisma = {
    fulfillmentSlot: {
      // findFirst busca a janela por id e sempre falha aqui: 'ASAP' nao e id de
      // nada, e e justamente esse "nao achou" que leva ao ramo testado.
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(slots),
    },
  }
  return new DeliveryService(prisma as never, {} as never)
}

const slot = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  status: 'ACTIVE',
  type: 'DELIVERY',
  startsAt: new Date(Date.now() + 3 * HORA),
  endsAt: new Date(Date.now() + 5 * HORA),
  capacityOrders: 10,
  capacityItems: null,
  reservedOrders: 0,
  reservedItems: 0,
  cutoffMinutes: 60,
  ...over,
})

describe('validateSlotCapacity — fallback ASAP', () => {
  it('aceita quando nao ha nenhuma janela cadastrada', async () => {
    const service = build([])
    await expect(service.validateSlotCapacity(undefined, 'ASAP', 'DELIVERY', 1)).resolves.toMatchObject({
      valid: true,
    })
  })

  // O caso que motivou a correcao: janelas existem, todas inuteis.
  it('aceita quando todas as janelas estao lotadas', async () => {
    const service = build([slot({ capacityOrders: 2, reservedOrders: 2 })])
    await expect(service.validateSlotCapacity(undefined, 'ASAP', 'DELIVERY', 1)).resolves.toMatchObject({
      valid: true,
    })
  })

  it('recusa quando existe janela boa -- e diz que falta ESCOLHER, nao que sumiu', async () => {
    const service = build([slot()])
    await expect(service.validateSlotCapacity(undefined, 'ASAP', 'DELIVERY', 1)).resolves.toMatchObject({
      valid: false,
      reason: 'SLOT_REQUIRED',
    })
  })

  it('janela sem ASAP e sem id continua exigindo escolha', async () => {
    const service = build([])
    await expect(service.validateSlotCapacity(undefined, null, 'DELIVERY', 1)).resolves.toMatchObject({
      valid: false,
      reason: 'SLOT_REQUIRED',
    })
  })

  it('so considera janela do tipo pedido (entrega x retirada)', async () => {
    const service = build([])
    await service.validateSlotCapacity(undefined, 'ASAP', 'RETIRADA', 1)
    expect(service['prisma'].fulfillmentSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'PICKUP' }) }),
    )
  })
})
