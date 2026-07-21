import { IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator'

export class UpsertCustomerProfileDto {
  @IsOptional()
  @IsDateString()
  birthDate?: string

  @IsOptional()
  @IsString()
  gender?: string

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}

export class UpsertCustomerConsentDto {
  @IsString()
  @IsNotEmpty()
  type: string

  @IsString()
  @IsNotEmpty()
  status: string

  @IsString()
  @IsNotEmpty()
  source: string
}

export class LoyaltyMutationDto {
  @IsOptional()
  @IsNumber()
  points?: number

  @IsOptional()
  @IsNumber()
  cashback?: number

  @IsString()
  @IsNotEmpty()
  reason: string

  @IsOptional()
  @IsString()
  referenceType?: string

  @IsOptional()
  @IsString()
  referenceId?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  channel: string

  @IsOptional()
  @IsString()
  segmentId?: string

  @IsObject()
  template: Record<string, unknown>

  @IsOptional()
  @IsString()
  status?: string
}

export class CreateShoppingListDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  source?: string

  @IsArray()
  items: Array<{ productId: string; quantity?: number }>
}

export class ReorderFromOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string

  @IsOptional()
  @IsString()
  name?: string
}

export class RefreshSegmentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  inactiveDays?: number

  @IsOptional()
  @IsNumber()
  highTicketThreshold?: number
}
