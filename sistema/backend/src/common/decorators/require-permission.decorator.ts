import { SetMetadata } from '@nestjs/common'

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions'
export const RequirePermission = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions)
