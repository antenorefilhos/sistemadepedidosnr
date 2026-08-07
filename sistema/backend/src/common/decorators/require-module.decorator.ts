import { SetMetadata } from '@nestjs/common'

export const REQUIRED_MODULE_KEY = 'required_module'

/** Exige que a conta logada tenha acesso ao app informado ('admin' | 'picking' | 'delivery'). */
export const RequireModule = (module: string) => SetMetadata(REQUIRED_MODULE_KEY, module)
