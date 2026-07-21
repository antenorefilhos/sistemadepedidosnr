export interface ChargeMetadata {
  orderId: string
  customerId: string
  paymentMethod: string
}

export interface ChargeContract {
  orderId: string
  customerId: string
  customerName: string
  customerPhone: string
  amount: number
  method: string
  description: string
  pixKey: string | null
  expiresInSeconds: number
  metadata: ChargeMetadata
}

export interface ChargePreviewResponse {
  found: boolean
  orderId: string
  source?: 'live'
  contract?: ChargeContract
}
