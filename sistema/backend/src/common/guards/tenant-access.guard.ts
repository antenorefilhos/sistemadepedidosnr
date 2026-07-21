import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { attachTenantContext, getTenantContext, TenantContextRequest } from '../tenant/tenant-context'

@Injectable()
export class TenantAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantContextRequest>()
    const tenantContext = getTenantContext(request)

    if (!tenantContext.tenantId) {
      throw new ForbiddenException('Contexto de tenant nao resolvido')
    }

    const defaultContextIsAllowed =
      String(process.env.ALLOW_DEFAULT_TENANT_CONTEXT || '').toLowerCase() === 'true' ||
      String(process.env.NODE_ENV || '').toLowerCase() !== 'production'

    if (tenantContext.source === 'default' && !request.user?.tenantId && !defaultContextIsAllowed) {
      throw new ForbiddenException('Tenant explicito e obrigatorio para API privada')
    }

    attachTenantContext(request, tenantContext)
    return true
  }
}
