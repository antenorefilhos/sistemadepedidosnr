import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRED_MODULE_KEY } from '../decorators/require-module.decorator'

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredModule) return true

    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user) return false

    // Master (role='admin') sempre tem acesso a todos os modulos.
    if (String(user.role).toLowerCase() === 'admin') return true

    const moduleAccess: string[] = Array.isArray(user.moduleAccess) ? user.moduleAccess : []
    return moduleAccess.includes(requiredModule)
  }
}
