import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../prisma.service'
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator'
import { getTenantContext, TenantContextRequest } from '../tenant/tenant-context'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<TenantContextRequest>()
    const tenantContext = getTenantContext(request)
    const user = request.user

    if (!user?.id || !tenantContext.tenantId) {
      throw new ForbiddenException('Permissao insuficiente')
    }

    const tokenPermissions = new Set((user.permissions || []).map((permission) => permission.toLowerCase()))
    if (requiredPermissions.every((permission) => tokenPermissions.has(permission.toLowerCase()))) {
      return true
    }

    const accessRows = await this.prisma.userStoreAccess.findMany({
      where: {
        userId: user.id,
        ...(tenantContext.storeId ? { storeId: tenantContext.storeId } : { store: { tenantId: tenantContext.tenantId } }),
        role: {
          tenantId: tenantContext.tenantId,
          permissions: {
            some: {
              permission: {
                key: { in: requiredPermissions },
              },
            },
          },
        },
      },
      select: {
        role: {
          select: {
            permissions: {
              where: {
                permission: {
                  key: { in: requiredPermissions },
                },
              },
              select: {
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    })

    const granted = new Set<string>()
    for (const access of accessRows) {
      for (const permission of access.role.permissions) {
        granted.add(permission.permission.key.toLowerCase())
      }
    }

    if (requiredPermissions.every((permission) => granted.has(permission.toLowerCase()))) {
      return true
    }

    throw new ForbiddenException('Permissao insuficiente')
  }
}
