import { TenantAccessGuard } from './tenant-access.guard'

function contextFor(request: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any
}

describe('TenantAccessGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalAllowDefault = process.env.ALLOW_DEFAULT_TENANT_CONTEXT

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalAllowDefault === undefined) {
      delete process.env.ALLOW_DEFAULT_TENANT_CONTEXT
    } else {
      process.env.ALLOW_DEFAULT_TENANT_CONTEXT = originalAllowDefault
    }
  })

  it('rejects private API calls with only default context in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.ALLOW_DEFAULT_TENANT_CONTEXT

    const guard = new TenantAccessGuard()
    const request: any = {
      tenantContext: { tenantId: 'tenant_default', storeId: 'store_default', source: 'default' },
    }

    expect(() => guard.canActivate(contextFor(request))).toThrow('Tenant explicito e obrigatorio')
  })

  it('accepts tenant resolved from authenticated session', () => {
    process.env.NODE_ENV = 'production'

    const guard = new TenantAccessGuard()
    const request: any = {
      tenantContext: { tenantId: 'tenant_default', storeId: 'store_default', source: 'default' },
      user: { id: 'admin-1', tenantId: 'tenant-a', storeId: 'store-a' },
    }

    expect(guard.canActivate(contextFor(request))).toBe(true)
    expect(request.tenantId).toBe('tenant-a')
    expect(request.storeId).toBe('store-a')
  })
})
