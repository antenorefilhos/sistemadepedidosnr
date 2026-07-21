import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Response } from 'express'
import { PrismaService } from '../prisma.service'
import { attachTenantContext, defaultTenantContext, TenantContextRequest, TenantContextSource } from './tenant-context'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID, STORE_ID_HEADERS, TENANT_ID_HEADERS } from './tenant.constants'

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(request: TenantContextRequest, _response: Response, next: NextFunction) {
    const headerTenantId = this.getHeader(request, TENANT_ID_HEADERS)
    const headerStoreId = this.getHeader(request, STORE_ID_HEADERS)

    let tenantId = headerTenantId
    let storeId = headerStoreId
    let source: TenantContextSource = headerTenantId ? 'header' : 'default'

    if (!tenantId) {
      const slug = this.extractSubdomain(request)
      if (slug) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { slug },
          select: { id: true },
        }).catch(() => null)

        if (tenant?.id) {
          tenantId = tenant.id
          source = 'subdomain'
        }
      }
    }

    if (!tenantId) {
      const fallback = defaultTenantContext()
      tenantId = fallback.tenantId
      source = fallback.source
    }

    if (!storeId) {
      storeId = await this.resolveStoreId(tenantId, source)
    }

    attachTenantContext(request, {
      tenantId,
      storeId,
      source,
    })

    next()
  }

  private getHeader(request: TenantContextRequest, names: string[]) {
    for (const name of names) {
      const value = request.headers[name]
      if (Array.isArray(value)) return String(value[0] || '').trim() || undefined
      if (typeof value === 'string') return value.trim() || undefined
    }
    return undefined
  }

  private extractSubdomain(request: TenantContextRequest) {
    const host = String(request.headers.host || '').split(':')[0].toLowerCase()
    if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) return undefined

    const parts = host.split('.').filter(Boolean)
    if (parts.length < 3) return undefined

    const subdomain = parts[0]
    if (['www', 'api', 'admin'].includes(subdomain)) return undefined
    return subdomain
  }

  private async resolveStoreId(tenantId: string, source: TenantContextSource) {
    const configuredStoreId = process.env.DEFAULT_STORE_ID || DEFAULT_STORE_ID
    if (!tenantId || (source === 'default' && tenantId === (process.env.DEFAULT_TENANT_ID || DEFAULT_TENANT_ID))) {
      return configuredStoreId
    }

    const store = await this.prisma.store.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }).catch(() => null)

    return store?.id || configuredStoreId
  }
}
