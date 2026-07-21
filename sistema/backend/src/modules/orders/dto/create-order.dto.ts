import { IsString, IsNumber, IsArray, IsOptional, IsNotEmpty, IsObject, Min } from 'class-validator'

export class CreateOrderItemDto {
  @IsString()
  productId: string

  @IsNumber()
  @Min(0.000001)
  quantity: number

  @IsOptional()
  @IsString()
  scannedCode?: string
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
}
