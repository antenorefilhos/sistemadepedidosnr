import { ForbiddenException } from '@nestjs/common'

export type RequestUser = {
  id?: string
  role?: string
}

export function isAdminUser(user?: RequestUser) {
  return String(user?.role || '').toLowerCase() === 'admin'
}

export function assertCustomerOwnership(user: RequestUser | undefined, customerId: string) {
  if (isAdminUser(user)) return

  const requesterId = String(user?.id || '')
  if (!requesterId || requesterId !== customerId) {
    throw new ForbiddenException('Acesso negado para recurso de outro cliente')
  }
}
