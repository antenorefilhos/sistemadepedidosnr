import { Test, TestingModule } from '@nestjs/testing'
import { AddressesController } from './addresses.controller'
import { AddressesService } from './addresses.service'
import { ViaCEPService } from '../../common/services/via-cep.service'

const mockAddressesService = {
  create: jest.fn(),
}

const mockViaCepService = {
  getAddress: jest.fn(),
}

describe('AddressesController', () => {
  let controller: AddressesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        { provide: AddressesService, useValue: mockAddressesService },
        { provide: ViaCEPService, useValue: mockViaCepService },
      ],
    }).compile()

    controller = module.get<AddressesController>(AddressesController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects customer adding address to another customer', async () => {
    await expect(
      controller.addAddress(
        'customer-2',
        {
          street: 'Rua A',
          number: '123',
          neighborhood: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
          zipCode: '01001000',
        },
        { user: { id: 'customer-1', role: 'customer' } },
      ),
    ).rejects.toThrow('Acesso negado')

    expect(mockAddressesService.create).not.toHaveBeenCalled()
  })

  it('allows admin adding address for any customer', async () => {
    const payload = {
      street: 'Rua A',
      number: '123',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001000',
    }
    mockAddressesService.create.mockResolvedValue({ id: 'addr-1', ...payload })

    await controller.addAddress('customer-2', payload, { user: { id: 'admin-1', role: 'admin' } })

    expect(mockAddressesService.create).toHaveBeenCalledWith('customer-2', payload)
  })
})
