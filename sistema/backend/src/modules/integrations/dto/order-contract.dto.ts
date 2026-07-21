export interface InternalOrderCustomerContract {
  id: string
  cpf?: string | null
  name: string | null
  whatsapp: string
  email: string | null
}

export interface InternalOrderItemContract {
  productId: string
  productName: string | null
  ean: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  scannedCode?: string | null
}

export interface InternalOrderContract {
  orderId: string
  customerId: string
  fulfillmentType?: string
  fulfillmentSlotId?: string | null
  deliveryAreaId?: string | null
  status: string
  paymentStatus: string
  paymentMethod: string
  subtotal: number
  delivery: number
  discount: number
  total: number
  notes: string | null
  customer: InternalOrderCustomerContract
  items: InternalOrderItemContract[]
}
