import { AddressesService } from './addresses.service'
import { PrismaService } from '../../common/prisma.service'

const mockAddress = {
  id: 'addr-1',
  customerId: 'customer-1',
  street: 'Rua A',
  number: '123',
  complement: null,
  neighborhood: 'Centro',
  city: 'Sao Paulo',
  state: 'SP',
  zipCode: '01001000',
  isDefault: false,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
}

function buildPrismaMock() {
  const prisma: any = {
    address: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(prisma)),
  }
  return prisma
}

describe('AddressesService', () => {
  let service: AddressesService
  let prisma: any

  beforeEach(() => {
    prisma = buildPrismaMock()
    service = new AddressesService(prisma as PrismaService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('lists addresses ordered by default first then most recent', async () => {
      prisma.address.findMany.mockResolvedValue([mockAddress])

      const result = await service.list('customer-1')

      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })
      expect(result).toEqual([mockAddress])
    })
  })

  describe('create', () => {
    it('creates a new address when no duplicate exists', async () => {
      prisma.address.findMany.mockResolvedValue([mockAddress])
      prisma.address.create.mockResolvedValue({ ...mockAddress, id: 'addr-2' })

      const payload = {
        street: 'Rua B',
        number: '999',
        neighborhood: 'Jardim',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '02000000',
      }

      const result = await service.create('customer-1', payload)

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: { ...payload, customerId: 'customer-1' },
      })
      expect(result).toEqual({ ...mockAddress, id: 'addr-2' })
    })

    it('reuses an existing address ignoring case and extra spaces', async () => {
      const existing = {
        ...mockAddress,
        id: 'addr-dup',
        street: '  RUA  a ',
        number: ' 123 ',
        neighborhood: ' CENTRO ',
        zipCode: ' 01001-000 ',
        isDefault: false,
      }
      prisma.address.findFirst.mockResolvedValue(existing)
      prisma.address.update.mockResolvedValue(existing)

      const payload = {
        street: 'rua a',
        number: '123',
        neighborhood: 'centro',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01001000',
        isDefault: false,
      }

      const result = await service.create('customer-1', payload)

      expect(prisma.address.create).not.toHaveBeenCalled()
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-dup' },
        data: { complement: null, city: 'Sao Paulo', state: 'SP' },
      })
      expect(result).toEqual(existing)
    })

    it('promotes an existing duplicate to default when requested', async () => {
      const existing = { ...mockAddress, id: 'addr-dup', isDefault: false }
      prisma.address.findFirst.mockResolvedValue(existing)
      prisma.address.update.mockResolvedValue({ ...existing, isDefault: true })

      const payload = {
        street: 'Rua A',
        number: '123',
        neighborhood: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01001000',
        isDefault: true,
      }

      const result = await service.create('customer-1', payload)

      expect(prisma.address.create).not.toHaveBeenCalled()
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', isDefault: true, id: { not: 'addr-dup' } },
        data: { isDefault: false },
      })
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-dup' },
        data: { complement: null, city: 'Sao Paulo', state: 'SP', isDefault: true },
      })
      expect(result).toEqual({ ...existing, isDefault: true })
    })

    it('clears previous default when creating a new default address', async () => {
      prisma.address.findFirst.mockResolvedValue(null)
      prisma.address.create.mockResolvedValue({ ...mockAddress, id: 'addr-2', isDefault: true })

      const payload = {
        street: 'Rua C',
        number: '55',
        neighborhood: 'Vila',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '03000000',
        isDefault: true,
      }

      await service.create('customer-1', payload)

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', isDefault: true },
        data: { isDefault: false },
      })
    })
  })

  describe('update', () => {
    it('throws NotFound when address does not belong to customer', async () => {
      prisma.address.findFirst.mockResolvedValue(null)

      await expect(
        service.update('customer-1', 'addr-x', { number: '999' }),
      ).rejects.toThrow('Endereco nao encontrado.')

      expect(prisma.address.update).not.toHaveBeenCalled()
    })

    it('updates informed fields', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress)
      prisma.address.update.mockResolvedValue({ ...mockAddress, number: '999' })

      const result = await service.update('customer-1', 'addr-1', { number: '999' })

      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: { number: '999' },
      })
      expect(result.number).toBe('999')
    })

    it('clears other defaults when setting this address as default', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress)
      prisma.address.update.mockResolvedValue({ ...mockAddress, isDefault: true })

      await service.update('customer-1', 'addr-1', { isDefault: true })

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', id: { not: 'addr-1' }, isDefault: true },
        data: { isDefault: false },
      })
    })
  })

  describe('delete', () => {
    it('throws NotFound when address does not belong to customer', async () => {
      prisma.address.findFirst.mockResolvedValue(null)

      await expect(service.delete('customer-1', 'addr-x')).rejects.toThrow('Endereco nao encontrado.')

      expect(prisma.address.delete).not.toHaveBeenCalled()
    })

    it('deletes a non-default address without promoting another', async () => {
      prisma.address.findFirst.mockResolvedValue({ ...mockAddress, isDefault: false })

      await service.delete('customer-1', 'addr-1')

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } })
      expect(prisma.address.findFirst).toHaveBeenCalledTimes(1)
      expect(prisma.address.update).not.toHaveBeenCalled()
    })

    it('promotes most recent remaining address when deleting the default one', async () => {
      const defaultAddress = { ...mockAddress, id: 'addr-1', isDefault: true }
      prisma.address.findFirst.mockResolvedValueOnce(defaultAddress)
      const next = { ...mockAddress, id: 'addr-2', isDefault: false }
      prisma.address.findFirst.mockResolvedValueOnce(next)
      prisma.address.update.mockResolvedValue({ ...next, isDefault: true })

      await service.delete('customer-1', 'addr-1')

      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } })
      expect(prisma.address.findFirst).toHaveBeenLastCalledWith({
        where: { customerId: 'customer-1' },
        orderBy: { createdAt: 'desc' },
      })
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-2' },
        data: { isDefault: true },
      })
    })

    it('does not promote when no address remains', async () => {
      const defaultAddress = { ...mockAddress, id: 'addr-1', isDefault: true }
      prisma.address.findFirst.mockResolvedValueOnce(defaultAddress)
      prisma.address.findFirst.mockResolvedValueOnce(null)

      await service.delete('customer-1', 'addr-1')

      expect(prisma.address.update).not.toHaveBeenCalled()
    })
  })

  describe('setDefault', () => {
    it('throws NotFound when address does not belong to customer', async () => {
      prisma.address.findFirst.mockResolvedValue(null)

      await expect(service.setDefault('customer-1', 'addr-x')).rejects.toThrow('Endereco nao encontrado.')

      expect(prisma.address.update).not.toHaveBeenCalled()
    })

    it('clears all defaults and sets the target as default', async () => {
      prisma.address.findFirst.mockResolvedValue(mockAddress)
      prisma.address.update.mockResolvedValue({ ...mockAddress, isDefault: true })

      const result = await service.setDefault('customer-1', 'addr-1')

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', isDefault: true, id: { not: 'addr-1' } },
        data: { isDefault: false },
      })
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: { isDefault: true },
      })
      expect(result.isDefault).toBe(true)
    })
  })
})