import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateCartDto {
  @IsOptional()
  @IsString()
  customerId?: string

  @IsOptional()
  @IsString()
  deviceId?: string

  @IsOptional()
  @IsString()
  storeId?: string
}

export class UpsertCartItemDto {
  @IsString()
  productId: string

  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  quantity: number

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowSubstitution?: boolean
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  quantity: number

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowSubstitution?: boolean
}
