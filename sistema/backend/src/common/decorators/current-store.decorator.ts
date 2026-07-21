import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { getTenantContext, TenantContextRequest } from '../tenant/tenant-context'

export const CurrentStore = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<TenantContextRequest>()
  return getTenantContext(request).storeId
})
