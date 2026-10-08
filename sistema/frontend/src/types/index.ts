export interface Product {
  id: string
  ean: string
  erpProductId?: number | null
  ecommerceCategory?: string | null
  tags?: string[]
  name: string
  alternativeDescription?: string
  price: number
  promotionalPrice?: number
  /** Fim da oferta (fim do ultimo dia, em Brasilia). */
  promotionalPriceValidUntil?: string | null
  stock?: number
  isFractional?: boolean
  fractionStep?: number
  unit?: string
  badges?: string
  titleMask?: string
  titleMaskShort?: string
  videoUrl?: string | null
  syncOption?: 'ESTOQUE' | 'SEMPRE' | 'NUNCA'
  category?: string
  origin?: string
  active: boolean
  /** Dias da semana em que e vendido (0 = domingo); vazio/ausente = todos. */
  saleWeekdays?: number[]
  /** Ficha do vinho (curadoria por rotulo); ver utils/wine.ts. */
  wineProfile?: import('../utils/wine').WineProfile | null
  classification03?: string | null
}

export interface Customer {
  id: string
  name: string
  cpf: string
  whatsapp: string
  email?: string
  addresses?: Address[]
  /** A conta ja tem senha (conta do checkout convidado nasce sem). */
  hasPassword?: boolean
}

export interface Address {
  id: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault: boolean
  /** Localidade do frete escolhida quando o CEP cobre mais de uma. */
  locality?: string | null
  deliveryPointCode?: string | null
}

export interface CartItem {
  productId: string
  quantity: number
  product?: Product
}

export interface Order {
  id: string
  customerId: string
  customer?: Customer
  items: OrderItem[]
  subtotal: number
  discount: number
  delivery: number
  total: number
  status: string
  paymentStatus?: string
  paymentMethod?: string
  notes?: string | null
  createdAt: string
  erpDav?: string | null
  fulfillmentType?: string
  addressSnapshot?: {
    street: string
    number: string
    complement?: string | null
    neighborhood: string
    city: string
    state: string
  } | null
  deliveryStops?: { status: string; deliveredAt: string | null }[]
  /** Total que o cliente aprovou no checkout; `total` muda na separacao (peso, troca). */
  approvedTotal?: number | null
  /** Trocas que o separador mandou ao cliente (08/10/2026). */
  substitutionSuggestions?: SubstitutionSuggestion[]
}

export interface SubstitutionSuggestion {
  id: string
  orderItemId: string
  productId: string
  quantity: number
  unitPrice: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
  sentAt: string | null
  decidedAt: string | null
  decidedBy: string | null
  product: { id: string; name: string; ean: string | null; unit: string | null; isFractional: boolean | null } | null
}

export interface OrderItem {
  id: string
  productId: string
  product?: Product
  quantity: number
  unitPrice: number
  subtotal: number
  /** PENDING, PICKED, MISSING, SUBSTITUTED, CANCELLED -- o que a separacao fez com o item. */
  status?: string
  substitutedByItemId?: string | null
}

export interface RecipeCategory {
  id: string
  name: string
  slug: string
  description?: string
  active: boolean
  order: number
}

export interface RecipeIngredient {
  id: string
  name: string
  quantity?: string
  unit?: string
  order: number
}

export interface RecipeStep {
  id: string
  content: string
  order: number
  imageUrl?: string
}

export interface RecipeProduct {
  id: string
  productId: string
  product: Product
  note?: string
  order: number
}

export interface RecipeRelated {
  relatedRecipe: {
    id: string
    title: string
    slug: string
    imageUrl?: string
    prepTime?: number
    difficulty?: string
  }
}

export interface Recipe {
  id: string
  title: string
  slug: string
  description?: string
  seoTitle?: string
  seoDescription?: string
  imageUrl?: string
  prepTime?: number
  servings?: number
  difficulty?: string
  categoryId?: string
  category?: RecipeCategory
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  products: RecipeProduct[]
  relatedTo: RecipeRelated[]
  active: boolean
  publishedAt?: string
  createdAt: string
}
