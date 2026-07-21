import { TenantContextMiddleware } from './tenant-context.middleware'

describe('TenantContextMiddleware', () => {
  const prisma = {
    tenant: { findUnique: jest.fn() },
    store: { findFirst: jest.fn() },
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('resolves tenant and store from internal headers', async () => {
    const middleware = new TenantContextMiddleware(prisma)
    const request = {
      headers: {
        'x-tenant-id': 'tenant-a',
        'x-store-id': 'store-a',
      },
    } as any
    const next = jest.fn()

    await middleware.use(request, {} as any, next)

    expect(request.tenantContext).toEqual({ tenantId: 'tenant-a', storeId: 'store-a', source: 'header' })
    expect(next).toHaveBeenCalled()
  })

  it('falls back to the default single-store context', async () => {
    const middleware = new TenantContextMiddleware(prisma)
    const request = { headers: { host: 'localhost:3001' } } as any
    const next = jest.fn()

    await middleware.use(request, {} as any, next)

    expect(request.tenantContext).toEqual({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      source: 'default',
    })
    expect(next).toHaveBeenCalled()
  })
})
