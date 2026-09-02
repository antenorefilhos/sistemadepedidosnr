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
  /** true quando o produto e vendido por peso (ERP ou override manual). */
  isFractional?: boolean
  /** Passo de fracionamento efetivo (ex: 0.4 = 400g), null quando nao fracionado. */
  fractionStep?: number | null
  /** Preco de lista por unidade "cheia" (ex: por kg) -- usado para converter
   *  de volta ao formato que o ERP espera (quantidade em peso real, preco
   *  por kg), diferente de unitPrice que aqui e o preco por step. */
  listUnitPrice?: number
  /** Se o cliente aceita substituicao deste item quando faltar no estoque.
   *  `ALLOW` (default) | `DENY`. O separador precisa saber antes de trocar. */
  substitutionPolicy?: string
}

export interface InternalOrderAddressContract {
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  locality?: string | null
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
  /** Endereco de entrega -- o ERP quebra sem ele, ver mapToSolidcomPedido. */
  deliveryAddress?: InternalOrderAddressContract | null
  /** Horario agendado pelo cliente. Sem isso, o pedido vale como "o quanto
   *  antes" e a hora combinada vira agora + 15 min. */
  scheduledFor?: string | null
  items: InternalOrderItemContract[]
}
