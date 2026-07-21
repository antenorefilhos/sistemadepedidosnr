import { useMutation } from '@tanstack/react-query'
import {
  addressesAPI,
  checkoutAPI,
  customersAPI,
  ordersAPI,
  type CreateAddressPayload,
  type CreateCustomerPayload,
  type CreateOrderPayload,
  type CheckoutDeliveryPayload,
} from '../services/api'

export function useCustomers() {
  return useMutation({
    mutationFn: (data: CreateCustomerPayload) => customersAPI.create(data),
  })
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (data: CreateOrderPayload) => ordersAPI.create(data),
  })
}

export function useCreateBackendCart() {
  return useMutation({
    mutationFn: (data: { customerId?: string; deviceId?: string }) => checkoutAPI.createCart(data),
  })
}

export function useAddBackendCartItem() {
  return useMutation({
    mutationFn: ({
      cartId,
      data,
    }: {
      cartId: string
      data: { productId: string; quantity: number; notes?: string; allowSubstitution?: boolean }
    }) => checkoutAPI.addCartItem(cartId, data),
  })
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (data: { cartId: string; idempotencyKey: string; customerId?: string }) =>
      checkoutAPI.createSession(data),
  })
}

export function useQuoteCheckoutSession() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { customerId?: string; couponCode?: string; deliveryAddressId?: string; delivery?: CheckoutDeliveryPayload }
    }) => checkoutAPI.quoteSession(id, data),
  })
}

export function useConfirmCheckoutSession() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        customerId: string
        couponCode?: string
        deliveryAddressId?: string
        delivery?: CheckoutDeliveryPayload
        paymentMethod?: string
        notes?: string
        changeAmount?: string
        deviceId?: string
      }
    }) => checkoutAPI.confirmSession(id, data),
  })
}

export function useCreateAddress() {
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: CreateAddressPayload }) =>
      addressesAPI.create(customerId, data),
  })
}
