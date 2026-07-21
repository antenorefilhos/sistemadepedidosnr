import { SetMetadata } from '@nestjs/common'

export const API_SCOPE_KEY = 'api_scope'
export const RequireApiScope = (scope: string) => SetMetadata(API_SCOPE_KEY, scope)
