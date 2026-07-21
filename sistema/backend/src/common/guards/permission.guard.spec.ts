import { PermissionGuard } from './permission.guard'

function contextFor(request: any) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any
}

describe('PermissionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  }
  const prisma = {
    userStoreAccess: { findMany: jest.fn() },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    reflector.getAllAndOverride.mockReturnValue(['pricing.write'])
  })

  it('rejects a user without the required pricing permission', async () => {
    prisma.userStoreAccess.findMany.mockResolvedValue([])
    const guard = new PermissionGuard(reflector as any, prisma as any)

    await expect(
      guard.canActivate(contextFor({
        user: { id: 'admin-1' },
        tenantContext: { tenantId: 'tenant-a', storeId: 'store-a', source: 'header' },
      })),
    ).rejects.toThrow('Permissao insuficiente')
  })

  it('allows a user with the required permission from store role access', async () => {
    prisma.userStoreAccess.findMany.mockResolvedValue([
      {
        role: {
          permissions: [{ permission: { key: 'pricing.write' } }],
        },
      },
    ])
    const guard = new PermissionGuard(reflector as any, prisma as any)

    await expect(
      guard.canActivate(contextFor({
        user: { id: 'admin-1' },
        tenantContext: { tenantId: 'tenant-a', storeId: 'store-a', source: 'header' },
      })),
    ).resolves.toBe(true)
  })
})
