import { ForbiddenException } from '@nestjs/common'
import { CustomersController } from './customers.controller'

// JON-183: badge "Cliente Clube Antenor" no carrinho -- consulta automatica
// pro cliente logado, usando o CPF ja cadastrado. Mesmo ownership check do
// GET /customers/:id (findOne).
describe('CustomersController.getFidelidade (JON-183)', () => {
  const buildController = (overrides: { isConfigured?: boolean } = {}) => {
    const customersService = {
      findOne: jest.fn(),
    }
    const antenorApi = {
      isConfigured: jest.fn().mockReturnValue(overrides.isConfigured ?? true),
      getFidelidade: jest.fn(),
    }
    const controller = new CustomersController(customersService as never, antenorApi as never)
    return { controller, customersService, antenorApi }
  }

  const request = (userId: string, role = 'customer') => ({
    user: { id: userId, role },
    tenantContext: { tenantId: 'tenant_default', storeId: 'store_default', source: 'default' as const },
  }) as never

  it('bloqueia cliente consultando fidelidade de outro cliente', async () => {
    const { controller } = buildController()
    await expect(controller.getFidelidade('customer-2', request('customer-1'))).rejects.toThrow(ForbiddenException)
  })

  it('admin pode consultar fidelidade de qualquer cliente', async () => {
    const { controller, customersService, antenorApi } = buildController()
    customersService.findOne.mockResolvedValue({ id: 'customer-2', cpf: '11144477735' })
    antenorApi.getFidelidade.mockResolvedValue({ clubeFidelidade: true, categoria: { descricao: 'Ouro' } })

    const result = await controller.getFidelidade('customer-2', request('admin-1', 'admin'))

    expect(antenorApi.getFidelidade).toHaveBeenCalledWith('11144477735')
    expect(result).toEqual({ clubeFidelidade: true, categoria: { descricao: 'Ouro' } })
  })

  it('cliente sem CPF cadastrado nao chega a consultar a AntenorApi', async () => {
    const { controller, customersService, antenorApi } = buildController()
    customersService.findOne.mockResolvedValue({ id: 'customer-1', cpf: null })

    const result = await controller.getFidelidade('customer-1', request('customer-1'))

    expect(antenorApi.getFidelidade).not.toHaveBeenCalled()
    expect(result).toEqual({ clubeFidelidade: false })
  })

  it('AntenorApi nao configurada devolve clubeFidelidade false sem chamar a API', async () => {
    const { controller, customersService, antenorApi } = buildController({ isConfigured: false })
    customersService.findOne.mockResolvedValue({ id: 'customer-1', cpf: '11144477735' })

    const result = await controller.getFidelidade('customer-1', request('customer-1'))

    expect(antenorApi.getFidelidade).not.toHaveBeenCalled()
    expect(result).toEqual({ clubeFidelidade: false })
  })
})
