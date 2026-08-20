import { Test, TestingModule } from '@nestjs/testing'
import { AddressesController } from './addresses.controller'
import { AddressesService } from './addresses.service'
import { ViaCEPService } from '../../common/services/via-cep.service'

const mockAddressesService = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  setDefault: jest.fn(),
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

  it('rejects customer updating address of another customer', async () => {
    await expect(
      controller.updateAddress(
        'customer-2',
        'addr-9',
        { number: '999' },
        { user: { id: 'customer-1', role: 'customer' } },
      ),
    ).rejects.toThrow('Acesso negado')
    expect(mockAddressesService.update).not.toHaveBeenCalled()
  })

  it('allows customer updating own address', async () => {
    mockAddressesService.update.mockResolvedValue({ id: 'addr-1', number: '999' })
    await controller.updateAddress(
      'customer-1',
      'addr-1',
      { number: '999' },
      { user: { id: 'customer-1', role: 'customer' } },
    )
    expect(mockAddressesService.update).toHaveBeenCalledWith('customer-1', 'addr-1', { number: '999' })
  })

  it('rejects customer deleting address of another customer', async () => {
    await expect(
      controller.deleteAddress('customer-2', 'addr-9', { user: { id: 'customer-1', role: 'customer' } }),
    ).rejects.toThrow('Acesso negado')
    expect(mockAddressesService.delete).not.toHaveBeenCalled()
  })

  it('allows customer deleting own address', async () => {
    mockAddressesService.delete.mockResolvedValue({ id: 'addr-1' })
    await controller.deleteAddress('customer-1', 'addr-1', { user: { id: 'customer-1', role: 'customer' } })
    expect(mockAddressesService.delete).toHaveBeenCalledWith('customer-1', 'addr-1')
  })

  it('rejects customer setting default address of another customer', async () => {
    await expect(
      controller.setDefaultAddress('customer-2', 'addr-9', { user: { id: 'customer-1', role: 'customer' } }),
    ).rejects.toThrow('Acesso negado')
    expect(mockAddressesService.setDefault).not.toHaveBeenCalled()
  })

  it('allows customer setting own address as default', async () => {
    mockAddressesService.setDefault.mockResolvedValue({ id: 'addr-1', isDefault: true })
    await controller.setDefaultAddress('customer-1', 'addr-1', { user: { id: 'customer-1', role: 'customer' } })
    expect(mockAddressesService.setDefault).toHaveBeenCalledWith('customer-1', 'addr-1')
  })
})