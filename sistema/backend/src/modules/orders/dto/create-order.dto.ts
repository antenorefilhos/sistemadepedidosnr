import { IsString, IsNumber, IsArray, IsOptional, IsNotEmpty, IsObject, IsISO8601, IsIn, Min } from 'class-validator'

export class CreateOrderItemDto {
  @IsString()
  productId: string

  @IsNumber()
  @Min(0.000001)
  quantity: number

  @IsOptional()
  @IsString()
  scannedCode?: string

  // JON-46 (Auditoria 360): o cliente escolhe item a item no carrinho se
  // aceita substituicao ou nao; confirmSession precisa repassar isso aqui,
  // senao create() grava 'ALLOW' pra todo mundo (ver comentario mais abaixo).
  @IsOptional()
  @IsIn(['ALLOW', 'DENY'])
  substitutionPolicy?: 'ALLOW' | 'DENY'
}

export class CreateOrderDto {
  @IsString()
  customerId: string

  @IsArray()
  items: CreateOrderItemDto[]

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string

  @IsOptional()
  @IsNumber()
  delivery?: number

  @IsOptional()
  @IsNumber()
  discount?: number

  @IsOptional()
  @IsString()
  paymentMethod?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  changeAmount?: string

  @IsOptional()
  @IsString()
  deviceId?: string

  @IsOptional()
  @IsString()
  couponCode?: string

  @IsOptional()
  @IsString()
  deliveryAddressId?: string

  @IsOptional()
  @IsString()
  clientIp?: string

  @IsOptional()
  @IsString()
  tenantId?: string

  @IsOptional()
  @IsString()
  storeId?: string

  @IsOptional()
  @IsString()
  channel?: string

  @IsOptional()
  @IsString()
  fulfillmentType?: string

  @IsOptional()
  @IsString()
  fulfillmentSlotId?: string

  /** ISO do horario escolhido pelo cliente. Ausente = "o quanto antes". */
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string

  @IsOptional()
  @IsNumber()
  fulfillmentSlotItemCount?: number

  @IsOptional()
  @IsString()
  deliveryAreaId?: string

  @IsOptional()
  @IsString()
  businessAccountId?: string

  @IsOptional()
  requiresApproval?: boolean

  @IsOptional()
  @IsObject()
  deliverySnapshot?: Record<string, unknown>

  // JON-47 (Auditoria 360): total que o cliente ja viu e aprovou na
  // confirmacao do checkout (confirmSession compara contra o priceSnapshot
  // exibido). create() roda o PRICING pela TERCEIRA vez (buildQuote,
  // confirmSession, e este) -- sem comparar contra este valor, promocao/
  // preco mudando entre a confirmacao e a gravacao do pedido passava batido.
  @IsOptional()
  @IsNumber()
  expectedTotal?: number
}
