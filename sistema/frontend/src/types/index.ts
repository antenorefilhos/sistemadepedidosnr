export interface Product {
  id: string
  ean: string
  name: string
  alternativeDescription?: string
  price: number
  promotionalPrice?: number
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
}

export interface Customer {
  id: string
  name: string
  cpf: string
  whatsapp: string
  email?: string
  addresses?: Address[]
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
}

export interface OrderItem {
  id: string
  productId: string
  product?: Product
  quantity: number
  unitPrice: number
  subtotal: number
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
