import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'

export class AddOrderEventDto {
  @IsString()
  type: string

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  paymentStatus?: string
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string
}

export class CancelOrderItemDto {
  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsString()
  pickerNotes?: string
}

export class SubstituteOrderItemDto {
  @IsString()
  substituteProductId: string

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number

  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsString()
  pickerNotes?: string
}
