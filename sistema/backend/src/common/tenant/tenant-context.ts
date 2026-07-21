import { Request } from 'express'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from './tenant.constants'

export type TenantContextSource = 'header' | 'subdomain' | 'session' | 'default'

export type RequestUserWithTenant = {
  id?: string
  email?: string
  name?: string
  role?: string
  tenantId?: string
  storeId?: string
  permissions?: string[]
}

export type TenantContext = {
  tenantId: string
  storeId: string
  source: TenantContextSource
}

export type TenantContextRequest = Request & {
  tenantId?: string
  storeId?: string
  tenantContext?: TenantContext
  user?: RequestUserWithTenant
}

export function defaultTenantContext(): TenantContext {
  return {
    tenantId: process.env.DEFAULT_TENANT_ID || DEFAULT_TENANT_ID,
    storeId: process.env.DEFAULT_STORE_ID || DEFAULT_STORE_ID,
    source: 'default',
  }
}

export function attachTenantContext(request: TenantContextRequest, context: TenantContext) {
  request.tenantContext = context
  request.tenantId = context.tenantId
  request.storeId = context.storeId
}

export function getTenantContext(request: TenantContextRequest): TenantContext {
  const fallback = request.tenantContext || defaultTenantContext()
  const tenantId = request.user?.tenantId || request.tenantId || fallback.tenantId
  const storeId = request.user?.storeId || request.storeId || fallback.storeId
  const source = request.user?.tenantId ? 'session' : fallback.source

  return { tenantId, storeId, source }
}

export function tenantStoreWhere(context?: Partial<TenantContext>) {
  const where: { tenantId?: string; storeId?: string } = {}
  if (context?.tenantId) where.tenantId = context.tenantId
  if (context?.storeId) where.storeId = context.storeId
  return where
}
