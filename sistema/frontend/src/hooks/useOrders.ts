import { useQuery, useMutation } from '@tanstack/react-query'
import { ordersAPI, customersAPI, type CreateOrderPayload } from '../services/api'

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED']

export function useOrders(customerId?: string) {
  return useQuery({
    queryKey: ['orders', customerId],
    queryFn: async () => {
      const response = await ordersAPI.getAll(customerId)
      return response.data
    },
    refetchInterval: (data) => {
      const orders = Array.isArray(data) ? data : []
      const hasActive = orders.some((o: { status: string }) => ACTIVE_STATUSES.includes(o.status))
      return hasActive ? 30_000 : false
    },
    staleTime: 20_000,
    enabled: !!customerId,
  })
}

export function useOrderById(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await ordersAPI.getOne(id)
      return response.data
    },
  })
}

export function useCreateOrderMutation() {
  return useMutation({
    mutationFn: (data: CreateOrderPayload) => ordersAPI.create(data),
  })
}

export function useUpdateOrderStatusMutation() {
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersAPI.updateStatus(id, status),
  })
}

export function useCustomersQuery() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersAPI.getAll()
      return response.data
    },
  })
}

export function useCustomerById(id?: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await customersAPI.getOne(id as string)
      return response.data
    },
    enabled: !!id,
  })
}
