import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

export class CheckoutDeliveryDto {
  @IsOptional()
  @IsString()
  mode?: string

  @IsOptional()
  @IsString()
  cep?: string

  @IsOptional()
  @IsString()
  zipCode?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number

  @IsOptional()
  @IsString()
  addressId?: string

  @IsOptional()
  @IsString()
  slotId?: string

  @IsOptional()
  @IsString()
  windowStart?: string

  @IsOptional()
  @IsString()
  windowEnd?: string
}

export class CreateCheckoutSessionDto {
  @IsString()
  cartId: string

  @IsString()
  idempotencyKey: string

  @IsOptional()
  @IsString()
  customerId?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  ttlMinutes?: number
}

export class QuoteCheckoutSessionDto {
  @IsOptional()
  @IsString()
  customerId?: string

  @IsOptional()
  @IsString()
  couponCode?: string

  @IsOptional()
  @IsString()
  deliveryAddressId?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutDeliveryDto)
  delivery?: CheckoutDeliveryDto

  @IsOptional()
  @IsArray()
  acceptedSubstitutionProductIds?: string[]
}

export class ConfirmCheckoutSessionDto extends QuoteCheckoutSessionDto {
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
}
