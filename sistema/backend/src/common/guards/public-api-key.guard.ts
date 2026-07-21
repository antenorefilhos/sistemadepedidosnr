import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { API_SCOPE_KEY } from '../decorators/require-api-scope.decorator'
import { PublicApiService } from '../../modules/public-api/public-api.service'

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly publicApi: PublicApiService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const requiredScope = this.reflector.getAllAndOverride<string>(API_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const apiKey = request.headers['x-api-key'] || request.headers.authorization
    const client = await this.publicApi.authenticate(
      Array.isArray(apiKey) ? apiKey[0] : apiKey,
      requiredScope,
      {
        path: request.originalUrl || request.url,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    )
    request.publicApiClient = client
    return true
  }
}
