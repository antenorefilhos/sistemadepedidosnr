export interface CrmContactProperties {
  email: string | null
  firstname: string
  lastname: string
  phone: string
  cpf_documento: string
  lifecyclestage: string
}

export interface CrmContactContract {
  customerId: string
  email: string | null
  firstName: string
  lastName: string
  phone: string
  cpf: string
  lifecycleStage: 'customer'
  eventType: 'customer_registered'
  registeredAt: string
  properties: CrmContactProperties
}

export interface CrmContactPreviewResponse {
  found: boolean
  customerId: string
  source?: 'live'
  contract?: CrmContactContract
}
